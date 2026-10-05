import { test, expect, type Page } from "@playwright/test";
import { assertLayoutContract } from "../_helpers/layoutContract";
import { assertPublicBackendWasIsolated, mockPublicBackend } from "../_helpers/publicMocks";

const PUBLIC_ROUTES = [
  { path: "/", name: "landing" },
  { path: "/planos", name: "planos" },
  { path: "/pricing", name: "pricing-alias" },
  { path: "/privacidade", name: "privacidade" },
  { path: "/termos", name: "termos" },
  { path: "/status", name: "status" },
  { path: "/auth/login", name: "login" },
  { path: "/auth/recuperar", name: "recuperar-senha" },
  { path: "/portal/acesso", name: "portal-acesso" },
  { path: "/onboarding", name: "onboarding" },
];

async function applyTextSpacingOverride(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        line-height: 1.5 !important;
        letter-spacing: .12em !important;
        word-spacing: .16em !important;
      }
      p { margin-bottom: 2em !important; }
    `,
  });
  await page.evaluate(() => document.fonts.ready);

  // A role locator avoids depending on Playwright's CSS `:visible` selector
  // across Chromium, Firefox and WebKit. On slower CI workers the app may also
  // finish hydrating after DOMContentLoaded, so wait for a real visible H1.
  const textTarget = page.getByRole("heading", { level: 1 }).first();
  await expect(textTarget, "a página precisa apresentar texto visível sob o override").toBeVisible({
    timeout: 15_000,
  });
  const spacing = await textTarget.evaluate((element) => {
    const style = getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize);
    return {
      fontSize,
      lineHeight: Number.parseFloat(style.lineHeight),
      letterSpacing: Number.parseFloat(style.letterSpacing),
      wordSpacing: Number.parseFloat(style.wordSpacing),
    };
  });

  expect(spacing.lineHeight).toBeGreaterThanOrEqual(spacing.fontSize * 1.5 - 0.5);
  expect(spacing.letterSpacing).toBeGreaterThanOrEqual(spacing.fontSize * 0.12 - 0.5);
  expect(spacing.wordSpacing).toBeGreaterThanOrEqual(spacing.fontSize * 0.16 - 0.5);

  const paragraph = page.locator("p:visible").first();
  if (await paragraph.count()) {
    const marginBottom = await paragraph.evaluate((element) => Number.parseFloat(getComputedStyle(element).marginBottom));
    const paragraphFontSize = await paragraph.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(marginBottom).toBeGreaterThanOrEqual(paragraphFontSize * 2 - 0.5);
  }
}

test.describe("a11y — reflow e espaçamento de texto", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.afterEach(async ({ page }) => assertPublicBackendWasIsolated(page));

  for (const route of PUBLIC_ROUTES) {
    test(`${route.name}: reflow 200%/400% com espaçamento WCAG 1.4.12`, async ({ page }, testInfo) => {
      // Planos determinísticos: sem depender de chave ou projeto Supabase.
      await mockPublicBackend(page);
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      expect(response?.status() ?? 200, `${route.path}: resposta HTTP inesperada`).toBeLessThan(500);
      await applyTextSpacingOverride(page);

      // 640px e 320px CSS equivalem ao espaço útil de 1280px a zoom de 200% e
      // 400%, respectivamente. É um teste de reflow, não de zoom físico do SO.
      for (const width of [640, 320]) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(
          () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
        );
        await assertLayoutContract(page, `${route.name}-reflow-${width}px`, testInfo);

        const mainContent = page.locator("main, [role='main']").first();
        if (await mainContent.count()) await expect(mainContent).toBeVisible();
        await expect(page.locator("body")).toBeVisible();
      }
    });
  }
});
