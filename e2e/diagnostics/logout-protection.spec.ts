import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { getDestructiveE2ESkipReason, getE2ECredentialsSkipReason } from "../_helpers/qaTarget";

// This test injects an authenticated session into the browser context. Disable
// browser traces/media for this file so bearer tokens can never enter artifacts.
test.use({
  storageState: { cookies: [], origins: [] },
  trace: "off",
  screenshot: "off",
  video: "off",
});

test("Logout encerra sessão e impede acesso posterior à área autenticada", async ({ page }) => {
  const targetSkipReason = getDestructiveE2ESkipReason();
  test.skip(Boolean(targetSkipReason), targetSkipReason ?? "Alvo QA local não autorizado.");

  const credentialsSkipReason = getE2ECredentialsSkipReason();
  test.skip(Boolean(credentialsSkipReason), credentialsSkipReason ?? "Credenciais sintéticas ausentes.");

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.E2E_TENANT_B_USER;
  const password = process.env.E2E_TENANT_B_PASS;
  if (!supabaseUrl || !publishableKey || !email || !password) {
    throw new Error("Configuração da conta secundária sintética de QA incompleta.");
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    // Não incluir mensagem, e-mail ou credencial no erro/artefato do runner.
    throw new Error(`Bootstrap da sessão sintética de logout falhou (HTTP ${error?.status ?? "sem resposta"}).`);
  }

  const hostPrefix = new URL(supabaseUrl).hostname.split(".")[0];
  const authStorageKey = `sb-${hostPrefix}-auth-token`;
  const bootstrapMarker = "__cativa_e2e_logout_session_bootstrapped_v1__";
  await page.addInitScript(({ key, session, marker }) => {
    if (location.origin === "null" || sessionStorage.getItem(marker)) return;
    localStorage.setItem(key, JSON.stringify(session));
    localStorage.removeItem("cativa.currentTenantId");
    localStorage.removeItem("cativa.currentUnitId");
    sessionStorage.setItem(marker, "1");
  }, {
    key: authStorageKey,
    session: { ...data.session, user: data.user ?? data.session.user, weak_password: null },
    marker: bootstrapMarker,
  });
  const visibleUserMenuTrigger = page.locator('[data-testid="user-menu-trigger"]:visible');
  const tenantLoadError = page.getByText("Não foi possível carregar seus dados", { exact: true });
  const supabaseOrigin = new URL(supabaseUrl).origin;
  const failedBackendRequests: string[] = [];
  const captureFailedResponse = (response: import("@playwright/test").Response) => {
    const url = new URL(response.url());
    if (url.origin === supabaseOrigin && response.status() >= 400) {
      failedBackendRequests.push(
        `${response.request().method()} ${url.pathname} HTTP ${response.status()}`,
      );
    }
  };
  const captureFailedRequest = (request: import("@playwright/test").Request) => {
    const url = new URL(request.url());
    if (url.origin === supabaseOrigin) {
      failedBackendRequests.push(
        `${request.method()} ${url.pathname} ${request.failure()?.errorText ?? "falha de transporte"}`,
      );
    }
  };
  page.on("response", captureFailedResponse);
  page.on("requestfailed", captureFailedRequest);
  try {
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/app(?:\/|$)/, { timeout: 20_000 });

    // O app oferece recuperação explícita para falha transitória ao resolver
    // tenant/membership. Exercitamos esse retry, sem considerar a tela de erro
    // equivalente a uma sessão autenticada pronta para executar logout.
    await expect
      .poll(
        async () => (await visibleUserMenuTrigger.isVisible()) || (await tenantLoadError.isVisible()),
        { timeout: 20_000, message: "app autenticado pronto ou erro de dados recuperável" },
      )
      .toBe(true);

    if (await tenantLoadError.isVisible()) {
      await page.getByRole("button", { name: "Tentar novamente" }).click();
    }
    await expect(visibleUserMenuTrigger).toBeVisible({ timeout: 20_000 });
  } catch (error) {
    await test.info().attach("diagnostico-inicializacao-logout.json", {
      body: JSON.stringify({ failedBackendRequests }, null, 2),
      contentType: "application/json",
    });
    throw error;
  } finally {
    page.off("response", captureFailedResponse);
    page.off("requestfailed", captureFailedRequest);
  }

  await visibleUserMenuTrigger.click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), authStorageKey)).toBeNull();

  try {
    await page.goto("/app");
  } catch (error) {
    if (!(error instanceof Error) || !/interrupted by another navigation/.test(error.message)) {
      throw error;
    }
  }
  await expect(page).toHaveURL(/\/auth\/login/);
});
