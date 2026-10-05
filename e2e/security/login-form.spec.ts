import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.E2E_SECURITY_BASE_URL ?? "http://127.0.0.1:18081";

async function blockExternalServices(page: Page, authRequests: string[]) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === baseURL) return route.continue();

    if (url.pathname.includes("/auth/v1/")) {
      authRequests.push(`${request.method()} ${url.pathname}`);
      return route.abort();
    }

    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "apikey,authorization,x-client-info,content-type,prefer",
      "content-type": "application/json",
    };
    return route.fulfill({
      status: request.method() === "OPTIONS" ? 204 : 200,
      headers,
      body: request.method() === "OPTIONS" ? "" : "[]",
    });
  });
}

test("login bloqueia campos ausentes ou email inválido antes de chamar autenticação", async ({ page }) => {
  const authRequests: string[] = [];
  await blockExternalServices(page, authRequests);
  await page.goto("/auth/login");

  const email = page.getByLabel("E-mail Profissional");
  const password = page.getByLabel("Senha de Acesso");
  const submit = page.getByRole("button", { name: "Entrar no Sistema" });
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();

  await submit.click();
  expect(await email.evaluate((element: HTMLInputElement) => element.validity.valueMissing)).toBe(true);
  expect(await authRequests).toEqual([]);

  await email.fill("not-an-email");
  await password.fill("synthetic-password");
  await submit.click();
  expect(await email.evaluate((element: HTMLInputElement) => element.validity.typeMismatch)).toBe(true);
  expect(await authRequests).toEqual([]);
});

test("controle de mostrar senha é focável, operável pelo teclado e tem alvo de 44px", async ({ page }) => {
  const authRequests: string[] = [];
  await blockExternalServices(page, authRequests);
  await page.goto("/auth/login");

  const password = page.getByLabel("Senha de Acesso");
  const showPassword = page.getByRole("button", { name: "Mostrar senha" });
  await password.focus();
  await page.keyboard.press("Tab");
  await expect(showPassword).toBeFocused();
  await expect(showPassword).toHaveAttribute("aria-controls", "password");
  await expect(showPassword).toHaveAttribute("aria-pressed", "false");
  await expect(showPassword).toHaveClass(/focus-visible:ring-2/);

  const bounds = await showPassword.boundingBox();
  expect(bounds?.width).toBeGreaterThanOrEqual(44);
  expect(bounds?.height).toBeGreaterThanOrEqual(44);

  await page.keyboard.press("Enter");
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Ocultar senha" })).toHaveAttribute("aria-pressed", "true");
  expect(authRequests).toEqual([]);
});
