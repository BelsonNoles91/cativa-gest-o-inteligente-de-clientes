/**
 * Visual regression — rotas públicas de marketing.
 *
 * Cobre: /, /planos, /auth/login
 */
import { test, expect } from "@playwright/test";
import { prepareForSnapshot, assertNoHorizontalOverflow } from "../_helpers/visual";
import { assertPublicBackendWasIsolated, mockPublicBackend } from "../_helpers/publicMocks";

/**
 * Vai à região visual desejada e espera as animações `whileInView` dos
 * elementos daquela viewport terminarem antes de capturar o estado final.
 */
async function scrollToCaptureState(page: import("@playwright/test").Page, target: number) {
  await page.evaluate(async (finalPosition) => {
    window.scrollTo({ top: finalPosition, behavior: "instant" });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  }, target);
  // A posição final aciona as animações whileInView do conteúdo capturado.
  // Esperar seu término evita congelar elementos em opacity: 0 ou no meio do fade.
  await page.waitForTimeout(1_300);
}

test.describe("marketing — rotas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ page }) => {
    await mockPublicBackend(page);
  });
  test.afterEach(async ({ page }) => {
    assertPublicBackendWasIsolated(page);
  });

  for (const { path, name } of [
    { path: "/", name: "landing" },
    { path: "/planos", name: "planos" },
    { path: "/auth/login", name: "login-marketing" },
  ]) {
    test(`${path} — sem overflow horizontal`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await prepareForSnapshot(page);
      await assertNoHorizontalOverflow(page);

      if (path === "/planos") {
        // A tela tem um estado inicial de carregamento e um fallback. Espere
        // por um plano visível para não congelar o estado transitório no baseline.
        for (const planName of ["Começo", "Solo", "Equipe", "Rede"]) {
          await expect(
            page.getByRole("heading", { name: planName, exact: true }),
          ).toBeVisible({ timeout: 20_000 });
        }
        await expect(page.getByText("Grátis por 30 dias · sem cartão", { exact: true })).toBeVisible();
        await expect(page.getByText("Plano gratuito para sempre · sem cartão", { exact: true })).toHaveCount(0);
      }

      if (path === "/") {
        await expect(page.getByTestId("plans-empty-state")).toBeVisible({ timeout: 20_000 });
        await expect(
          page.getByTestId("plans-empty-state").getByRole("link", { name: "Ver planos e preços" }),
        ).toBeVisible();
      }

      if (path === "/" || path === "/planos") {
        // As rotas de marketing são muito altas em telas pequenas. Três
        // capturas de viewport permitem revisar hero, conteúdo e rodapé com
        // detalhe, em vez de reduzir milhares de pixels em um fullPage estreito
        // (ou exceder o limite de altura do Chromium).
        const maxScroll = await page.evaluate(() =>
          Math.max(
            0,
            Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) -
              window.innerHeight,
          ),
        );
        const positions = [
          { state: "top", top: 0 },
          { state: "middle", top: Math.floor(maxScroll / 2) },
          { state: "bottom", top: maxScroll },
        ];
        for (const { state, top } of positions) {
          await scrollToCaptureState(page, top);
          await assertNoHorizontalOverflow(page);
          if (top > 0) {
            const scrolledHeader = page.locator("header").first();
            await expect(scrolledHeader).toHaveClass(/bg-white/);
            const scrolledHeaderBackground = await scrolledHeader.evaluate(
              (header) => getComputedStyle(header).backgroundColor,
            );
            expect(
              scrolledHeaderBackground,
              "o cabeçalho fixo deve ocultar o conteúdo rolado por trás dele",
            ).toBe("rgb(255, 255, 255)");

            const stickyCta = page.getByTestId("mobile-sticky-cta");
            if (await stickyCta.isVisible()) {
              await expect(stickyCta).toHaveClass(/bg-white/);
              const stickyCtaBackground = await stickyCta.evaluate(
                (cta) => getComputedStyle(cta).backgroundColor,
              );
              expect(
                stickyCtaBackground,
                "a CTA fixa não deve deixar o conteúdo rolado transparecer",
              ).toBe("rgb(255, 255, 255)");
            }
          }
          if (path === "/" && state === "bottom") {
            const stickyCta = page.getByTestId("mobile-sticky-cta");
            if (await stickyCta.isVisible()) {
              const socialLink = page.getByRole("link", { name: "LinkedIn da Cativa" });
              await expect(socialLink).toBeVisible();
              const [ctaBox, socialBox] = await Promise.all([
                stickyCta.boundingBox(),
                socialLink.boundingBox(),
              ]);
              expect(ctaBox, "CTA fixa deve ter caixa visível").not.toBeNull();
              expect(socialBox, "link social do rodapé deve ter caixa visível").not.toBeNull();
              expect(socialBox!.y + socialBox!.height).toBeLessThanOrEqual(ctaBox!.y);
            }
          }
          await expect(page).toHaveScreenshot(`${name}-${state}.png`);
        }
      } else {
        await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
      }
    });
  }
});
