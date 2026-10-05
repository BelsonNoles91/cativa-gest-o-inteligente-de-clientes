/**
 * Visual regression — rotas públicas (sem auth).
 *
 * Cobre:
 *  - /auth/login (uma das 5 rotas-baseline)
 *
 * As asserções de overflow horizontal e BottomNav rodam em todos os perfis
 * de dispositivo; o screenshot é o "selo" final.
 */
import { test, expect, type Page } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import {
  prepareAuthenticatedVisualState,
  prepareForSnapshot,
  assertNoHorizontalOverflow,
  assertBottomNavVisible,
  assertMainHasBottomPadding,
  assertContentNotHiddenByBottomNav,
  assertBottomNavItemsRespectSafeArea,
  assertCriticalActionsAboveBottomNav,
  resetScrollForFullPageSnapshot,
} from "../_helpers/visual";
import { installAnalyticsVisualFixture } from "../_helpers/analyticsVisualFixture";

const AUTH_VISUAL_TIMEOUT = 60_000;

async function isolateRemoteFonts(page: Page) {
  // These snapshots force local Liberation fonts, so fetching Google Fonts is
  // unnecessary. In particular, the @import at the top of index.css can delay
  // the rest of the stylesheet and make layout assertions observe unstyled DOM.
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css", body: "" }),
  );
}

async function waitForAppStyles(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const hasDesignTokens = Boolean(
            getComputedStyle(document.documentElement)
              .getPropertyValue("--background")
              .trim(),
          );
          const bottomNav =
            document.querySelector<HTMLElement>("[data-bottom-nav]");
          const bottomNavIsStyled =
            !bottomNav || getComputedStyle(bottomNav).position === "fixed";

          return hasDesignTokens && bottomNavIsStyled;
        }),
      {
        message:
          "O CSS principal do app deve estar aplicado antes das medições visuais.",
        timeout: 15_000,
      },
    )
    .toBe(true);
}

async function waitForAuthenticatedShell(page: Page) {
  await page
    .locator('main[data-app-main], [data-app-main]')
    .first()
    .waitFor({ state: "visible", timeout: 20_000 });
}

async function openAuthenticatedVisualRoute(
  page: Page,
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

async function assertSubscriptionPeriodLoaded(
  page: import("@playwright/test").Page,
) {
  for (const label of ["Início do período", "Próxima renovação"]) {
    const value = page
      .getByText(label, { exact: true })
      .locator("xpath=..")
      .locator("[data-volatile]");
    await expect(
      value,
      `A data de "${label}" precisa estar carregada antes de mascarar dados voláteis.`,
    ).toHaveText(/\b\d{4}\b/);
  }
}

async function assertProfileEmailFieldsLoaded(
  page: import("@playwright/test").Page,
) {
  const fields = page.locator('input[data-volatile]');
  await expect(fields).toHaveCount(2);
  const valuesAreValidAndConsistent = await fields.evaluateAll((inputs) => {
    const [current, next] = inputs.map((input) =>
      (input as HTMLInputElement).value,
    );
    return (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(current ?? "") &&
      next === current
    );
  });
  expect(valuesAreValidAndConsistent).toBe(true);
}

test.describe("rotas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("/auth/login — sem overflow e baseline visual", async ({ page }) => {
    await isolateRemoteFonts(page);
    await page.goto("/auth/login");
    await waitForAppStyles(page);
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
  test.beforeEach(async ({ page }) => {
    await isolateRemoteFonts(page);
    await prepareAuthenticatedVisualState(page);
  });

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
      if (name === "analytics") {
        await installAnalyticsVisualFixture(page);
      }
      await openAuthenticatedVisualRoute(page, path);
      await waitForAppStyles(page);
      if (name === "assinatura") {
        await assertSubscriptionPeriodLoaded(page);
      }
      if (name === "perfil") {
        await assertProfileEmailFieldsLoaded(page);
      }
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
      if (name === "waitlist") {
        const tabList = page.getByRole("tablist");
        await expect(tabList.getByRole("tab")).toHaveCount(4);
        const tabsFit = await tabList.evaluate((element) => {
          const bounds = element.getBoundingClientRect();
          const tabs = Array.from(element.querySelectorAll<HTMLElement>('[role="tab"]'));
          return (
            element.scrollWidth <= element.clientWidth &&
            tabs.every((tab) => {
              const tabBounds = tab.getBoundingClientRect();
              return tabBounds.left >= bounds.left && tabBounds.right <= bounds.right;
            })
          );
        });
        expect(tabsFit, "As quatro opções da fila devem caber sem rolagem interna.").toBe(true);
      }

      await resetScrollForFullPageSnapshot(page);
      await expect(page).toHaveScreenshot(`${name}.png`, {
        fullPage: true,
        // Playwright injects this stylesheet during capture; a page-level style
        // can be lost when fullPage expands the viewport.
        stylePath: "e2e/_helpers/full-page-snapshot.css",
      });
    });
  }
});
