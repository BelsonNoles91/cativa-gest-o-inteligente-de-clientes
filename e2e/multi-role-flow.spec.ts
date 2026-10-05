import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { getDestructiveE2ESkipReason } from "./_helpers/qaTarget";

/**
 * Jornadas de navegação por papel. Os CRUDs completos ficam nas specs de
 * diagnóstico dedicadas; aqui validamos as rotas operacionais e as ações que
 * cada papel deve conseguir iniciar, sem depender de seletores inventados.
 */
test.describe("Fluxo multi-papel (owner, frontdesk e professional)", () => {
  // Cada cenário autentica uma conta diferente, sem herdar a sessão do setup.
  test.use({ storageState: { cookies: [], origins: [] } });

  async function loginAs(
    page: Page,
    email: string | undefined,
    password: string | undefined,
    role: string,
  ) {
    const skipReason =
      getDestructiveE2ESkipReason() ??
      (!email?.trim() || !password?.trim()
        ? `Credenciais E2E de ${role} ausentes; nenhuma conta fictícia será usada.`
        : undefined);
    test.skip(Boolean(skipReason), skipReason);

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const tenantSlug = process.env.E2E_TENANT_SLUG;
    if (!supabaseUrl || !publishableKey || !tenantSlug) {
      throw new Error("Configuração local de autenticação/perfil QA incompleta.");
    }

    // Esta spec mede autorização e jornadas por perfil, não a UI de login
    // (coberta pelas suítes de autenticação com mocks e sessão vazia).
    const supabase = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await supabase.auth.signInWithPassword({ email: email!, password: password! });
    if (error || !data.session || !data.user) {
      throw new Error(`Login QA direto falhou para o perfil ${role}: ${error?.status ?? "sessão ausente"}`);
    }

    const { data: membership, error: membershipError } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, status, tenants!inner(slug)")
      .eq("user_id", data.user.id)
      .eq("status", "active")
      .eq("tenants.slug", tenantSlug)
      .single();
    if (membershipError) throw membershipError;
    if (membership.role !== role) {
      throw new Error(`Fixture de ${role} autenticou com papel ${membership.role}.`);
    }

    const projectId = process.env.VITE_SUPABASE_PROJECT_ID;
    let storageKey = "sb-project-auth-token";
    if (projectId) storageKey = `sb-${projectId}-auth-token`;
    else {
      try {
        storageKey = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
      } catch {
        // Mantém a chave de fallback; a navegação mostrará o diagnóstico caso esteja incorreta.
      }
    }
    await page.addInitScript(
      ({ key, session, user, tenantId }) => {
        window.localStorage.clear();
        window.localStorage.setItem(key, JSON.stringify({ ...session, user, weak_password: null }));
        window.localStorage.setItem("cativa.currentTenantId", tenantId);
      },
      { key: storageKey, session: data.session, user: data.user, tenantId: membership.tenant_id },
    );

    await page.goto("/app");
    await expect(page).toHaveURL(/\/app(?:\/|$)/, { timeout: 20_000 });
    await page.locator("[data-app-main]").first().waitFor({ state: "visible" });
    // Evita que o ponteiro simulado mantenha o toast de login sob hover.
    await page.mouse.move(1, 1);
  }

  async function openRoute(page: Page, route: string, heading: string) {
    await page.goto(route);
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }

  test("Owner acessa configurações e catálogo de serviços", async ({ page }) => {
    await loginAs(page, process.env.E2E_USER, process.env.E2E_PASS, "owner");

    await openRoute(page, "/app/configuracoes", "Configurações");
    await expect(page.getByTestId("settings-tab-business")).toBeVisible();

    await openRoute(page, "/app/servicos", "Serviços");
    await expect(page.getByRole("button", { name: "Novo serviço" })).toBeVisible();
  });

  test("Frontdesk acessa CRM e inicia a operação da agenda", async ({ page }) => {
    await loginAs(
      page,
      process.env.E2E_FRONTDESK_USER,
      process.env.E2E_FRONTDESK_PASS,
      "frontdesk",
    );

    await openRoute(page, "/app/clientes", "Clientes");
    await expect(page.getByTestId("clients-create-cta")).toBeVisible();

    await openRoute(page, "/app/agenda", "Agenda");
    await expect(page.getByRole("button", { name: "Novo agendamento" })).toBeVisible();
  });

  test("Professional acessa agenda da unidade e sua disponibilidade", async ({ page }) => {
    await loginAs(
      page,
      process.env.E2E_PROFESSIONAL_USER,
      process.env.E2E_PROFESSIONAL_PASS,
      "professional",
    );

    // Regra do produto: o profissional pode consultar a agenda da unidade;
    // a agenda pessoal é a área para editar sua disponibilidade.
    await openRoute(page, "/app/agenda", "Agenda");
    await expect(
      page.getByRole("combobox", { name: "Filtrar por profissional" }),
    ).toContainText("Todos os profissionais");

    await openRoute(page, "/app/minha-agenda", "Minha agenda");
    await expect(page.getByRole("heading", { name: "Novo horário de atendimento" })).toBeVisible();
  });
});
