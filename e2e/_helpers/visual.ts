/**
 * Helpers compartilhados para specs de visual regression.
 *
 * - prepareForSnapshot(page): desliga animações, transições, motion-blur do
 *   Tailwind, e força um clock estável para mascarar relógios/contadores.
 * - assertNoOverflow(page): verifica que nenhum elemento excede o viewport
 *   horizontalmente — captura cortes laterais comuns em Android 360.
 * - assertBottomNavReachable(page): garante que o BottomNav está visível e
 *   não é coberto por nada (z-index correto, safe-area aplicada).
 */
import { expect, type Page } from "@playwright/test";

/** CSS injetado para tornar screenshots determinísticos. */
const SNAPSHOT_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
  /* Mascara o cursor de input piscando (caret) que diferencia builds */
  input, textarea { caret-color: transparent !important; }
  /* Garante background sólido quando há blur/backdrop */
  .backdrop-blur, .backdrop-blur-xl, .backdrop-blur-md {
    backdrop-filter: none !important;
  }
`;

export async function prepareForSnapshot(page: Page): Promise<void> {
  try {
    await page.addStyleTag({ content: SNAPSHOT_CSS });
  } catch (err) {
    // addStyleTag pode falhar se a página estiver navegando.
    // Tentamos novamente após um pequeno settle.
    await page.waitForTimeout(100);
    await page.addStyleTag({ content: SNAPSHOT_CSS }).catch(() => {
      // eslint-disable-next-line no-console
      console.warn("[visual] prepareForSnapshot: addStyleTag falhou 2x", err);
    });
  }
  // Desativa scrollbar overlay no WebKit/Chromium para não vazar diff.
  await page
    .evaluate(() => {
      document.documentElement.style.scrollbarWidth = "none";
    })
    .catch(() => {
      /* contexto pode ter sido destruído por navegação concorrente */
    });
  // Aguarda fontes carregadas com TIMEOUT — sem isso, fontes que falham em
  // carregar (CDN offline) travam o teste por 30s sem mensagem útil.
  await page
    .evaluate(async () => {
      if (!document.fonts || !document.fonts.ready) return;
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    })
    .catch(() => {
      /* fontes não disponíveis no contexto atual — segue */
    });
  // Pequeno settle para layout final (carga assíncrona de avatares etc).
  await page.waitForTimeout(250);
}

/**
 * Verifica que nenhum elemento descendente do <body> ultrapassa a largura
 * do viewport (overflow horizontal). Útil para Android 360.
 */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const vw = root.clientWidth;
    const offenders: { tag: string; cls: string; w: number }[] = [];
    document.querySelectorAll("body *").forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width > vw + 1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el as HTMLElement).className?.toString().slice(0, 80) ?? "",
          w: Math.round(rect.width),
        });
      }
    });
    return { vw, offenders: offenders.slice(0, 5) };
  });
  expect(
    overflow.offenders,
    `Elementos ultrapassam viewport (${overflow.vw}px): ` +
      JSON.stringify(overflow.offenders),
  ).toEqual([]);
}

/**
 * Confirma que o BottomNav está visível e seu top está acima do bottom do
 * viewport (não foi empurrado para fora pela safe-area mal calculada).
 * Só roda em viewports onde md:hidden é true (< 768px).
 */
export async function assertBottomNavVisible(page: Page): Promise<void> {
  const vw = page.viewportSize()?.width ?? 0;
  if (vw >= 768) return; // BottomNav é md:hidden
  const nav = page.locator("[data-bottom-nav]");
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  expect(box, "BottomNav sem bounding box").not.toBeNull();
  const vh = page.viewportSize()?.height ?? 0;
  // Top do nav deve estar dentro do viewport (não cortado).
  expect(box!.y).toBeLessThan(vh);
  // Bottom do nav <= viewport height (não pode escapar pela parte de baixo).
  expect(box!.y + box!.height).toBeLessThanOrEqual(vh + 1);
}

/**
 * Verifica que o `<main data-app-main>` reserva padding-bottom suficiente
 * para que seu conteúdo não seja coberto pelo BottomNav fixo.
 *
 * Regra: padding-bottom computado do main >= altura do BottomNav.
 * Tolerância: 4px para arredondamentos de subpixel.
 *
 * Só roda em viewports onde o BottomNav existe (< 768px).
 */
export async function assertMainHasBottomPadding(page: Page): Promise<void> {
  const vw = page.viewportSize()?.width ?? 0;
  if (vw >= 768) return;

  const nav = page.locator("[data-bottom-nav]").first();
  await expect(nav).toBeVisible();
  const navBox = await nav.boundingBox();
  expect(navBox, "BottomNav sem bounding box").not.toBeNull();

  const result = await page.evaluate(() => {
    const main = document.querySelector(
      "[data-app-main]",
    ) as HTMLElement | null;
    if (!main) return { found: false as const };
    const cs = getComputedStyle(main);
    return {
      found: true as const,
      paddingBottomPx: parseFloat(cs.paddingBottom || "0"),
    };
  });

  expect(result.found, "[data-app-main] não encontrado no DOM").toBe(true);
  // Margem de 4px para subpixel; o pb-bottom-nav já soma safe-area-inset-bottom.
  expect(
    result.paddingBottomPx,
    `padding-bottom do main (${result.paddingBottomPx}px) deve ser >= altura ` +
      `do BottomNav (${navBox!.height}px) para evitar que o conteúdo final ` +
      `fique escondido atrás da nav fixa.`,
  ).toBeGreaterThanOrEqual(navBox!.height - 4);
}

/**
 * Rola a página até o fim e verifica que o último elemento de conteúdo do
 * `<main>` permanece visível acima do topo do BottomNav (não fica oculto).
 *
 * Estratégia:
 *  1. Scroll para o bottom da página (window + scrollable container).
 *  2. Aguarda repaint.
 *  3. Pega bounding box do último filho com altura > 0 dentro de [data-app-main].
 *  4. Garante que esse `bottom` <= top do BottomNav (com tolerância de 2px).
 *
 * Esse teste captura regressões em que removem `pb-bottom-nav` do main, ou
 * adicionam um elemento sticky/absolute que ultrapassa o padding reservado.
 *
 * Só roda em viewports onde o BottomNav existe (< 768px).
 */
export async function assertContentNotHiddenByBottomNav(
  page: Page,
): Promise<void> {
  const vw = page.viewportSize()?.width ?? 0;
  if (vw >= 768) return;

  const nav = page.locator("[data-bottom-nav]").first();
  await expect(nav).toBeVisible();
  const navBox = await nav.boundingBox();
  expect(navBox, "BottomNav sem bounding box").not.toBeNull();
  const navTop = navBox!.y;

  // Scrolla tudo até o fim — janela e qualquer scroller interno conhecido.
  // Retorna info de quanto rolou para validar que de fato aconteceu.
  const scrollResult = await page.evaluate(async () => {
    const scrollers: (HTMLElement | (Window & typeof globalThis))[] = [window];
    document.querySelectorAll<HTMLElement>("[data-app-main], main").forEach(
      (el) => {
        // Considera scrollers internos caso o layout mude para overflow:auto.
        if (el.scrollHeight > el.clientHeight + 1) scrollers.push(el);
      },
    );
    const before = window.scrollY;
    for (const s of scrollers) {
      if (s === window) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior });
      } else {
        (s as HTMLElement).scrollTop = (s as HTMLElement).scrollHeight;
      }
    }
    // 2 RAFs para garantir layout final + repaint.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
    return {
      scrolledBy: window.scrollY - before,
      finalScrollY: window.scrollY,
      pageHeight: document.body.scrollHeight,
      viewportH: window.innerHeight,
    };
  });

  // Sanidade: se a página é maior que o viewport mas não rolamos, algo
  // bloqueou o scroll (overflow:hidden em ancestral, modal aberto etc).
  // Logamos um aviso mas não falhamos — pode ser página realmente curta.
  if (
    scrollResult.pageHeight > scrollResult.viewportH + 50 &&
    scrollResult.scrolledBy === 0 &&
    scrollResult.finalScrollY === 0
  ) {
    // eslint-disable-next-line no-console
    console.warn(
      `[visual] assertContentNotHiddenByBottomNav: scroll não teve efeito ` +
        `(pageHeight=${scrollResult.pageHeight}, viewportH=${scrollResult.viewportH}). ` +
        `Verifique se há modal aberto ou overflow:hidden bloqueando.`,
    );
  }

  // Encontra o último elemento renderizado dentro do main com área > 0.
  const lastBottom = await page.evaluate(() => {
    const main = document.querySelector(
      "[data-app-main]",
    ) as HTMLElement | null;
    if (!main) return null;
    const candidates = Array.from(main.querySelectorAll<HTMLElement>("*"));
    let maxBottom = -Infinity;
    let chosen: { tag: string; cls: string; bottom: number } | null = null;
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      // Ignora elementos sem caixa renderizada ou fora do fluxo normal.
      if (r.width <= 0 || r.height <= 0) continue;
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.position === "sticky") continue;
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (r.bottom > maxBottom) {
        maxBottom = r.bottom;
        chosen = {
          tag: el.tagName.toLowerCase(),
          cls: el.className?.toString().slice(0, 80) ?? "",
          bottom: Math.round(r.bottom),
        };
      }
    }
    return chosen;
  });

  expect(lastBottom, "Nenhum conteúdo encontrado em [data-app-main]").not.toBeNull();
  // O último conteúdo deve terminar acima (ou na mesma linha) do topo do nav.
  // Tolerância de 2px para subpixel rounding.
  expect(
    lastBottom!.bottom,
    `Após scroll até o fim, o último conteúdo (<${lastBottom!.tag} ` +
      `class="${lastBottom!.cls}">) tem bottom=${lastBottom!.bottom}px, ` +
      `mas o BottomNav começa em y=${Math.round(navTop)}px — conteúdo ` +
      `está sendo ocultado pela nav fixa. Verifique pb-bottom-nav no main.`,
  ).toBeLessThanOrEqual(navTop + 2);
}

/**
 * Garante que cada item interativo do BottomNav (links/botões) respeita a
 * safe-area horizontal/inferior do dispositivo. Em iPhones landscape o notch
 * fica à esquerda → `safe-area-inset-left` deve empurrar o primeiro item;
 * em portrait o home indicator → `safe-area-inset-bottom` deve empurrar a
 * base do nav para cima.
 *
 * Para cada item:
 *   - `rect.left  >= safeLeft   - tol` (não sobreposto ao notch esquerdo)
 *   - `rect.right <= vw - safeRight + tol` (não sobreposto ao notch direito)
 *   - `rect.bottom <= vh - safeBottom + tol` (não sob o home indicator)
 *
 * Lê `env(safe-area-inset-*)` via um probe DOM para obter os valores reais
 * resolvidos pelo browser.
 *
 * Só roda em viewports onde o BottomNav existe (< 768px).
 */
export async function assertBottomNavItemsRespectSafeArea(
  page: Page,
): Promise<void> {
  const vw = page.viewportSize()?.width ?? 0;
  const vh = page.viewportSize()?.height ?? 0;
  if (vw >= 768) return;

  await expect(page.locator("[data-bottom-nav]")).toBeVisible();

  const result = await page.evaluate(() => {
    // Probe que resolve env(safe-area-inset-*) → px reais do dispositivo.
    const probe = document.createElement("div");
    probe.style.cssText = [
      "position:fixed",
      "top:0",
      "left:0",
      "width:0",
      "height:0",
      "padding-top:env(safe-area-inset-top, 0px)",
      "padding-right:env(safe-area-inset-right, 0px)",
      "padding-bottom:env(safe-area-inset-bottom, 0px)",
      "padding-left:env(safe-area-inset-left, 0px)",
      "pointer-events:none",
      "visibility:hidden",
    ].join(";");
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const safe = {
      top: parseFloat(cs.paddingTop) || 0,
      right: parseFloat(cs.paddingRight) || 0,
      bottom: parseFloat(cs.paddingBottom) || 0,
      left: parseFloat(cs.paddingLeft) || 0,
    };
    probe.remove();

    const nav = document.querySelector(
      "[data-bottom-nav]",
    ) as HTMLElement | null;
    if (!nav) return { found: false as const, safe };

    // Itens interativos: links + botões dentro do nav.
    const items = Array.from(
      nav.querySelectorAll<HTMLElement>("a, button"),
    );
    const offenders: {
      idx: number;
      label: string;
      side: "left" | "right" | "bottom";
      delta: number;
    }[] = [];

    items.forEach((el, idx) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const label =
        el.getAttribute("aria-label") ||
        el.textContent?.trim().slice(0, 30) ||
        el.tagName.toLowerCase();
      const tol = 1;
      if (r.left < safe.left - tol) {
        offenders.push({ idx, label, side: "left", delta: safe.left - r.left });
      }
      if (r.right > window.innerWidth - safe.right + tol) {
        offenders.push({
          idx,
          label,
          side: "right",
          delta: r.right - (window.innerWidth - safe.right),
        });
      }
      if (r.bottom > window.innerHeight - safe.bottom + tol) {
        offenders.push({
          idx,
          label,
          side: "bottom",
          delta: r.bottom - (window.innerHeight - safe.bottom),
        });
      }
    });

    return { found: true as const, safe, offenders, totalItems: items.length };
  });

  expect(result.found, "BottomNav não encontrado no DOM").toBe(true);
  expect(
    result.totalItems,
    "BottomNav sem itens interativos (a/button)",
  ).toBeGreaterThan(0);
  expect(
    result.offenders,
    `Itens do BottomNav sobrepostos à safe-area (vw=${vw}, vh=${vh}, ` +
      `safe=${JSON.stringify(result.safe)}): ${JSON.stringify(result.offenders)}`,
  ).toEqual([]);
}

/**
 * Garante que ações críticas marcadas com `[data-critical-action]` (FABs,
 * botões "Salvar" sticky, CTA principal de uma página) não ficam ocultos
 * atrás do BottomNav.
 *
 * Convenção: marque elementos críticos com `data-critical-action` no JSX:
 *   <Button data-critical-action onClick={...}>Salvar</Button>
 *
 * Regra: bottom do elemento <= top do BottomNav (tol 2px). Se o elemento
 * for `position: fixed/sticky`, ainda assim deve estar visível e acima do
 * nav.
 *
 * Se nenhum elemento marcado existir na página, o teste passa silenciosamente
 * — ele só dispara quando há algo a verificar.
 *
 * Só roda em viewports onde o BottomNav existe (< 768px).
 */
export async function assertCriticalActionsAboveBottomNav(
  page: Page,
): Promise<void> {
  const vw = page.viewportSize()?.width ?? 0;
  if (vw >= 768) return;

  const nav = page.locator("[data-bottom-nav]").first();
  await expect(nav).toBeVisible();
  const navBox = await nav.boundingBox();
  if (!navBox) return;
  const navTop = navBox.y;

  const offenders = await page.evaluate((navTopArg: number) => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-critical-action]"),
    );
    const out: {
      tag: string;
      label: string;
      bottom: number;
      position: string;
    }[] = [];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      if (r.bottom > navTopArg + 2) {
        out.push({
          tag: el.tagName.toLowerCase(),
          label:
            el.getAttribute("aria-label") ||
            el.textContent?.trim().slice(0, 40) ||
            "(sem rótulo)",
          bottom: Math.round(r.bottom),
          position: cs.position,
        });
      }
    }
    return out;
  }, navTop);

  expect(
    offenders,
    `Ações críticas (data-critical-action) sobrepostas ao BottomNav ` +
      `(top=${Math.round(navTop)}px): ${JSON.stringify(offenders)}. ` +
      `Adicione bottom-[calc(4.25rem+env(safe-area-inset-bottom)+0.5rem)] ` +
      `ou similar para empurrar a ação acima da nav.`,
  ).toEqual([]);
}

/**
 * Simula perda de conexão no contexto do browser e dispara o evento `offline`
 * que o hook useOnlineStatus escuta. Retorna uma função para restaurar.
 *
 * Usado em cenários de navegação para validar que o OfflineBanner aparece
 * sem quebrar safe-area / BottomNav.
 */
export async function goOffline(page: Page): Promise<() => Promise<void>> {
  await page.context().setOffline(true);
  await page.evaluate(() => {
    window.dispatchEvent(new Event("offline"));
  });
  // Pequeno settle para o React renderizar o banner.
  await page.waitForTimeout(150);
  return async () => {
    await page.context().setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await page.waitForTimeout(150);
  };
}

/**
 * Confirma que o OfflineBanner está visível (em estado offline) e:
 *  - Não cobre nenhum item interativo do BottomNav.
 *  - Respeita a safe-area superior (env(safe-area-inset-top)).
 *  - Tem role=status para acessibilidade.
 */
export async function assertOfflineBannerLayout(page: Page): Promise<void> {
  const banner = page.locator('[role="status"]', { hasText: /offline/i }).first();
  await expect(banner).toBeVisible();
  const bannerBox = await banner.boundingBox();
  expect(bannerBox, "OfflineBanner sem bounding box").not.toBeNull();

  // Banner no topo, não no rodapé — não pode sobrepor o BottomNav.
  const vw = page.viewportSize()?.width ?? 0;
  if (vw < 768) {
    const nav = page.locator("[data-bottom-nav]").first();
    if (await nav.count()) {
      const navBox = await nav.boundingBox();
      if (navBox) {
        expect(
          bannerBox!.y + bannerBox!.height,
          `OfflineBanner (bottom=${bannerBox!.y + bannerBox!.height}) está ` +
            `sobre o BottomNav (top=${navBox.y}).`,
        ).toBeLessThan(navBox.y);
      }
    }
  }

  // Safe-area top: o banner não deve estar colado em y=0 quando há notch.
  const safeTop = await page.evaluate(() => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:0;left:0;height:0;width:0;padding-top:env(safe-area-inset-top,0px);visibility:hidden";
    document.body.appendChild(probe);
    const v = parseFloat(getComputedStyle(probe).paddingTop) || 0;
    probe.remove();
    return v;
  });
  // Tolerância de 1px para subpixel.
  expect(
    bannerBox!.y,
    `OfflineBanner top (${bannerBox!.y}) deve respeitar safe-area-inset-top (${safeTop}).`,
  ).toBeGreaterThanOrEqual(Math.max(0, safeTop - 1));
}
