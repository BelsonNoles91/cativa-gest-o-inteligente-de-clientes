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
import { createClient } from "@supabase/supabase-js";
import { captureFailureReport, type Offender } from "./safeAreaReport";

type Rect = { x: number; y: number; width: number; height: number };

/** CSS injetado para tornar screenshots determinísticos. */
const SNAPSHOT_CSS = `
  *, *::before, *::after {
    transition: none !important;
    animation: none !important;
    caret-color: transparent !important;
  }
  .animate-fade-in, [class*="animate-fade-in"] {
    opacity: 1 !important;
    transform: none !important;
  }
  /* Mascara o cursor de input piscando (caret) que diferencia builds */
  input, textarea { caret-color: transparent !important; }
  /* Evita troca entre Google Fonts e fallback entre capturas; os snapshots
     verificam geometria e hierarquia com as fontes Liberation, instaladas de
     forma idêntica no runner Linux do Playwright e no ambiente QA local. */
  *, *::before, *::after {
    font-family: "Liberation Sans", Arial, Helvetica, sans-serif !important;
  }
  h1, h2, h3, h4, h5, h6, .font-display {
    font-family: "Liberation Serif", Georgia, "Times New Roman", serif !important;
  }
  /* Texto marcado é temporal/volátil; sua caixa e geometria permanecem. */
  [data-volatile], time {
    color: transparent !important;
    text-shadow: none !important;
  }
  /* Conteúdo dentro da faixa volátil não deve expor a magnitude variável. */
  [data-volatile] [role="progressbar"] > div {
    opacity: 0 !important;
  }
  input[data-volatile] {
    -webkit-text-fill-color: transparent !important;
  }
  /* Garante background sólido quando há blur/backdrop */
  .backdrop-blur, .backdrop-blur-xl, .backdrop-blur-md {
    backdrop-filter: none !important;
  }
`;

const INSTALL_APP_DISMISS_KEY = "cativa:install-dismissed";

/**
 * Fixa estados persistentes do shell antes da primeira navegação autenticada.
 * O convite de instalação PWA é transitório e depende do navegador/dispositivo;
 * o init script roda antes do código da aplicação em cada navegação para evitar
 * que esse banner desloque todo o layout usado nos snapshots.
 */
export async function prepareAuthenticatedVisualState(page: Page): Promise<void> {
  // A data é mantida igual à fixture visual da fila (scripts/e2e-seed-fixtures.mjs)
  // para que o contato apareça como devido, não como futuro, em cada execução.
  // Dados variáveis são ocultados sem remover suas caixas nem alterar a geometria.
  await page.clock.install({ time: new Date("2026-09-22T12:00:00-03:00") });
  await page.addInitScript((dismissKey) => {
    window.localStorage.setItem(dismissKey, "1");
  }, INSTALL_APP_DISMISS_KEY);
}

/**
 * Portal visual usa uma identidade de cliente vinculada ao tenant; a sessão
 * owner da matriz do app não representa um usuário do portal.
 */
export async function prepareClientPortalVisualState(page: Page): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const email = process.env.E2E_CLIENT_USER?.trim();
  const password = process.env.E2E_CLIENT_PASS?.trim();
  if (!supabaseUrl || !publishableKey || !email || !password) {
    throw new Error(
      "A matriz visual do portal exige VITE_SUPABASE_URL, chave pública e credenciais do cliente QA.",
    );
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError || !auth.session || !auth.user) {
      throw new Error(
        `Autenticação do cliente QA para a matriz visual falhou: ${authError?.message ?? "sessão ausente"}`,
      );
    }

    const { data: link, error: linkError } = await supabase
      .from("client_users")
      .select("tenant_id")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .maybeSingle();
    if (linkError || !link) {
      throw new Error(
        `Cliente QA sem vínculo ativo para a matriz visual: ${linkError?.message ?? "vínculo ausente"}`,
      );
    }

    await page.addInitScript(
      ({ session, user, tenantId, storageKey, dismissKey }) => {
        window.localStorage.clear();
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ ...session, user, weak_password: null }),
        );
        window.localStorage.setItem("cativa.portal.tenantId", tenantId);
        window.localStorage.setItem(dismissKey, "1");
      },
      {
        session: auth.session,
        user: auth.user,
        tenantId: link.tenant_id,
        storageKey: `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`,
        dismissKey: INSTALL_APP_DISMISS_KEY,
      },
    );
  } finally {
    await supabase.auth.signOut();
  }
}

