import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";

test.use({
  trace: "off",
  screenshot: "off",
});

test.describe("app shell smoke", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("/app entrega shell autenticado", async ({ page }) => {
    await page.goto("/app", { waitUntil: "commit", timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});

    const started = Date.now();
    while (Date.now() - started < 45_000) {
      if ((await page.locator("[data-app-main]").count()) > 0) {
        expect(await page.getByRole("textbox", { name: /^e-mail$/i }).count()).toBe(0);
        return;
      }
      await page.waitForTimeout(500);
    }

    const bodyText = await page.locator("body").innerText().catch(() => "");
    throw new Error(
      JSON.stringify(
        {
          currentUrl: page.url(),
          loginEmailField: await page
            .getByRole("textbox", { name: /^e-mail$/i })
            .count(),
          appMain: await page.locator("[data-app-main]").count(),
          bodySnippet: bodyText.slice(0, 1200),
        },
        null,
        2,
      ),
    );
  });
});
