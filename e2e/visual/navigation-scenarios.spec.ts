/**
 * Cenários de navegação multi-página + estados transitórios.
 *
 * Objetivo: garantir que safe-area, BottomNav e ações críticas continuam
 * íntegros ao atravessar fluxos reais do usuário, e não apenas em snapshots
 * isolados de cada rota.
 *
 * Endurecimento de resiliência aplicado:
 *  - Navegação com fallback (link → goto direto se link falhar).
 *  - afterEach garante restore de online state (evita vazamento entre testes).
 *  - Timeouts explícitos em waitForURL e waitFor de elementos.
 *  - Captura de debug-info quando assert principal falha.
 *  - Logs estruturados [e2e] para rastreabilidade em CI.
 *
 * Fluxo coberto:
 *   1. Home (/app)                  — entrada, valida BottomNav + safe-area
 *   2. Navega para tela longa       — /app/clientes (lista com scroll)
 *   3. Scroll até o fim             — conteúdo não fica oculto pela nav
 *   4. Ativa estado offline         — OfflineBanner não cobre nav
 *   5. Restaura conexão             — layout volta ao normal
 *   6. Volta para Home              — safe-area e nav permanecem corretos
 *   7. Abre o menu "Mais"           — sheet não quebra safe-area inferior
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
  goOffline,
  assertOfflineBannerLayout,
} from "../_helpers/visual";
import {
  logStep,
  navigateOrFallback,
  ensureOnline,
  captureDebugInfo,
} from "../_helpers/resilience";

const MAIN_TIMEOUT = 15_000;

/** Aguarda o `<main>` aparecer com timeout explícito + erro útil. */
async function waitForMain(page: import("@playwright/test").Page, route: string) {
  try {
    await page
      .locator("[data-app-main]")
      .first()
      .waitFor({ state: "visible", timeout: MAIN_TIMEOUT });
  } catch (err) {
    const debug = await captureDebugInfo(page, `waitForMain(${route})`);
    throw new Error(
      `[data-app-main] não apareceu em ${MAIN_TIMEOUT}ms na rota ${route}.\n` +
        `Debug: ${JSON.stringify(debug)}\n` +
        `Causa provável: redirect para /auth/login (sessão expirou) ou ` +
        `erro de render no shell. Verifique o storageState e console do app.\n` +
        `Original: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

test.describe("cenários de navegação — safe-area + BottomNav", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  // Garante que estado offline NUNCA vaza para o próximo teste.
  test.afterEach(async ({ context }) => {
    await ensureOnline(context);
  });

  test("Home → tela longa com scroll → offline → volta", async ({ page }, testInfo) => {
    const vw = page.viewportSize()?.width ?? 0;
    test.skip(vw >= 768, "BottomNav só existe em viewports < 768px");
    const scenario = testInfo.title;

    // ---- 1. Home ----
    logStep(scenario, "1.goto /app");
    await page.goto("/app", { waitUntil: "domcontentloaded", timeout: MAIN_TIMEOUT });
    await waitForMain(page, "/app");
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);
    await assertCriticalActionsAboveBottomNav(page);

    // ---- 2. Navega para tela longa (clientes) ----
    logStep(scenario, "2.navegar para /app/clientes");
    await navigateOrFallback(page, {
      label: "nav-clientes",
      // Preferimos data-route (testid estável) ao href absoluto.
      clickSelector:
        '[data-testid="bottom-nav-item"][data-route="app-clientes"], [data-bottom-nav] a[href="/app/clientes"]',
      fallbackUrl: "/app/clientes",
      expectedUrlRegex: /\/app\/clientes/,
      timeoutMs: MAIN_TIMEOUT,
    });
    await waitForMain(page, "/app/clientes");
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);

    // ---- 3. Scroll até o fim ----
    logStep(scenario, "3.scroll até o fim");
    await assertContentNotHiddenByBottomNav(page);
    await assertBottomNavVisible(page);
    await assertCriticalActionsAboveBottomNav(page);

    // ---- 4. Ativa offline ----
    logStep(scenario, "4.offline");
    const restore = await goOffline(page);
    try {
      await assertOfflineBannerLayout(page);
      await assertNoHorizontalOverflow(page);
      await assertBottomNavVisible(page);
      await assertBottomNavItemsRespectSafeArea(page);
      await assertCriticalActionsAboveBottomNav(page);

      // Snapshot do estado offline em tela longa (apenas no perfil principal
      // para não inflar a baseline em todos os 5 dispositivos).
      if (testInfo.project.name === "iphone-14-portrait") {
        await expect(page).toHaveScreenshot("scenario-clientes-offline.png", {
          fullPage: false,
          mask: [page.locator("[data-volatile]"), page.locator("time")],
        });
      }
    } finally {
      // Restaura SEMPRE — mesmo se asserts falharem — para não vazar estado.
      logStep(scenario, "5.restore online");
      await restore();
    }

    await assertBottomNavVisible(page);
    await assertNoHorizontalOverflow(page);

    // ---- 6. Volta para Home ----
    logStep(scenario, "6.volta para /app");
    await navigateOrFallback(page, {
      label: "nav-home",
      clickSelector:
        '[data-testid="bottom-nav-item"][data-route="app"], [data-bottom-nav] a[href="/app"]',
      fallbackUrl: "/app",
      expectedUrlRegex: /\/app\/?$/,
      timeoutMs: MAIN_TIMEOUT,
    });
    await waitForMain(page, "/app");
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);
    await assertCriticalActionsAboveBottomNav(page);
  });

  test('Abrir menu "Mais" não quebra safe-area inferior', async ({ page }, testInfo) => {
    const vw = page.viewportSize()?.width ?? 0;
    test.skip(vw >= 768, "BottomNav só existe em viewports < 768px");
    const scenario = testInfo.title;

    logStep(scenario, "goto /app");
    await page.goto("/app", { waitUntil: "domcontentloaded", timeout: MAIN_TIMEOUT });
    await waitForMain(page, "/app");
    await prepareForSnapshot(page);

    const moreButton = page
      .locator(
        '[data-testid="bottom-nav-more"], [data-bottom-nav] button[aria-label="Mais opções"]',
      )
      .first();
    test.skip(
      (await moreButton.count()) === 0,
      'Item "Mais" não presente — todos os módulos cabem no nav primário.',
    );

    logStep(scenario, "abrir sheet 'Mais'");
    try {
      await moreButton.click({ timeout: 3000 });
    } catch (err) {
      const debug = await captureDebugInfo(page, "click 'Mais'");
      throw new Error(
        `Não consegui clicar em 'Mais opções'. Debug: ${JSON.stringify(debug)}\n` +
          `Original: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const sheet = page
      .locator('[data-testid="bottom-nav-sheet"], [role="dialog"]')
      .first();
    try {
      await expect(sheet).toBeVisible({ timeout: 3000 });
    } catch (err) {
      throw new Error(
        `Sheet do menu 'Mais' não abriu em 3s. Pode indicar regressão no ` +
          `componente Sheet/Radix.\n` +
          `Original: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);

    // O conteúdo do sheet deve respeitar a safe-area inferior (pb-safe).
    const result = await page.evaluate(() => {
      // Probe de safe-area-inset-bottom.
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;bottom:0;left:0;height:0;width:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden";
      document.body.appendChild(probe);
      const safeBottom = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
      probe.remove();

      const dialog = document.querySelector(
        '[role="dialog"]',
      ) as HTMLElement | null;
      if (!dialog) return { found: false as const };
      const buttons = Array.from(
        dialog.querySelectorAll<HTMLElement>("a, button"),
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (buttons.length === 0) {
        return { found: true as const, safeBottom, lastBottom: null, viewportH: window.innerHeight };
      }
      const lastBottom = Math.max(
        ...buttons.map((b) => b.getBoundingClientRect().bottom),
      );
      return {
        found: true as const,
        safeBottom,
        lastBottom,
        viewportH: window.innerHeight,
      };
    });

    expect(result.found, '[role="dialog"] do Sheet "Mais" não encontrado').toBe(
      true,
    );
    if (result.found && result.lastBottom !== null) {
      const limit = result.viewportH - result.safeBottom + 2;
      expect(
        result.lastBottom,
        `Último item do Sheet (${result.lastBottom}px) ultrapassa o limite ` +
          `de safe-area inferior (${limit}px). Verifique pb-safe no SheetContent.`,
      ).toBeLessThanOrEqual(limit);
    }
  });
});