export async function prepareForSnapshot(page: Page): Promise<void> {
  try {
    await page.addStyleTag({ content: SNAPSHOT_CSS });
  } catch (err) {
    // addStyleTag pode falhar se a página estiver navegando.
    // Tentamos novamente após um pequeno settle.
    await page.waitForTimeout(100);
    await page.addStyleTag({ content: SNAPSHOT_CSS }).catch(() => {
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
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {
    /* páginas com polling ou conexões abertas seguem mesmo sem networkidle */
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
  await page.waitForTimeout(400);
}

/**
 * Prepara a página para a captura full-page. Algumas asserções geométricas
 * percorrem a página até o fim; elementos fixos podem ficar ancorados ao
 * viewport e aparecer no meio do screenshot alto. A BottomNav é validada
 * separadamente por geometria e em screenshots de viewport.
 */
export async function resetScrollForFullPageSnapshot(page: Page): Promise<void> {
  await page.evaluate(async () => {
    document
      .querySelectorAll<HTMLElement>("[data-app-main], main")
      .forEach((element) => {
        element.scrollTop = 0;
      });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  });
}

/**
 * Verifica que nenhum elemento descendente do <body> ultrapassa a largura
 * do viewport (overflow horizontal). Útil para Android 360.
 */
export async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const vw = root.clientWidth;
    const offenders: {
      tag: string;
      cls: string;
      w: number;
      left: number;
      right: number;
    }[] = [];
    const isClippedByAncestor = (element: Element, rect: DOMRect): boolean => {
      let ancestor = element.parentElement;
      while (ancestor && ancestor !== document.body) {
        const overflowX = getComputedStyle(ancestor).overflowX;
        if (["auto", "clip", "hidden", "scroll"].includes(overflowX)) {
          const ancestorRect = ancestor.getBoundingClientRect();
          if (
            rect.left < ancestorRect.left - 1 ||
            rect.right > ancestorRect.right + 1
          ) {
            return true;
          }
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    document.querySelectorAll("body *").forEach((el) => {
      const rect = (el as HTMLElement).getBoundingClientRect();
      const style = getComputedStyle(el);
      if (
        rect.width <= 0 ||
        rect.height <= 0 ||
        style.display === "none" ||
        style.visibility === "hidden"
      ) {
        return;
      }
      const left = Math.round(rect.left);
      const right = Math.round(rect.right);
      if ((left < -1 || right > vw + 1) && !isClippedByAncestor(el, rect)) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el as HTMLElement).className?.toString().slice(0, 80) ?? "",
          w: Math.round(rect.width),
          left,
          right,
        });
      }
    });
    return {
      vw,
      documentWidth: root.scrollWidth,
      offenders: offenders.slice(0, 5),
    };
  });
  expect(
    overflow.documentWidth,
    `A página possui overflow horizontal: documento=${overflow.documentWidth}px, viewport=${overflow.vw}px; ` +
      `elementos=${JSON.stringify(overflow.offenders)}`,
  ).toBeLessThanOrEqual(overflow.vw + 1);
  expect(
    overflow.offenders,
    `Elementos ultrapassam viewport (${overflow.vw}px): ` +
      JSON.stringify(overflow.offenders),
  ).toEqual([]);
}

