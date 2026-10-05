import { expect, test, type Page } from "@playwright/test";

const baseURL = process.env.E2E_SECURITY_BASE_URL ?? "http://127.0.0.1:18081";

interface AuthRequest {
  method: string;
  url: string;
  body: Record<string, unknown> | null;
}

interface MockAuthResponse {
  status: number;
  body: Record<string, unknown>;
}

async function mockAuthApi(
  page: Page,
  respond: (request: AuthRequest) => MockAuthResponse,
) {
  const requests: AuthRequest[] = [];
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === baseURL) return route.continue();

    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "apikey,authorization,x-client-info,content-type,prefer",
      "content-type": "application/json",
    };
    if (url.pathname.includes("/auth/v1/")) {
      if (request.method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers, body: "" });
      }

      let body: Record<string, unknown> | null = null;
      try {
        body = request.postDataJSON() as Record<string, unknown>;
      } catch {
        // Preserve malformed request evidence as null; assertions below expose it.
      }
      const recorded = { method: request.method(), url: request.url(), body };
      requests.push(recorded);
      const response = respond(recorded);
      return route.fulfill({
        status: response.status,
        headers,
        body: JSON.stringify(response.body),
      });
    }

    if (url.pathname.includes("/rest/v1/")) {
      return route.fulfill({
        status: request.method() === "OPTIONS" ? 204 : 200,
        headers,
        body: request.method() === "OPTIONS" ? "" : "[]",
      });
    }

    // External assets (including web fonts) are deliberately unavailable in this
    // deterministic auth test; the app must retain its local fallback fonts.
    return route.abort();
  });
  return requests;
}

test("login traduz credenciais rejeitadas para uma mensagem segura ao usuário", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const requests = await mockAuthApi(page, (request) => {
    expect(new URL(request.url).pathname).toContain("/auth/v1/token");
    return { status: 400, body: { code: "invalid_credentials", msg: "Invalid login credentials" } };
  });
  await page.goto("/auth/login");

  await page.getByLabel("E-mail Profissional").fill("membro@example.test");
  await page.getByLabel("Senha de Acesso").fill("synthetic-password");
  await page.getByRole("button", { name: "Entrar no Sistema" }).click();

  // WebKit can need a little longer to paint the toast when other browser
  // projects are contending for CPU; keep the assertion strict, but avoid a
  // false failure at the default 5s while the mocked auth response is handled.
  await expect(
    page.getByText("E-mail ou senha incorretos. Confira os dados e tente novamente."),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: "Entrar no Sistema" })).toBeEnabled();
  expect(requests).toHaveLength(1);
  expect(requests[0].method).toBe("POST");
  expect(requests[0].body).toMatchObject({ email: "membro@example.test", password: "synthetic-password" });
  expect(new URL(requests[0].url).searchParams.get("grant_type")).toBe("password");
  expect(requests[0].url).not.toContain("synthetic-password");
  expect(consoleErrors.join("\n")).not.toContain("membro@example.test");
  expect(consoleErrors.join("\n")).not.toContain("synthetic-password");
});

test("recuperação mostra confirmação sem credenciais reais e usa callback local", async ({ page }) => {
  const requests = await mockAuthApi(page, (request) => {
    expect(new URL(request.url).pathname).toContain("/auth/v1/recover");
    return { status: 200, body: {} };
  });
  await page.goto("/auth/recuperar");

  await page.getByLabel("E-mail Cadastrado").fill("membro@example.test");
  await page.getByRole("button", { name: "Enviar Link de Recuperação" }).click();

  await expect(page.getByText("Link enviado com sucesso!")).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].method).toBe("POST");
  expect(requests[0].body).toMatchObject({ email: "membro@example.test" });
  expect(new URL(requests[0].url).searchParams.get("redirect_to")).toBe(`${baseURL}/auth/reset-password`);
});

test("limite de recuperação tem mensagem clara e permite tentar de novo", async ({ page }) => {
  let attempt = 0;
  const requests = await mockAuthApi(page, () => {
    attempt += 1;
    return attempt === 1
      ? { status: 429, body: { message: "over_email_send_rate_limit" } }
      : { status: 200, body: {} };
  });
  await page.goto("/auth/recuperar");

  await page.getByLabel("E-mail Cadastrado").fill("membro@example.test");
  await page.getByRole("button", { name: "Enviar Link de Recuperação" }).click();
  await expect(page.getByText("Muitas tentativas em sequência. Aguarde alguns minutos e tente de novo.")).toBeVisible();

  await page.getByRole("button", { name: "Enviar Link de Recuperação" }).click();
  await expect(page.getByText("Link enviado com sucesso!")).toBeVisible();
  expect(requests).toHaveLength(2);
});
