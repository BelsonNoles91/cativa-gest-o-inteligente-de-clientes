/**
 * Acessibilidade mobile — axe-core em rotas críticas.
 *
 * Viewports: iphone-se, iphone-14-portrait (via projects no playwright.config)
 */
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import { prepareAuthenticatedVisualState } from "../_helpers/visual";

const AXE_TAGS = ["wcag2a", "wcag2aa"];

async function scanPage(page: import("@playwright/test").Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(AXE_TAGS)
    .disableRules(["color-contrast"])
    .analyze();

  const critical = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  expect(
    critical,
    `${label}: ${critical.length} violação(ões) crítica(s)/séria(s):\n` +
      critical.map((v) => `  [${v.impact}] ${v.id}: ${v.description}`).join("\n"),
  ).toEqual([]);
}

test.describe("a11y mobile — rotas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/auth/login — axe wcag2a/aa", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, "A11y mobile viewports");

    await page.goto("/auth/login");
    await page.waitForLoadState("domcontentloaded");
    await scanPage(page, "/auth/login");
  });

  test("/portal/acesso — axe wcag2a/aa", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, "A11y mobile viewports");

    await page.goto("/portal/acesso");
    await page.waitForLoadState("domcontentloaded");
    await scanPage(page, "/portal/acesso");
  });
});

test.describe("a11y mobile — rotas autenticadas", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test.beforeEach(async ({ page }) => {
    await prepareAuthenticatedVisualState(page);
  });

  test("/app — axe wcag2a/aa", async ({ page }) => {
    test.skip((page.viewportSize()?.width ?? 0) >= 768, "A11y mobile viewports");

    await page.goto("/app");
    await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });
    await scanPage(page, "/app");
  });
});