async function getBottomNavViewportRect(page: Page): Promise<Rect | null> {
  const locator = page.locator("[data-bottom-nav]").first();
  const box = await locator.boundingBox();
  if (box) {
    return {
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    };
  }
  return page.evaluate(() => {
    const nav = document.querySelector(
      "[data-bottom-nav]",
    ) as HTMLElement | null;
    if (!nav) return null;
    const rect = nav.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  });
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
  try {
    await expect(nav).toBeVisible();
  } catch (err) {
    await captureFailureReport(page, "bottom-nav-not-visible", {
      message: err instanceof Error ? err.message : String(err),
      extra: { navCount: await nav.count() },
    });
    throw err;
  }
  const box = await getBottomNavViewportRect(page);
  expect(box, "BottomNav sem bounding box").not.toBeNull();
  const vh = page.viewportSize()?.height ?? 0;
  // Top do nav deve estar dentro do viewport (não cortado).
  if (box!.y >= vh) {
    const message = `BottomNav top (${box!.y}) está fora do viewport (vh=${vh}).`;
    await captureFailureReport(page, "bottom-nav-cut-off-top", {
      message,
      offenders: [
        {
          label: "BottomNav",
          rect: box!,
          side: "bottom",
          delta: box!.y - vh,
          hint: "topo do nav abaixo do viewport",
        },
      ],
    });
    expect(box!.y, message).toBeLessThan(vh);
  }
  if (box!.y + box!.height > vh + 1) {
    const message =
      `BottomNav bottom (${box!.y + box!.height}) escapa pela parte ` +
      `inferior do viewport (vh=${vh}).`;
    await captureFailureReport(page, "bottom-nav-escapes-bottom", {
      message,
      offenders: [
        {
          label: "BottomNav",
          rect: box!,
          side: "bottom",
          delta: box!.y + box!.height - vh,
          hint: "fora do viewport",
        },
      ],
    });
    expect(box!.y + box!.height, message).toBeLessThanOrEqual(vh + 1);
  }
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
  const navBox = await getBottomNavViewportRect(page);
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
  if (result.found && result.paddingBottomPx < navBox!.height - 4) {
    const message =
      `padding-bottom do main (${result.paddingBottomPx}px) deve ser >= altura ` +
      `do BottomNav (${navBox!.height}px) para evitar que o conteúdo final ` +
      `fique escondido atrás da nav fixa.`;
    await captureFailureReport(page, "main-missing-bottom-padding", {
      message,
      offenders: [
        {
          label: "[data-app-main]",
          rect: { x: 0, y: navBox!.y - 4, width: navBox!.width, height: 4 },
          side: "bottom",
          delta: navBox!.height - result.paddingBottomPx,
          hint: `pb=${result.paddingBottomPx}px < nav=${navBox!.height}px`,
        },
      ],
      extra: {
        paddingBottomPx: result.paddingBottomPx,
        navHeight: navBox!.height,
      },
    });
    expect(result.paddingBottomPx, message).toBeGreaterThanOrEqual(
      navBox!.height - 4,
    );
  }
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
  const navBox = await getBottomNavViewportRect(page);
  expect(navBox, "BottomNav sem bounding box").not.toBeNull();
  const navTop = navBox!.y;

  // Scrolla tudo até o fim — janela e qualquer scroller interno conhecido.
  // Retorna info de quanto rolou para validar que de fato aconteceu.
  const scrollResult = await page.evaluate(async () => {
    const scrollers: (HTMLElement | (Window & typeof globalThis))[] = [window];
    document
      .querySelectorAll<HTMLElement>("[data-app-main], main")
      .forEach((el) => {
        // Considera scrollers internos caso o layout mude para overflow:auto.
        if (el.scrollHeight > el.clientHeight + 1) scrollers.push(el);
      });
    const before = window.scrollY;
    for (const s of scrollers) {
      if (s === window) {
        window.scrollTo({
          top: document.body.scrollHeight,
          behavior: "instant" as ScrollBehavior,
        });
      } else {
        (s as HTMLElement).scrollTop = (s as HTMLElement).scrollHeight;
      }
    }
    // 2 RAFs para garantir layout final + repaint.
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r(null))),
    );
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

  expect(
    lastBottom,
    "Nenhum conteúdo encontrado em [data-app-main]",
  ).not.toBeNull();
  // O último conteúdo deve terminar acima (ou na mesma linha) do topo do nav.
  // Tolerância de 2px para subpixel rounding.
  if (lastBottom && lastBottom.bottom > navTop + 2) {
    const message =
      `Após scroll até o fim, o último conteúdo (<${lastBottom.tag} ` +
      `class="${lastBottom.cls}">) tem bottom=${lastBottom.bottom}px, ` +
      `mas o BottomNav começa em y=${Math.round(navTop)}px — conteúdo ` +
      `está sendo ocultado pela nav fixa. Verifique pb-bottom-nav no main.`;
    await captureFailureReport(page, "content-hidden-by-bottom-nav", {
      message,
      offenders: [
        {
          label: `<${lastBottom.tag}> ${lastBottom.cls.slice(0, 40)}`,
          // Aproxima rect: largura total, altura mínima 4px na linha do bottom.
          rect: {
            x: 0,
            y: Math.max(0, lastBottom.bottom - 4),
            width: page.viewportSize()?.width ?? 0,
            height: 4,
          },
          side: "covered-by-nav",
          delta: lastBottom.bottom - navTop,
          hint: `${lastBottom.bottom - navTop}px abaixo do nav`,
        },
      ],
      extra: { navTop, lastBottom, scrollResult },
    });
    expect(lastBottom.bottom, message).toBeLessThanOrEqual(navTop + 2);
  }
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
    const items = Array.from(nav.querySelectorAll<HTMLElement>("a, button"));
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

  if (result.found && result.offenders.length > 0) {
    // Coleta rects dos itens ofensores para anotar visualmente.
    const annotations: Offender[] = await page.evaluate((offendersArg) => {
      const nav = document.querySelector(
        "[data-bottom-nav]",
      ) as HTMLElement | null;
      if (!nav) return [];
      const items = Array.from(nav.querySelectorAll<HTMLElement>("a, button"));
      return offendersArg.map((o) => {
        const el = items[o.idx];
        const r = el?.getBoundingClientRect();
        return {
          label: `[nav#${o.idx}] ${o.label}`,
          rect: r
            ? { x: r.x, y: r.y, width: r.width, height: r.height }
            : { x: 0, y: 0, width: 0, height: 0 },
          side: o.side,
          delta: o.delta,
          hint: `excede +${Math.round(o.delta)}px`,
        };
      });
    }, result.offenders);
    const message =
      `Itens do BottomNav sobrepostos à safe-area (vw=${vw}, vh=${vh}, ` +
      `safe=${JSON.stringify(result.safe)}): ${JSON.stringify(result.offenders)}`;
    await captureFailureReport(page, "bottom-nav-items-violate-safe-area", {
      message,
      offenders: annotations,
      extra: { safe: result.safe, totalItems: result.totalItems },
    });
    expect(result.offenders, message).toEqual([]);
  }
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
  const navBox = await getBottomNavViewportRect(page);
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

  if (offenders.length > 0) {
    // Coleta rects dos ofensores para anotação visual.
    const offenderRects = await page.evaluate(() => {
      const els = Array.from(
        document.querySelectorAll<HTMLElement>("[data-critical-action]"),
      );
      return els.map((el, i) => {
        const r = el.getBoundingClientRect();
        return {
          idx: i,
          rect: { x: r.x, y: r.y, width: r.width, height: r.height },
          label:
            el.getAttribute("aria-label") ||
            el.textContent?.trim().slice(0, 40) ||
            "(sem rótulo)",
        };
      });
    });
    const annotations: Offender[] = offenders.map((o) => {
      const match = offenderRects.find((r) => r.label === o.label);
      return {
        label: `[critical] ${o.label}`,
        rect: match?.rect ?? { x: 0, y: navTop, width: 100, height: 1 },
        side: "covered-by-nav" as const,
        delta: o.bottom - navTop,
        hint: `position:${o.position}`,
      };
    });
    const message =
      `Ações críticas (data-critical-action) sobrepostas ao BottomNav ` +
      `(top=${Math.round(navTop)}px): ${JSON.stringify(offenders)}. ` +
      `Adicione bottom-[calc(4.25rem+env(safe-area-inset-bottom)+0.5rem)] ` +
      `ou similar para empurrar a ação acima da nav.`;
    await captureFailureReport(page, "critical-actions-covered-by-nav", {
      message,
      offenders: annotations,
      extra: { navTop, offenders },
    });
    expect(offenders, message).toEqual([]);
  }
}

