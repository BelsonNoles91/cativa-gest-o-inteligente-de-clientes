import { expect, test } from "@playwright/test";
import { Buffer } from "node:buffer";

const providers = [
  { id: "google", label: "Continuar com Google" },
  { id: "apple", label: "Continuar com Apple" },
] as const;

test.describe("Contrato local de início de OAuth", () => {
  for (const provider of providers) {
    test(`${provider.id} envia provider, callback e state sem credenciais reais`, async ({ page, baseURL }) => {
      await page.route("**/*", async (route) => {
        const requestUrl = new URL(route.request().url());
        if (requestUrl.origin === new URL(baseURL!).origin) {
          await route.continue();
          return;
        }
        await route.abort("blockedbyclient");
      });

      await page.route("**/rest/v1/rpc/get_public_system_flags", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            enable_signups: true,
            maintenance_mode: false,
            show_cativa_index: true,
          }),
        });
      });

      await page.route(/\/~oauth\/initiate(?:\?.*)?$/, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>OAuth sandbox</title></head><body>OAuth sandbox started</body></html>",
        });
      });

      await page.goto("/auth/login");
      const slashBackslashOrigin = await page.evaluate(() =>
        new URL("/\\attacker.example/collect", window.location.origin).origin,
      );
      expect(slashBackslashOrigin).not.toBe(new URL(baseURL!).origin);
      await page.getByRole("button", { name: provider.label }).click();
      await expect(page).toHaveURL(/\/~oauth\/initiate\?/);

      const authorizationRequest = new URL(page.url());
      expect(authorizationRequest.searchParams.get("provider")).toBe(provider.id);
      expect(authorizationRequest.searchParams.get("redirect_uri")).toBe(new URL(baseURL!).origin);
      expect(authorizationRequest.searchParams.get("state")).toMatch(/^[a-f0-9]{32}$/);
      expect([...authorizationRequest.searchParams.keys()].sort()).toEqual([
        "provider",
        "redirect_uri",
        "state",
      ]);
      await expect(page.getByText("OAuth sandbox started")).toBeVisible();
      expect(await page.evaluate(() => sessionStorage.getItem("cativa:auth_redirect"))).toBe("/app");
    });
  }
});

test("callback OAuth sintético consome o fragmento e retorna ao caminho local autorizado", async ({ page, baseURL }) => {
  const now = Math.floor(Date.now() / 1000);
  const userId = "00000000-0000-4000-8000-000000000091";
  const accessToken = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url"),
    Buffer.from(JSON.stringify({
      sub: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "oauth-fixture@example.test",
      exp: now + 3600,
      iat: now,
      app_metadata: { provider: "google", providers: ["google"] },
      user_metadata: { full_name: "Fixture OAuth" },
      session_id: "00000000-0000-4000-8000-000000000092",
      iss: "http://cativa-oauth.invalid/auth/v1",
    })).toString("base64url"),
    "synthetic-signature-not-valid-outside-this-test",
  ].join(".");
  const refreshToken = "synthetic-refresh-token-not-a-credential";
  const authorizedUserRequests: string[] = [];
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "apikey,authorization,x-client-info,content-type,prefer",
    "content-type": "application/json",
  };

  await page.addInitScript(() => {
    sessionStorage.setItem("cativa:auth_redirect", "/planos");
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(baseURL!).origin) return route.continue();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers, body: "" });

    if (url.pathname.endsWith("/auth/v1/user")) {
      const authorization = request.headers().authorization ?? "";
      authorizedUserRequests.push(authorization);
      if (authorization !== `Bearer ${accessToken}`) {
        return route.fulfill({ status: 401, headers, body: JSON.stringify({ message: "invalid token" }) });
      }
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          id: userId,
          aud: "authenticated",
          role: "authenticated",
          email: "oauth-fixture@example.test",
          email_confirmed_at: new Date(now * 1000).toISOString(),
          app_metadata: { provider: "google", providers: ["google"] },
          user_metadata: { full_name: "Fixture OAuth" },
          identities: [],
          created_at: new Date(now * 1000).toISOString(),
          updated_at: new Date(now * 1000).toISOString(),
        }),
      });
    }

    const rpcName = url.pathname.match(/\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
    if (rpcName === "get_public_system_flags") {
      return route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ enable_signups: true, maintenance_mode: false, show_cativa_index: true }),
      });
    }
    if (url.pathname.includes("/rest/v1/")) {
      return route.fulfill({ status: 200, headers, body: "[]" });
    }
    return route.abort("blockedbyclient");
  });

  await page.goto("/#access_token=" + encodeURIComponent(accessToken)
    + "&refresh_token=" + encodeURIComponent(refreshToken)
    + "&expires_in=3600&token_type=bearer");
  await expect(page).toHaveURL(/\/planos$/);
  await expect(page.getByText("Planos & Preços")).toBeVisible();

  const callbackState = await page.evaluate((expectedToken) => ({
    authRedirect: sessionStorage.getItem("cativa:auth_redirect"),
    tokenStillInUrl: location.href.includes(expectedToken),
    sessionPersisted: Object.values(localStorage).some((value) => value.includes(expectedToken)),
  }), accessToken);
  expect(callbackState).toEqual({ authRedirect: null, tokenStillInUrl: false, sessionPersisted: true });
  expect(authorizedUserRequests).toEqual([`Bearer ${accessToken}`]);
});
