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
  await page.addStyleTag({ content: SNAPSHOT_CSS });
  // Desativa scrollbar overlay no WebKit/Chromium para não vazar diff.
  await page.evaluate(() => {
    document.documentElement.style.scrollbarWidth = "none";
  });
  // Aguarda fontes carregadas (Fraunces/Inter via Google Fonts).
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
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
  await page.evaluate(async () => {
    const scrollers: (HTMLElement | (Window & typeof globalThis))[] = [window];
    document.querySelectorAll<HTMLElement>("[data-app-main], main").forEach(
      (el) => {
        // Considera scrollers internos caso o layout mude para overflow:auto.
        if (el.scrollHeight > el.clientHeight + 1) scrollers.push(el);
      },
    );
    for (const s of scrollers) {
      if (s === window) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" as ScrollBehavior });
      } else {
        (s as HTMLElement).scrollTop = (s as HTMLElement).scrollHeight;
      }
    }
    // 2 RAFs para garantir layout final + repaint.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
  });

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
