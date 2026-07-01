/**
 * Visual regression — rotas do portal do cliente.
 *
 * Cobre:
 *  - /portal/acesso (público)
 *  - /portal, /portal/agenda, /portal/perfil (autenticado — pode mostrar
 *    portal ativo ou tela de vínculo pendente, ambos válidos para overflow)
 */
import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import {
  prepareForSnapshot,
  assertNoHorizontalOverflow,
  assertBottomNavVisible,
  assertMainHasBottomPadding,
  assertBottomNavItemsRespectSafeArea,
} from "../_helpers/visual";

const AUTH_TIMEOUT = 60_000;

test.describe("portal — rotas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/portal/acesso — sem overflow horizontal", async ({ page }) => {
    await page.goto("/portal/acesso");
    await prepareForSnapshot(page);
    await assertNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot("portal-acesso.png", { fullPage: true });
  });
});

test.describe("portal — rotas autenticadas", () => {
  test.describe.configure({ timeout: AUTH_TIMEOUT });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  for (const { path, name } of [
    { path: "/portal", name: "portal-home" },
    { path: "/portal/agenda", name: "portal-agenda" },
    { path: "/portal/perfil", name: "portal-perfil" },
  ]) {
    test(`${path} — nav portal 4 colunas, safe-area, sem overflow`, async ({ page }) => {
      const vw = page.viewportSize()?.width ?? 0;
      test.skip(vw >= 768, "Portal bottom nav só em mobile");

      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

      // Portal pode mostrar shell ou tela de vínculo — ambos devem respeitar viewport.
      await prepareForSnapshot(page);
      await assertNoHorizontalOverflow(page);

      const nav = page.locator('[data-bottom-nav][data-app-context="portal"]');
      if (await nav.count()) {
        await assertBottomNavVisible(page);
        await assertMainHasBottomPadding(page);
        await assertBottomNavItemsRespectSafeArea(page);

        const gridCols = await nav.locator("> div").first().evaluate((el) => {
          return getComputedStyle(el).gridTemplateColumns.split(" ").length;
        });
        expect(gridCols, "Portal nav deve ter 4 colunas").toBe(4);
      }

      await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
    });
  }
});
