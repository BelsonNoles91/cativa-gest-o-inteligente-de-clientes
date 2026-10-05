import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { prepareForSnapshot } from "../_helpers/visual";

const baseURL = process.env.E2E_SECURITY_BASE_URL ?? "http://127.0.0.1:18081";
const routes = [
  { name: "landing", path: "/" },
  { name: "planos", path: "/planos" },
  { name: "privacidade", path: "/privacidade" },
  { name: "termos", path: "/termos" },
  { name: "status", path: "/status" },
  { name: "login", path: "/auth/login" },
  { name: "recuperacao", path: "/auth/recuperar" },
  { name: "portal-acesso", path: "/portal/acesso" },
  { name: "pagina-tenant", path: "/e/qa-security" },
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
      tenant_id: "qa-tenant-a11y",
      name: "Estúdio de teste",
      slug: "qa-security",
      segment: "beauty",
      headline: "Atendimento com hora marcada",
      about: "Página pública sintética para auditoria de acessibilidade.",
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
                  id: "qa-unit-a11y",
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
                    id: "qa-service-a11y",
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
    test(`${route.name}: WCAG 2.2 AA em ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockPublicServices(page);
      await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await prepareForSnapshot(page);

      // Revela conteúdo animado fora da tela antes do scan automatizado.
      await page.evaluate(async () => {
        const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
        for (const y of [0, Math.round(maxScroll / 2), maxScroll, 0]) {
          scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      });
      // Framer Motion can animate opacity with inline styles even when reduced
      // motion is requested. Wait for those transitions to settle so contrast
      // is measured on the rendered end state, not halfway through a fade.
      await page.waitForTimeout(1200);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
        .analyze();
      const summary = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html.slice(0, 180),
          failureSummary: node.failureSummary,
        })),
      }));
      expect(summary, `${route.path} em ${viewport.name}`).toEqual([]);
    });
  }
}
