import { test, expect, type Page } from "@playwright/test";
import { HAS_E2E_AUTH, AUTH_SKIP_REASON } from "../_helpers/auth";
import {
  prepareAuthenticatedVisualState,
  prepareClientPortalVisualState,
  prepareForSnapshot,
} from "../_helpers/visual";
import { assertFocusIsVisible, assertLayoutContract } from "../_helpers/layoutContract";
import { assertPublicBackendWasIsolated, mockPublicBackend } from "../_helpers/publicMocks";

const PUBLIC_ROUTES = [
  { path: "/", name: "landing" },
  { path: "/planos", name: "planos" },
  { path: "/pricing", name: "pricing" },
  { path: "/privacidade", name: "privacidade" },
  { path: "/termos", name: "termos" },
  { path: "/status", name: "status" },
  { path: "/auth/login", name: "login" },
  { path: "/auth/recuperar", name: "recuperar" },
  { path: "/portal/acesso", name: "portal-acesso" },
];

const AUTHENTICATED_ROUTES = [
  { path: "/app", name: "app-dashboard" },
  { path: "/app/agenda", name: "app-agenda" },
  { path: "/app/clientes", name: "app-clientes" },
  { path: "/app/confirmacoes", name: "app-confirmacoes" },
  { path: "/app/lista-de-espera", name: "app-waitlist" },
  { path: "/app/servicos", name: "app-servicos" },
  { path: "/app/analytics", name: "app-analytics" },
  { path: "/app/configuracoes", name: "app-configuracoes" },
  { path: "/app/assinatura", name: "app-assinatura" },
  { path: "/portal", name: "portal-home" },
  { path: "/portal/agenda", name: "portal-agenda" },
  { path: "/portal/perfil", name: "portal-perfil" },
];

async function settle(page: Page) {
  await page.waitForLoadState("domcontentloaded").catch(() => undefined);
  await prepareForSnapshot(page);
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
}

async function exerciseKeyboard(page: Page, label: string) {
  await page.keyboard.press("Tab").catch(() => undefined);
  await page.locator(":focus").first().scrollIntoViewIfNeeded().catch(() => undefined);
  await assertFocusIsVisible(page, label);
  await page.keyboard.press("Tab").catch(() => undefined);
  await page.locator(":focus").first().scrollIntoViewIfNeeded().catch(() => undefined);
  await assertFocusIsVisible(page, label);
}

test.describe("layout matrix — rotas públicas", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ page }) => mockPublicBackend(page));
  test.afterEach(async ({ page }) => assertPublicBackendWasIsolated(page));

  for (const route of PUBLIC_ROUTES) {
    test(`${route.name}: overflow, clipping, foco e layout`, async ({ page }, testInfo) => {
      const response = await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      expect(response?.status() ?? 200, `${route.path}: resposta HTTP inesperada`).toBeLessThan(500);
      await settle(page);
      await assertLayoutContract(page, route.name, testInfo);
      await exerciseKeyboard(page, route.name);

      if (route.path === "/auth/login" || route.path === "/portal/acesso") {
        const submit = page.locator('button[type="submit"]').first();
        if (await submit.count()) {
          await submit.click().catch(() => undefined);
          await settle(page);
          await assertLayoutContract(page, `${route.name}-validation`, testInfo);
        }
      }

      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, left: 0, behavior: "instant" }));
      await assertLayoutContract(page, `${route.name}-bottom`, testInfo);
    });
  }
});

