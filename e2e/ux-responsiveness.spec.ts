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

test.describe("UX e Responsividade — viewports mobile", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  for (const viewport of MOBILE_VIEWPORTS) {
    test(`sem overflow horizontal em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/app/agenda");
      await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });

      const mobileRoutes = [
        {
          path: "/app",
          open: () => page.locator('[data-testid="bottom-nav-item"][data-route="app"]').click(),
        },
        {
          path: "/app/agenda",
          open: () => page.locator('[data-testid="bottom-nav-item"][data-route="app-agenda"]').click(),
        },
        {
          path: "/app/clientes",
          open: async () => {
            await page.getByTestId("bottom-nav-more").click();
            await page.locator('[data-testid="bottom-nav-sheet-item"][data-route="app-clientes"]').click();
          },
        },
      ] as const;

      for (const route of mobileRoutes) {
        await route.open();
        await expect(page).toHaveURL(new RegExp(`${route.path}(?:[?#]|$)`));
        await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 15_000 });
        await assertNoHorizontalOverflow(page);
      }
    });
  }
});

test.describe("UX e Responsividade — shell mobile", () => {
  test("BottomNav visível e sidebar oculta em <768px", async ({ page }) => {
    test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app", { waitUntil: "commit" });
    await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });

    const sidebar = page.locator("aside.hidden");
    await expect(sidebar.first()).toBeHidden();

    const bottomNav = page.locator('[data-bottom-nav]');
    await expect(bottomNav).toBeVisible();
  });

  test("Acessibilidade básica (Aria-Labels) em login", async ({ page }) => {
    await page.goto("/auth/login");
    const emailInput = page.getByRole("textbox", { name: "E-mail Profissional" });
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(page.locator('button[type="submit"]')).not.toBeDisabled();
  });
});

test.describe("UX e Responsividade — autenticado", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("Layout Mobile — BottomNav acessível após login", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app", { waitUntil: "commit" });
    await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });
    await expect(page.locator('[data-bottom-nav]')).toBeVisible();
    await expect(page.locator('[data-testid="bottom-nav-item"]').first()).toBeVisible();
  });

  test("Busca global mobile carrega ao ser acionada e mantém o dialog acessível", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app");
    await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });
    await page.getByRole("button", { name: "Buscar", exact: true }).click();
    await expect(page.getByPlaceholder("Buscar em clientes, agenda e serviços...")).toBeVisible();
  });
});
