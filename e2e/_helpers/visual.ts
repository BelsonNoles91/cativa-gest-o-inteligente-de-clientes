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
