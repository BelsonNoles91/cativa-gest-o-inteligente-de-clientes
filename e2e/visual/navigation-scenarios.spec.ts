/**
 * Cenários de navegação multi-página + estados transitórios.
 *
 * Objetivo: garantir que safe-area, BottomNav e ações críticas continuam
 * íntegros ao atravessar fluxos reais do usuário, e não apenas em snapshots
 * isolados de cada rota.
 *
 * Fluxo coberto:
 *   1. Home (/app)                  — entrada, valida BottomNav + safe-area
 *   2. Navega para tela longa       — /app/clientes (lista com scroll)
 *   3. Scroll até o fim             — conteúdo não fica oculto pela nav
 *   4. Ativa estado offline         — OfflineBanner não cobre nav
 *   5. Restaura conexão             — layout volta ao normal
 *   6. Volta para Home              — safe-area e nav permanecem corretos
 *   7. Abre o menu "Mais"           — sheet não quebra safe-area inferior
 *
 * Roda apenas em viewports mobile (< 768px) — em desktop/tablet o BottomNav
 * é `md:hidden` e o cenário não se aplica. Os asserts relevantes pulam
 * automaticamente nesses casos.
 */
import { test, expect } from "@playwright/test";
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

test.describe("cenários de navegação — safe-area + BottomNav", () => {
  test("Home → tela longa com scroll → offline → volta", async ({ page }, testInfo) => {
    const vw = page.viewportSize()?.width ?? 0;
    // Em desktop/tablet o BottomNav é md:hidden — cenário não se aplica.
    test.skip(vw >= 768, "BottomNav só existe em viewports < 768px");

    // ---- 1. Home ----
    await page.goto("/app");
    await page
      .locator("[data-app-main]")
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);
    await assertCriticalActionsAboveBottomNav(page);

    // ---- 2. Navega para tela longa (clientes) ----
    // Usa o link do BottomNav (item primário) para simular gesto real.
    const clientesLink = page
      .locator('[data-bottom-nav] a[href="/app/clientes"]')
      .first();
    if (await clientesLink.count()) {
      await clientesLink.click();
    } else {
      // Fallback: navegação direta caso o item não esteja no nav primário.
      await page.goto("/app/clientes");
    }
    await page.waitForURL(/\/app\/clientes/);
    await page
      .locator("[data-app-main]")
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    await prepareForSnapshot(page);

    // Estrutura íntegra após navegação.
    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);

    // ---- 3. Scroll até o fim ----
    await assertContentNotHiddenByBottomNav(page);
    // Reafirma após scroll — nav não pode ter sumido por bug de transform.
    await assertBottomNavVisible(page);
    await assertCriticalActionsAboveBottomNav(page);

    // ---- 4. Ativa offline ----
    const restore = await goOffline(page);
    await assertOfflineBannerLayout(page);
    // Banner não pode quebrar nada do que já validamos.
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

    // ---- 5. Restaura conexão ----
    await restore();
    // Após reconectar, layout volta ao normal (banner some ou vira "restaurada").
    await assertBottomNavVisible(page);
    await assertNoHorizontalOverflow(page);

    // ---- 6. Volta para Home ----
    const homeLink = page
      .locator('[data-bottom-nav] a[href="/app"]')
      .first();
    if (await homeLink.count()) {
      await homeLink.click();
    } else {
      await page.goto("/app");
    }
    await page.waitForURL(/\/app\/?$/);
    await page
      .locator("[data-app-main]")
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    await prepareForSnapshot(page);

    await assertNoHorizontalOverflow(page);
    await assertBottomNavVisible(page);
    await assertMainHasBottomPadding(page);
    await assertBottomNavItemsRespectSafeArea(page);
    await assertCriticalActionsAboveBottomNav(page);
  });

  test('Abrir menu "Mais" não quebra safe-area inferior', async ({ page }) => {
    const vw = page.viewportSize()?.width ?? 0;
    test.skip(vw >= 768, "BottomNav só existe em viewports < 768px");

    await page.goto("/app");
    await page
      .locator("[data-app-main]")
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    await prepareForSnapshot(page);

    const moreButton = page
      .locator('[data-bottom-nav] button[aria-label="Mais opções"]')
      .first();
    // Pode não existir se todos os módulos couberem nos 4 primeiros slots.
    test.skip(
      (await moreButton.count()) === 0,
      'Item "Mais" não presente — todos os módulos cabem no nav primário.',
    );

    await moreButton.click();
    // O Sheet renderiza com role="dialog".
    const sheet = page.locator('[role="dialog"]').first();
    await expect(sheet).toBeVisible();
    await prepareForSnapshot(page);

    // Sheet não pode causar overflow horizontal.
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
      // Procura o último filho clicável e mede o gap até o bottom da viewport.
      const buttons = Array.from(
        dialog.querySelectorAll<HTMLElement>("a, button"),
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });
      if (buttons.length === 0) return { found: true as const, safeBottom, lastBottom: null };
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
      // O último botão clicável deve estar acima da safe-area-inset-bottom
      // (com tolerância de 2px para subpixel).
      const limit = result.viewportH - result.safeBottom + 2;
      expect(
        result.lastBottom,
        `Último item do Sheet (${result.lastBottom}px) ultrapassa o limite ` +
          `de safe-area inferior (${limit}px). Verifique pb-safe no SheetContent.`,
      ).toBeLessThanOrEqual(limit);
    }
  });
});