/**
 * Simula perda de conexão no contexto do browser e dispara o evento `offline`
 * que o hook useOnlineStatus escuta. Aguarda o banner aparecer (até 3s) em
 * vez de timeout fixo. Retorna uma função para restaurar.
 *
 * Em caso de falha (banner não aparece), loga aviso mas NÃO lança — o caller
 * decide se isso é fatal via `assertOfflineBannerLayout`.
 */
export async function goOffline(page: Page): Promise<() => Promise<void>> {
  try {
    await page.context().setOffline(true);
  } catch (err) {
    console.warn("[visual] goOffline: setOffline(true) falhou", err);
  }
  await page
    .evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    })
    .catch(() => {
      /* página pode estar navegando */
    });

  // Aguarda o banner aparecer ATIVAMENTE (até 3s) em vez de sleep cego.
  // Usa data-offline-state quando presente (testid estável); cai para regex de
  // role=status caso seja uma versão antiga do shell.
  try {
    await page.waitForFunction(
      () => {
        const stable = document.querySelector(
          '[data-testid="offline-banner"][data-offline-state="offline"]',
        );
        if (stable) return true;
        const el = document.querySelector('[role="status"]');
        return el && /offline/i.test(el.textContent || "");
      },
      { timeout: 3000 },
    );
  } catch {
    console.warn(
      "[visual] goOffline: OfflineBanner não apareceu em 3s — " +
        "pode indicar regressão no useOnlineStatus ou render condicional.",
    );
  }

  return async () => {
    try {
      await page.context().setOffline(false);
    } catch (err) {
      console.warn("[visual] restore: setOffline(false) falhou", err);
    }
    await page
      .evaluate(() => {
        window.dispatchEvent(new Event("online"));
      })
      .catch(() => {
        /* página pode estar fechando */
      });
    // Aguarda banner mudar para "Conexão restaurada" ou sumir.
    await page
      .waitForFunction(
        () => {
          const stable = document.querySelector(
            '[data-testid="offline-banner"][data-offline-state="offline"]',
          );
          if (stable) return false;
          const el = document.querySelector('[role="status"]');
          if (!el) return true;
          return !/offline/i.test(el.textContent || "");
        },
        { timeout: 3000 },
      )
      .catch(() => {
        /* não-fatal */
      });
  };
}

