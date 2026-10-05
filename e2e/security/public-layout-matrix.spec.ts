import { expect, test, type Page } from "@playwright/test";
import { assertFocusIsVisible, assertLayoutContract } from "../_helpers/layoutContract";
import { prepareForSnapshot } from "../_helpers/visual";

const baseURL = process.env.E2E_SECURITY_BASE_URL ?? "http://127.0.0.1:18081";
const routes = [
  { name: "landing", path: "/" },
  { name: "planos", path: "/planos" },
  { name: "pricing", path: "/pricing" },
  { name: "privacidade", path: "/privacidade" },
  { name: "termos", path: "/termos" },
  { name: "status", path: "/status" },
  { name: "login", path: "/auth/login" },
  { name: "recuperacao", path: "/auth/recuperar" },
  { name: "portal-acesso", path: "/portal/acesso" },
  { name: "pagina-tenant", path: "/e/qa-layout" },
];
const viewports = [
  { name: "mobile-320", width: 320, height: 568 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

async function mockPublicServices(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === baseURL) return route.continue();

    const rpcName = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    if (
      !rpcName ||
      ![
        "get_public_tenant_page",
        "get_public_tenant_timezone",
        "get_public_units",
        "get_public_services",
        "get_public_professionals",
      ].includes(rpcName)
    ) {
      return route.abort();
    }

    const tenant = {
      tenant_id: "qa-tenant-layout",
      name: "Estúdio de teste",
      slug: "qa-layout",
      segment: "beauty",
      headline: "Atendimento com hora marcada",
      about: "Página pública sintética para auditoria geométrica.",
      cover_url: null,
      logo_url: null,
      whatsapp: null,
      instagram: null,
      website: null,
    };
    const data: unknown =
      rpcName === "get_public_tenant_page"
        ? [tenant]
        : rpcName === "get_public_tenant_timezone"
          ? "America/Belem"
          : rpcName === "get_public_units"
            ? [
                {
                  id: "qa-unit-layout",
                  name: "Unidade Centro",
                  phone: "(91) 3333-4444",
                  address: "Rua de Teste, 123",
                  city: "Belém",
                  state: "PA",
                  hours: [],
                },
              ]
            : rpcName === "get_public_services"
              ? [
                  {
                    id: "qa-service-layout",
                    name: "Atendimento de avaliação",
                    description: "Serviço de exemplo para validar a vitrine pública.",
                    duration_minutes: 45,
                    price_cents: 9500,
                    is_featured: true,
                  },
                ]
              : [];

    return route.fulfill({
      status: request.method() === "OPTIONS" ? 204 : 200,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "apikey,authorization,x-client-info,content-type,prefer",
        "content-type": "application/json",
      },
      body: request.method() === "OPTIONS" ? "" : JSON.stringify(data),
    });
  });
}

for (const route of routes) {
  for (const viewport of viewports) {
    test(`${route.name}: geometria e foco em ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockPublicServices(page);
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });

      const response = await page.goto(route.path, { waitUntil: "domcontentloaded" });
      expect(response?.status() ?? 200, `${route.path}: resposta HTTP inesperada`).toBeLessThan(500);
      await prepareForSnapshot(page);
      await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
      await assertLayoutContract(page, `${route.name}-${viewport.name}`, testInfo);

      await page.keyboard.press("Tab").catch(() => undefined);
      const focused = page.locator(":focus").first();
      if (await focused.count()) {
        await focused.scrollIntoViewIfNeeded().catch(() => undefined);
        await assertFocusIsVisible(page, `${route.name}-${viewport.name}`);
      }
    });
  }
}
