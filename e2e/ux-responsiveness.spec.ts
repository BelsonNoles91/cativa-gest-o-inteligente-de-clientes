import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "./_helpers/auth";
import { assertNoHorizontalOverflow } from "./_helpers/visual";

/**
 * Suite E2E para validação de responsividade mobile em viewports críticos.
 *
 * Viewports: 320×568 (iPhone SE), 360×800 (Android), 390×844 (iPhone 14)
 */
const MOBILE_VIEWPORTS = [
  { name: "320×568", width: 320, height: 568 },
  { name: "360×800", width: 360, height: 800 },
  { name: "390×844", width: 390, height: 844 },
] as const;

const APP_ROUTES = ["/app", "/app/agenda", "/app/clientes"] as const;

test.describe("UX e Responsividade — viewports mobile", () => {
  for (const viewport of MOBILE_VIEWPORTS) {
    test(`sem overflow horizontal em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/auth/login");
      await page.fill('input[name="email"]', process.env.E2E_USER ?? "owner@cativa.test");
      await page.fill('input[name="password"]', process.env.E2E_PASS ?? "Cativa@Test2026");
      await page.click('button[type="submit"]');
      await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });

      for (const route of APP_ROUTES) {
        await page.goto(route, { waitUntil: "domcontentloaded" });
        await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 15_000 });
        await assertNoHorizontalOverflow(page);
      }
    });
  }
});

test.describe("UX e Responsividade — shell mobile", () => {
  test("BottomNav visível e sidebar oculta em <768px", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/auth/login");
    await page.fill('input[name="email"]', process.env.E2E_USER ?? "owner@cativa.test");
    await page.fill('input[name="password"]', process.env.E2E_PASS ?? "Cativa@Test2026");
    await page.click('button[type="submit"]');
    await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });

    const sidebar = page.locator("aside.hidden");
    await expect(sidebar.first()).toBeHidden();

    const bottomNav = page.locator('[data-bottom-nav]');
    await expect(bottomNav).toBeVisible();
  });

  test("Acessibilidade básica (Aria-Labels) em login", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('input[name="email"]')).toHaveAttribute("aria-label", /email/i);
    await expect(page.locator('button[type="submit"]')).not.toBeDisabled();
  });
});

test.describe("UX e Responsividade — autenticado", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("Layout Mobile — BottomNav acessível após login", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app");
    await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });
    await expect(page.locator('[data-bottom-nav]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-item"]').first()).toBeVisible();
  });
});
