/**
 * Visual regression — rotas do portal do cliente.
 *
 * Cobre:
 *  - /portal/acesso (público)
 *  - /portal, /portal/agenda, /portal/perfil (cliente com vínculo ativo)
 *  - /portal (conta autenticada sem vínculo, estado de recuperação)
 */
import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import {
  prepareClientPortalVisualState,
  prepareForSnapshot,
  assertNoHorizontalOverflow,
  assertBottomNavVisible,
  assertMainHasBottomPadding,
  assertBottomNavItemsRespectSafeArea,
  assertOfflineBannerLayout,
  goOffline,
} from "../_helpers/visual";

const AUTH_TIMEOUT = 60_000;
const HAS_CLIENT_PORTAL_AUTH = Boolean(
  process.env.E2E_CLIENT_USER?.trim() && process.env.E2E_CLIENT_PASS?.trim(),
);

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
  test.skip(
    !HAS_CLIENT_PORTAL_AUTH,
    "E2E_CLIENT_USER/E2E_CLIENT_PASS ausentes; a matriz exige o cliente QA vinculado.",
  );
  test.beforeEach(async ({ page }) => {
    await prepareClientPortalVisualState(page);
  });

  test("aviso offline permanece abaixo do header sem cobrir a navegação", async ({ page }) => {
    await page.goto("/portal", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(page.getByTestId("app-main")).toBeVisible({ timeout: 20_000 });

    const restore = await goOffline(page);
    try {
      await prepareForSnapshot(page);
      await assertOfflineBannerLayout(page);
      await assertNoHorizontalOverflow(page);
      await expect(page.locator('[data-bottom-nav][data-app-context="portal"]')).toBeVisible();
      await assertBottomNavItemsRespectSafeArea(page);

      const geometry = await page.evaluate(() => {
        const header = document.querySelector("header");
        const main = document.querySelector('main[data-app-context="portal"]');
        if (!header || !main) return { found: false as const };
        return {
          found: true as const,
          headerBottom: header.getBoundingClientRect().bottom,
          mainTop: main.getBoundingClientRect().top,
        };
      });
      expect(geometry.found, "Header e conteúdo do portal devem estar visíveis").toBe(true);
      if (geometry.found) {
        expect(
          geometry.mainTop,
          "Conteúdo do portal não pode começar sob o header/aviso offline",
        ).toBeGreaterThanOrEqual(geometry.headerBottom - 1);
      }
    } finally {
      await restore();
    }
  });

  for (const { path, name } of [
    { path: "/portal", name: "portal-home" },
    { path: "/portal/agenda", name: "portal-agenda" },
    { path: "/portal/perfil", name: "portal-perfil" },
  ]) {
    test(`${path} — nav portal 4 colunas, safe-area, sem overflow`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});

      // Esta sessão pertence a um cliente real da fixture, não ao owner do app.
      await prepareForSnapshot(page);
      await assertNoHorizontalOverflow(page);
      const main = page.getByTestId("app-main");
      await expect(main).toBeVisible();

      const nav = page.locator('[data-bottom-nav][data-app-context="portal"]');
      const header = page.locator("header").first();
      // Diferente do shell administrativo, o portal mantém a navegação
      // inferior também em tablet; validamos safe-area e alvos nos dois.
      await expect(header).toBeVisible();
      await expect(nav).toBeVisible();
      await assertBottomNavVisible(page);
      await assertMainHasBottomPadding(page);
      await assertBottomNavItemsRespectSafeArea(page);

      const viewport = page.viewportSize();
      expect(viewport, "Viewport Playwright indisponível").not.toBeNull();
      const navGeometry = await nav.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const main = document.querySelector("[data-app-main]");
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          mainPaddingBottom: main
            ? Number.parseFloat(getComputedStyle(main).paddingBottom || "0")
            : 0,
          items: Array.from(element.querySelectorAll<HTMLElement>("a, button")).map((item) => {
            const itemRect = item.getBoundingClientRect();
            return { width: itemRect.width, height: itemRect.height };
          }),
        };
      });
      expect(navGeometry.bottom, "BottomNav deve terminar dentro do viewport").toBeLessThanOrEqual(
        viewport!.height + 1,
      );
      expect(
        navGeometry.mainPaddingBottom,
        "Main deve reservar a altura total da navegação fixa também em tablet",
      ).toBeGreaterThanOrEqual(navGeometry.height - 4);
      expect(navGeometry.items.length, "Portal deve expor quatro alvos primários").toBe(4);
      for (const [index, item] of navGeometry.items.entries()) {
        expect(item.width, `Alvo ${index + 1} deve ter largura clicável mínima`).toBeGreaterThanOrEqual(44);
        expect(item.height, `Alvo ${index + 1} deve ter altura clicável mínima`).toBeGreaterThanOrEqual(44);
      }

      if (path === "/portal/perfil" && viewport!.width < 640) {
        const formGeometry = await page.evaluate(() => {
          const main = document.querySelector("main[data-app-context='portal']");
          const phone = document.querySelector<HTMLInputElement>("#phone");
          const whatsapp = document.querySelector<HTMLInputElement>("#wa");
          const whatsappLabel = document.querySelector<HTMLLabelElement>('label[for="wa"]');
          return {
            mainWidth: main?.getBoundingClientRect().width ?? 0,
            phoneWidth: phone?.getBoundingClientRect().width ?? 0,
            whatsappWidth: whatsapp?.getBoundingClientRect().width ?? 0,
            whatsappLabelHeight: whatsappLabel?.getBoundingClientRect().height ?? 0,
          };
        });
        expect(formGeometry.phoneWidth, "Telefone deve usar largura útil no mobile").toBeGreaterThanOrEqual(
          formGeometry.mainWidth * 0.75,
        );
        expect(formGeometry.whatsappWidth, "WhatsApp deve usar largura útil no mobile").toBeGreaterThanOrEqual(
          formGeometry.mainWidth * 0.75,
        );
        expect(
          formGeometry.whatsappLabelHeight,
          "Rótulo de WhatsApp não deve quebrar em múltiplas linhas no mobile",
        ).toBeLessThanOrEqual(24);
      }

      const initialLayout = await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
        const main = document.querySelector("main[data-app-context='portal']");
        const header = main?.parentElement?.querySelector(":scope > header");
        if (!main || !header) return { found: false as const };
        const headerRect = header.getBoundingClientRect();
        const mainRect = main.getBoundingClientRect();
        return {
          found: true as const,
          headerTop: headerRect.top,
          headerBottom: headerRect.bottom,
          mainTop: mainRect.top,
        };
      });
      expect(initialLayout.found, "Header e main do portal devem existir").toBe(true);
      if (initialLayout.found) {
        expect(initialLayout.headerTop, "Header inicia no topo da página").toBeGreaterThanOrEqual(-1);
        expect(
          initialLayout.mainTop,
          "Conteúdo não pode começar por baixo do header no carregamento inicial",
        ).toBeGreaterThanOrEqual(initialLayout.headerBottom - 1);
      }

      const gridCols = await nav.locator("> div").first().evaluate((el) => {
        return getComputedStyle(el).gridTemplateColumns.split(" ").length;
      });
      expect(gridCols, "Portal nav deve ter 4 colunas").toBe(4);

      // Header e nav são fotografados no estado real, no topo da página. Para
      // capturar o main sem que o scroll automático de screenshot faça o
      // header sticky parecer sobreposto, neutralizamos ambos só durante esta
      // captura; as assertions geométricas acima validam o layout real.
      await expect(header).toHaveScreenshot(`${name}-header.png`);
      await expect(nav).toHaveScreenshot(`${name}-bottom-nav.png`);
      await header.evaluate((element) => {
        (element as HTMLElement).style.position = "static";
      });
      await nav.evaluate((element) => {
        (element as HTMLElement).style.display = "none";
      });
      await expect(main).toHaveScreenshot(`${name}-content.png`);
    });
  }
});

test.describe("portal — estado de vínculo pendente", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("/portal — explica com clareza como vincular uma conta", async ({ page }) => {
    await page.goto("/portal", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await expect(
      page.getByRole("heading", { name: "Acesso ainda não vinculado" }),
    ).toBeVisible({ timeout: 20_000 });
    await prepareForSnapshot(page);
    await assertNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot("portal-link-pending.png", { fullPage: true });
  });
});