test.describe("layout matrix — rotas autenticadas", () => {
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test.beforeEach(async ({ page }) => {
    await prepareAuthenticatedVisualState(page);
  });

  for (const route of AUTHENTICATED_ROUTES) {
    test(`${route.name}: shell, conteúdo, navegação e estados`, async ({ page }, testInfo) => {
      if (route.path.startsWith("/portal")) {
        await prepareClientPortalVisualState(page);
      }
      await page.goto(route.path, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await settle(page);
      await assertLayoutContract(page, route.name, testInfo);
      await exerciseKeyboard(page, route.name);

      const main = page.locator("[data-app-main], main").first();
      if (await main.count()) {
        await main.evaluate((element) => element.scrollIntoView({ block: "end" })).catch(() => undefined);
        await assertLayoutContract(page, `${route.name}-scrolled`, testInfo);
      }

      const dialogTrigger = page.locator(
        '[data-layout-dialog-trigger], [data-testid="agenda-create-cta"], [data-testid="clients-create-cta"]',
      ).first();
      if (await dialogTrigger.isVisible().catch(() => false)) {
        await dialogTrigger.click();
        await settle(page);
        await assertLayoutContract(page, `${route.name}-dialog`, testInfo);
        await page.keyboard.press("Escape").catch(() => undefined);
      }
    });
  }

  test("clients-dialog-resize: dialog e ação final permanecem acessíveis ao redimensionar", async ({ page }, testInfo) => {
    await page.goto("/app/clientes", { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.locator("[data-app-main]").first().waitFor({ state: "visible", timeout: 20_000 });

    const trigger = page.getByTestId("clients-create-cta");
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeEnabled();
    await trigger.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const initialPath = new URL(page.url()).pathname;
    const nameInput = dialog.getByTestId("client-form-full-name");
    await nameInput.fill("QA viewport probe");
    const viewports = [
      { width: 1440, height: 900, name: "desktop" },
      { width: 1024, height: 768, name: "notebook" },
      { width: 768, height: 1024, name: "tablet-portrait" },
      { width: 568, height: 320, name: "mobile-landscape" },
      { width: 390, height: 844, name: "mobile" },
      { width: 320, height: 568, name: "mobile-narrow" },
      { width: 1280, height: 720, name: "desktop-short" },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      await expect(dialog, `${viewport.name}: o modal deve continuar aberto`).toBeVisible();
      await expect(nameInput, `${viewport.name}: resize não deve descartar o formulário`).toHaveValue("QA viewport probe");

      const focusRemainsInDialog = await dialog.evaluate((element) =>
        element.contains(document.activeElement),
      );
      expect(focusRemainsInDialog, `${viewport.name}: foco saiu do modal ao redimensionar`).toBe(true);

      const submit = dialog.getByRole("button", { name: "Cadastrar cliente" });
      await submit.scrollIntoViewIfNeeded();
      const submitBox = await submit.boundingBox();
      expect(submitBox, `${viewport.name}: ação final sem bounding box`).not.toBeNull();
      expect(submitBox!.x, `${viewport.name}: ação final cortada à esquerda`).toBeGreaterThanOrEqual(-1);
      expect(submitBox!.x + submitBox!.width, `${viewport.name}: ação final cortada à direita`).toBeLessThanOrEqual(viewport.width + 1);
      expect(submitBox!.y, `${viewport.name}: ação final fora do topo`).toBeGreaterThanOrEqual(-1);
      expect(submitBox!.y + submitBox!.height, `${viewport.name}: ação final fora da base`).toBeLessThanOrEqual(viewport.height + 1);

      if (viewport.width < 640) {
        const undersizedTargets = await dialog.locator(
          'button, [role="combobox"], [role="switch"], [role="tab"], input:not([type="checkbox"]):not([type="radio"]):not([type="hidden"]), select, textarea, a[href]',
        ).evaluateAll((elements) => elements.flatMap((element) => {
          const node = element as HTMLElement;
          if (node.getClientRects().length === 0) return [];
          const rect = node.getBoundingClientRect();
          return rect.width < 43.5 || rect.height < 43.5
            ? [{ tag: node.tagName.toLowerCase(), testId: node.dataset.testid ?? null, width: rect.width, height: rect.height }]
            : [];
        }));
        expect(undersizedTargets, `${viewport.name}: controles do modal menores que 44×44 px`).toEqual([]);
      }

      await assertLayoutContract(page, `clients-dialog-resize-${viewport.name}`, testInfo);
      expect(new URL(page.url()).pathname, `${viewport.name}: resize não deve navegar/recarregar a rota`).toBe(initialPath);
      await dialog.evaluate((element) => { element.scrollTop = 0; });
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });
});

test.describe("layout matrix — fronteiras de breakpoint", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.beforeEach(async ({ page }) => mockPublicBackend(page));
  test.afterEach(async ({ page }) => assertPublicBackendWasIsolated(page));

  test("767/768, 1023/1024 e 1279/1280 preservam o contrato", async ({ page }, testInfo) => {
    test.skip(Boolean(process.env.E2E_BASE_URL && process.env.E2E_LAYOUT_SKIP_BREAKPOINTS), "breakpoints desabilitados pelo ambiente");
    await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
    for (const viewport of [
      { width: 767, height: 800 },
      { width: 768, height: 800 },
      { width: 1023, height: 768 },
      { width: 1024, height: 768 },
      { width: 1279, height: 800 },
      { width: 1280, height: 800 },
    ]) {
      await page.setViewportSize(viewport);
      await settle(page);
      await assertLayoutContract(page, `breakpoint-${viewport.width}`, testInfo);
    }
  });
});