/**
 * Confirma que o OfflineBanner está visível (em estado offline) e:
 *  - Não cobre nenhum item interativo do BottomNav.
 *  - Respeita a safe-area superior (env(safe-area-inset-top)).
 *  - Tem role=status para acessibilidade.
 */
export async function assertOfflineBannerLayout(page: Page): Promise<void> {
  // Preferimos o data-testid estável; mantemos fallback por role+texto para
  // compatibilidade com versões antigas do shell.
  const banner = page
    .locator(
      '[data-testid="offline-banner"][data-offline-state="offline"], [role="status"]:has-text("offline")',
    )
    .first();
  await expect(banner).toBeVisible();
  const bannerBox = await banner.boundingBox();
  expect(bannerBox, "OfflineBanner sem bounding box").not.toBeNull();

  const placement = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(
      '[data-testid="offline-banner"]',
    );
    const header = element?.closest("header");
    if (!element || !header) return { inHeader: false as const };
    const previousBottom = Array.from(header.children)
      .filter((child) => child !== element && child.getClientRects().length > 0)
      .map((child) => child.getBoundingClientRect().bottom)
      .reduce((max, bottom) => Math.max(max, bottom), header.getBoundingClientRect().top);
    return {
      inHeader: true as const,
      position: getComputedStyle(element).position,
      top: element.getBoundingClientRect().top,
      previousBottom,
    };
  });
  expect(placement.inHeader, "OfflineBanner deve pertencer ao header sticky").toBe(true);
  if (placement.inHeader) {
    expect(placement.position, "OfflineBanner não pode ser fixed sobre os controles").toBe("relative");
    expect(
      placement.top,
      `OfflineBanner começa antes do conteúdo anterior do header (${placement.previousBottom}px).`,
    ).toBeGreaterThanOrEqual(placement.previousBottom - 1);
  }

  // Banner no topo, não no rodapé — não pode sobrepor o BottomNav.
  const vw = page.viewportSize()?.width ?? 0;
  if (vw < 768) {
    const nav = page.locator("[data-bottom-nav]").first();
    if (await nav.count()) {
      const navBox = await nav.boundingBox();
      if (navBox) {
        try {
          expect(
            bannerBox!.y + bannerBox!.height,
            `OfflineBanner (bottom=${bannerBox!.y + bannerBox!.height}) está ` +
              `sobre o BottomNav (top=${navBox.y}).`,
          ).toBeLessThan(navBox.y);
        } catch (err) {
          await captureFailureReport(page, "offline-banner-overlaps-nav", {
            message: err instanceof Error ? err.message : String(err),
            offenders: [
              {
                label: "OfflineBanner",
                rect: bannerBox!,
                side: "covered-by-nav",
                delta: bannerBox!.y + bannerBox!.height - navBox.y,
                hint: "banner cobre o BottomNav",
              },
            ],
            extra: { bannerBox, navBox },
          });
          throw err;
        }
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
  try {
    expect(
      bannerBox!.y,
      `OfflineBanner top (${bannerBox!.y}) deve respeitar safe-area-inset-top (${safeTop}).`,
    ).toBeGreaterThanOrEqual(Math.max(0, safeTop - 1));
  } catch (err) {
    await captureFailureReport(page, "offline-banner-violates-safe-top", {
      message: err instanceof Error ? err.message : String(err),
      offenders: [
        {
          label: "OfflineBanner",
          rect: bannerBox!,
          side: "top",
          delta: Math.max(0, safeTop - bannerBox!.y),
          hint: `acima de safe-area-inset-top (${safeTop}px)`,
        },
      ],
      extra: { bannerBox, safeTop },
    });
    throw err;
  }
}
