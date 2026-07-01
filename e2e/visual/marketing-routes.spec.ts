/**
 * Visual regression — rotas públicas de marketing.
 *
 * Cobre: /, /planos, /auth/login
 */
import { test, expect } from "@playwright/test";
import { prepareForSnapshot, assertNoHorizontalOverflow } from "../_helpers/visual";

test.describe("marketing — rotas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

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
      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    });
  }
});
