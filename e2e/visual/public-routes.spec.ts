/**
 * Visual regression — rotas públicas (sem auth).
 *
 * Cobre:
 *  - /auth/login (uma das 5 rotas-baseline)
 *
 * As asserções de overflow horizontal e BottomNav rodam em todos os perfis
 * de dispositivo; o screenshot é o "selo" final.
 */
import { test, expect } from "@playwright/test";
import {
  prepareForSnapshot,
  assertNoHorizontalOverflow,
  assertBottomNavVisible,
  assertMainHasBottomPadding,
  assertContentNotHiddenByBottomNav,
} from "../_helpers/visual";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("rotas públicas", () => {
  test("/auth/login — sem overflow e baseline visual", async ({ page }) => {
    await page.goto("/auth/login");
    await prepareForSnapshot(page);
    await assertNoHorizontalOverflow(page);
    // BottomNav não existe em login — o helper retorna sem assert se desktop;
    // em mobile o login não tem BottomNav, então pulamos a asserção aqui.
    await expect(page).toHaveScreenshot("login.png", { fullPage: true });
  });
});

test.describe("rotas autenticadas", () => {
  for (const { path, name } of [
    { path: "/app", name: "dashboard" },
    { path: "/app/agenda", name: "agenda" },
    { path: "/app/clientes", name: "clientes" },
    { path: "/app/confirmacoes", name: "confirmacoes" },
  ]) {
    test(`${path} — sem cortes e baseline visual`, async ({ page }) => {
      await page.goto(path);
      // Aguarda saída do skeleton/loader principal antes do snapshot.
      await page
        .locator('main[data-app-main], [data-app-main]')
        .first()
        .waitFor({ state: "visible", timeout: 15_000 });
      await prepareForSnapshot(page);

      // Asserções estruturais antes do diff de pixels.
      await assertNoHorizontalOverflow(page);
      await assertBottomNavVisible(page);
      // Garante que o main reserva padding-bottom >= altura do BottomNav...
      await assertMainHasBottomPadding(page);
      // ...e que, ao rolar até o fim, nada de fato fica oculto atrás da nav.
      await assertContentNotHiddenByBottomNav(page);

      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        // Mascara áreas voláteis: relógio do header, saudações com hora, KPIs
        // que mudam por minuto (criados nos últimos 5 min etc).
        mask: [
          page.locator("[data-volatile]"),
          page.locator("time"),
        ],
      });
    });
  }
});
