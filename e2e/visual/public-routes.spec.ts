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
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import {
  prepareForSnapshot,
  assertNoHorizontalOverflow,
  assertBottomNavVisible,
  assertMainHasBottomPadding,
  assertContentNotHiddenByBottomNav,
  assertBottomNavItemsRespectSafeArea,
  assertCriticalActionsAboveBottomNav,
} from "../_helpers/visual";

const AUTH_VISUAL_TIMEOUT = 60_000;

async function waitForAuthenticatedShell(page: import("@playwright/test").Page) {
  await page
    .locator('main[data-app-main], [data-app-main]')
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
}

async function openAuthenticatedVisualRoute(
  page: import("@playwright/test").Page,
  path: string,
) {
  await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});

  try {
    await waitForAuthenticatedShell(page);
    return;
  } catch {
    await page.goto("/app", { waitUntil: "commit", timeout: 15_000 });
    await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
    await waitForAuthenticatedShell(page);

    if (path !== "/app") {
      await page.goto(path, { waitUntil: "commit", timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await waitForAuthenticatedShell(page);
    }
  }
}

test.describe("rotas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/auth/login — sem overflow e baseline visual", async ({ page }) => {
    await page.goto("/auth/login");
    await prepareForSnapshot(page);
    await expect(
      page.getByRole("heading", { name: "Bem-vindo de volta" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Entrar no Sistema" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    // BottomNav não existe em login — o helper retorna sem assert se desktop;
    // em mobile o login não tem BottomNav, então pulamos a asserção aqui.
    await expect(page).toHaveScreenshot("login.png", { fullPage: true });
  });
});

test.describe("rotas autenticadas", () => {
  test.describe.configure({ timeout: AUTH_VISUAL_TIMEOUT });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);
  for (const { path, name } of [
    { path: "/app", name: "dashboard" },
    { path: "/app/agenda", name: "agenda" },
    { path: "/app/clientes", name: "clientes" },
    { path: "/app/confirmacoes", name: "confirmacoes" },
    { path: "/app/lista-de-espera", name: "waitlist" },
    { path: "/app/servicos", name: "servicos" },
    { path: "/app/configuracoes", name: "configuracoes" },
    { path: "/app/dados", name: "dados" },
    { path: "/app/perfil", name: "perfil" },
    { path: "/app/analytics", name: "analytics" },
    { path: "/app/pacotes", name: "pacotes" },
    { path: "/app/assinatura", name: "assinatura" },
  ]) {
    test(`${path} — sem cortes e baseline visual`, async ({ page }) => {
      await openAuthenticatedVisualRoute(page, path);
      await prepareForSnapshot(page);

      // Asserções estruturais antes do diff de pixels.
      await assertNoHorizontalOverflow(page);
      await assertBottomNavVisible(page);
      // Garante que o main reserva padding-bottom >= altura do BottomNav...
      await assertMainHasBottomPadding(page);
      // ...e que, ao rolar até o fim, nada de fato fica oculto atrás da nav.
      await assertContentNotHiddenByBottomNav(page);
      // Itens do nav respeitam safe-area (notch landscape, home indicator).
      await assertBottomNavItemsRespectSafeArea(page);
      // Ações críticas marcadas com data-critical-action ficam acima do nav.
      await assertCriticalActionsAboveBottomNav(page);

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
