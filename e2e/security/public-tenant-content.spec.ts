import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.E2E_SECURITY_BASE_URL ?? "http://127.0.0.1:18081";

function maliciousTenant(website: string | null) {
  return {
    tenant_id: "qa-tenant-security",
    name: "Loja QA <img src=x onerror=window.__cativaXss=1>",
    slug: "qa-security",
    segment: "beauty",
    headline: "<svg onload=window.__cativaXss=2>headline-xss</svg>",
    about: "<script>window.__cativaXss=3</script><img src=x onerror=window.__cativaXss=4>about-xss",
    cover_url: null,
    logo_url: null,
    whatsapp: null,
    instagram: null,
    website,
  };
}

async function mockPublicPage(page: Page, website: string | null) {
  const calls: string[] = [];
  const tenant = maliciousTenant(website);
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "apikey,authorization,x-client-info,content-type,prefer",
    "content-type": "application/json",
  };

  await page.addInitScript(() => {
    Reflect.set(window, "__cativaXss", 0);
  });
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
      calls.push(rpcName ?? `${request.method()} ${url.pathname}`);
      return route.abort();
    }
    calls.push(rpcName);

    const data =
      rpcName === "get_public_tenant_page"
        ? [tenant]
        : rpcName === "get_public_tenant_timezone"
          ? "America/Belem"
          : rpcName === "get_public_units"
            ? []
          : rpcName === "get_public_services"
            ? [
                {
                  id: "qa-service-security",
                  name: "<img src=x onerror=window.__cativaXss=5>service-xss",
                  description: "<svg onload=window.__cativaXss=6>description-xss</svg>",
                  duration_minutes: 30,
                  price_cents: 3500,
                  is_featured: false,
                },
              ]
            : [];

    return route.fulfill({
      status: request.method() === "OPTIONS" ? 204 : 200,
      headers,
      body: request.method() === "OPTIONS" ? "" : JSON.stringify(data),
    });
  });

  return calls;
}

test("exibe conteúdo do tenant como texto, sem interpretar HTML ou executar scripts", async ({ page }) => {
  const calls = await mockPublicPage(page, null);
  await page.goto("/e/qa-security");
  await expect(page.locator("h1")).toContainText("<img src=x onerror=window.__cativaXss=1>");
  await expect(page.locator("body")).toContainText("about-xss");
  await expect(page.locator("body")).toContainText("service-xss");
  await expect(page.locator('img[src="x"], svg[onload]')).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "__cativaXss"))).toBe(0);
  expect(calls).not.toContain("create_public_appointment");
});

test("omite links de site com esquemas executáveis", async ({ page }) => {
  await mockPublicPage(page, "javascript:window.__cativaXss=7");
  await page.goto("/e/qa-security");
  await expect(page.getByRole("link", { name: "Site" })).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "__cativaXss"))).toBe(0);
});

test("preserva links HTTP(S) seguros com isolamento da nova aba", async ({ page }) => {
  await mockPublicPage(page, " https://example.com/booking ");
  await page.goto("/e/qa-security");
  const websiteLink = page.getByRole("link", { name: "Site" });
  await expect(websiteLink).toHaveAttribute("href", "https://example.com/booking");
  await expect(websiteLink).toHaveAttribute("target", "_blank");
  await expect(websiteLink).toHaveAttribute("rel", "noopener noreferrer");
});
