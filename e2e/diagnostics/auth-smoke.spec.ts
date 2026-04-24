import { test, expect, type Page } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";

async function inspectRoute(page: Page, path: string) {
  await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});

  const started = Date.now();
  while (Date.now() - started < 45_000) {
    const appMain = await page.locator("[data-app-main]").count();
    const loginEmailField = await page
      .getByRole("textbox", { name: /^e-mail$/i })
      .count();
    const onboardingHints = await page
      .getByText(/nome e segmento|criar conta gratuita|tudo pronto!/i)
      .count()
      .catch(() => 0);

    if (appMain > 0 || loginEmailField > 0 || onboardingHints > 0) {
      const bodyText = await page.locator("body").innerText().catch(() => "");
      return {
        path,
        currentUrl: page.url(),
        appMain,
        loginEmailField,
        onboardingHints,
        bodySnippet: bodyText.slice(0, 1200),
      };
    }
    await page.waitForTimeout(500);
  }

  const bodyText = await page.locator("body").innerText().catch(() => "");
  return {
    path,
    currentUrl: page.url(),
    appMain: 0,
    loginEmailField: 0,
    onboardingHints: 0,
    bodySnippet: bodyText.slice(0, 1200),
  };
}

test.describe("auth smoke", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  for (const path of ["/app", "/app/agenda", "/app/clientes", "/app/confirmacoes"]) {
    test(`${path} carrega shell autenticado`, async ({ page }) => {
      const snapshot = await inspectRoute(page, path);

      expect(
        snapshot.appMain,
        `Rota ${path} não carregou [data-app-main]. Snapshot:\n${JSON.stringify(
          snapshot,
          null,
          2,
        )}`,
      ).toBeGreaterThan(0);
      expect(snapshot.loginEmailField).toBe(0);
      expect(snapshot.onboardingHints).toBe(0);
    });
  }
});
