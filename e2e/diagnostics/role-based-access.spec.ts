import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { getDestructiveE2ESkipReason } from "../_helpers/qaTarget";

type TenantRole = "owner" | "manager" | "frontdesk" | "professional";
type QaRole = TenantRole | "client" | "super_admin";

type QaProfile = {
  label: QaRole;
  email: string;
  password: string;
};

type Membership = {
  tenant_id: string;
  role: QaRole;
  status: string;
  tenants: { slug: string } | null;
};

type RouteContract = {
  path: string;
  roles: QaRole[];
};

function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function env(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function tokenStorageKey(supabaseUrl: string) {
  const configuredProjectId = env("VITE_SUPABASE_PROJECT_ID");
  if (configuredProjectId) return `sb-${configuredProjectId}-auth-token`;
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token`;
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const SUPABASE_URL = env("VITE_SUPABASE_URL");
const PUBLISHABLE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const E2E_TENANT_SLUG = env("E2E_TENANT_SLUG");
const LOCAL_QA_TARGET = (() => {
  if (
    process.env.E2E_LOCAL_SUPABASE !== "true" ||
    process.env.E2E_QA_PROJECT_REF !== "local" ||
    process.env.E2E_TARGET_ALLOWLIST !== "local" ||
    !SUPABASE_URL
  ) return false;
  try {
    const url = new URL(SUPABASE_URL);
    return url.protocol === "http:" && new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname);
  } catch {
    return false;
  }
})();

const PROFILES: QaProfile[] = [
  { label: "owner", email: env("E2E_USER"), password: env("E2E_PASS") },
  { label: "manager", email: env("E2E_MANAGER_USER"), password: env("E2E_MANAGER_PASS") },
  {
    label: "frontdesk",
    email: env("E2E_FRONTDESK_USER"),
    password: env("E2E_FRONTDESK_PASS"),
  },
  {
    label: "professional",
    email: env("E2E_PROFESSIONAL_USER"),
    password: env("E2E_PROFESSIONAL_PASS"),
  },
  { label: "client", email: env("E2E_CLIENT_USER"), password: env("E2E_CLIENT_PASS") },
  {
    label: "super_admin",
    email: env("E2E_SUPER_ADMIN_USER"),
    password: env("E2E_SUPER_ADMIN_PASS"),
  },
];

const HAS_ROLE_FIXTURES = Boolean(
  SUPABASE_URL &&
    PUBLISHABLE_KEY &&
    E2E_TENANT_SLUG &&
    PROFILES.every((profile) => profile.email && profile.password),
);
const QA_TARGET_SKIP_REASON = getDestructiveE2ESkipReason();

const TENANT_ROLES: TenantRole[] = ["owner", "manager", "frontdesk", "professional"];
const STAFF_ROUTE_CONTRACT: RouteContract[] = [
  { path: "/app", roles: TENANT_ROLES },
  { path: "/app/agenda", roles: TENANT_ROLES },
  { path: "/app/clientes", roles: ["owner", "manager", "frontdesk"] },
  { path: "/app/confirmacoes", roles: ["owner", "manager", "frontdesk"] },
  { path: "/app/lista-de-espera", roles: ["owner", "manager", "frontdesk"] },
  { path: "/app/minha-agenda", roles: ["owner", "manager", "professional"] },
  { path: "/app/perfil", roles: TENANT_ROLES },
  { path: "/app/retorno", roles: ["owner", "manager", "frontdesk"] },
  { path: "/app/painel-gestor/clientes", roles: ["owner", "manager", "frontdesk"] },
  { path: "/app/avaliacoes", roles: ["owner", "manager", "frontdesk"] },
  { path: "/app/painel-gestor", roles: ["owner", "manager"] },
  { path: "/app/comissoes", roles: ["owner", "manager"] },
  { path: "/app/metas", roles: ["owner", "manager"] },
  { path: "/app/servicos", roles: ["owner", "manager"] },
  { path: "/app/pacotes", roles: ["owner", "manager"] },
  { path: "/app/analytics", roles: ["owner", "manager"] },
  { path: "/app/meu-plano", roles: ["owner", "manager"] },
  { path: "/app/assinatura", roles: ["owner", "manager"] },
  { path: "/app/dados", roles: ["owner", "manager"] },
  { path: "/app/configuracoes", roles: ["owner", "manager"] },
  { path: "/app/super-admin", roles: ["super_admin"] },
];

const CLIENT_PORTAL_ROUTES = [
  "/portal",
  "/portal/agenda",
  "/portal/agendar",
  "/portal/historico",
  "/portal/pacotes",
  "/portal/perfil",
  "/portal/anamnese",
];

const routedPages = new WeakSet<Page>();

function createSupabase() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function resolveQaTenantId(supabase: SupabaseClient) {
  if (!E2E_TENANT_SLUG) throw new Error("E2E_TENANT_SLUG não configurado.");
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug")
    .eq("slug", E2E_TENANT_SLUG)
    .single();
  if (error) throw error;
  return { tenantId: data.id, slug: data.slug };
}

async function signInProfile(profile: QaProfile) {
  const supabase = createSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: profile.password,
  });
  if (error || !data.session || !data.user) {
    throw new Error(`Login QA falhou para ${profile.label}: ${error?.message ?? "sessão ausente"}`);
  }

  let membership: Membership;
  if (profile.label === "super_admin") {
    const { data: globalProfile, error: profileError } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", data.user.id)
      .single();
    if (profileError) throw profileError;
    if (!globalProfile.is_super_admin) {
      throw new Error("A conta E2E_SUPER_ADMIN_USER não tem o privilégio super_admin ativo.");
    }
    const tenant = await resolveQaTenantId(supabase);
    membership = {
      tenant_id: tenant.tenantId,
      role: "super_admin",
      status: "active",
      tenants: { slug: tenant.slug },
    };
  } else if (profile.label === "client") {
    const { data: link, error: linkError } = await supabase
      .from("client_users")
      .select("tenant_id, status")
      .eq("user_id", data.user.id)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (linkError) throw linkError;
    if (!link) throw new Error("A fixture client não tem vínculo ativo em client_users.");
    membership = {
      tenant_id: link.tenant_id,
      role: "client",
      status: link.status,
      tenants: null,
    };
  } else {
    let query = supabase
      .from("tenant_memberships")
      .select("tenant_id, role, status, tenants:tenants!inner(slug)")
      .eq("user_id", data.user.id)
      .eq("status", "active");
    if (E2E_TENANT_SLUG) query = query.eq("tenants.slug", E2E_TENANT_SLUG);

    const { data: memberships, error: membershipError } = await query;
    if (membershipError) throw membershipError;
    const found = (memberships?.[0] ?? null) as Membership | null;
    if (!found) {
      throw new Error(`Perfil ${profile.label} não possui membership ativo no tenant QA.`);
    }
    if (found.role !== profile.label) {
      throw new Error(
        `Perfil ${profile.label} autenticou com role ${found.role}; fixture QA está inconsistente.`,
      );
    }
    membership = found;
  }

  return { supabase, session: data.session, user: data.user, membership };
}

async function injectSession(page: Page, session: Session, user: User, tenantId: string) {
  const storageKey = tokenStorageKey(SUPABASE_URL);
  await page.addInitScript(
    ({ key, sess, usr, selectedTenantId }) => {
      window.localStorage.clear();
      window.localStorage.setItem(
        key,
        JSON.stringify({ ...sess, user: usr, weak_password: null }),
      );
      window.localStorage.setItem("cativa.currentTenantId", selectedTenantId);
    },
    { key: storageKey, sess: session, usr: user, selectedTenantId: tenantId },
  );
}

async function expectPath(
  page: Page,
  path: string,
  expectedPath: string,
  options: { direct?: boolean } = {},
) {
  // Guards de auth/tenant podem redirecionar durante a inicialização do app.
  let webkitInternalLoadError = false;
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const captureConsoleError = (message: import("@playwright/test").ConsoleMessage) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  };
  const captureFailedRequest = (request: import("@playwright/test").Request) => {
    const failure = request.failure()?.errorText ?? "falha sem detalhe do navegador";
    const url = new URL(request.url());
    failedRequests.push(`${request.method()} ${url.origin}${url.pathname} — ${failure}`);
    if (/WebKit encountered an internal error/i.test(failure)) webkitInternalLoadError = true;
  };
  const capturePageError = (error: Error) => consoleErrors.push(error.stack ?? error.message);
  page.on("console", captureConsoleError);
  page.on("requestfailed", captureFailedRequest);
  page.on("pageerror", capturePageError);
  let forceDocumentNavigation = Boolean(options.direct) || !routedPages.has(page);
  const navigate = async () => {
    if (!forceDocumentNavigation) {
      await page.evaluate((targetPath) => {
        window.history.pushState(window.history.state, "", targetPath);
        window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
      }, path);
      return;
    }
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        // Espera apenas o documento ser comprometido. A prontidão real da rota
        // é verificada abaixo, depois do carregamento do chunk React lazy.
        await page.goto(path, { waitUntil: "commit", timeout: 20_000 });
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/Frame load interrupted|Navigation to ".+" is interrupted by another navigation/.test(message)) {
          return;
        }
        const isTransientNavigationFailure =
          /WebKit encountered an internal error/i.test(message) ||
          (error instanceof Error && error.name === "TimeoutError");
        if (attempt === 0 && isTransientNavigationFailure) {
          console.warn(
            `[e2e] Navegação para ${path} não foi confirmada pelo navegador; repetindo uma vez (${message.split("\n")[0]}).`,
          );
          await page.waitForTimeout(250);
          continue;
        }
        throw error;
      }
    }
  };
  try {
    const shell = expectedPath.startsWith("/portal")
      ? page.locator('main[data-app-context="portal"]')
      : page.locator('main[data-app-context="tenant"]');

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await navigate();
      try {
        await expect(shell).toBeVisible({ timeout: 15_000 });
      } catch (error) {
        // Linux WebKit can return HTTP 200 for a route but fail to load its
        // JS/CSS subresources with an engine-level internal error. In that
        // case React never mounts and the shell remains absent; retry only
        // this explicit browser-engine failure, never an app assertion.
        if (attempt < 2 && webkitInternalLoadError) {
          webkitInternalLoadError = false;
          forceDocumentNavigation = true;
          console.warn(`[e2e] WebKit falhou ao carregar recursos de ${path}; repetindo a navegação (${attempt + 2}/3).`);
          continue;
        }
        throw error;
      }

      const currentPath = () => new URL(page.url()).pathname;
      if (currentPath() !== expectedPath && currentPath() !== path) await navigate();
      await expect.poll(currentPath, { timeout: 15_000 }).toBe(expectedPath);
      if (expectedPath.startsWith("/app")) {
        // A presença do shell não basta: se um chunk da tela falhar, o app
        // mantém este fallback visível indefinidamente.
        const routeFallback = page.locator(
          'main[data-app-context="tenant"] [aria-busy="true"][aria-label="Carregando"]',
        );
        try {
          await expect(routeFallback).toBeHidden({ timeout: 20_000 });
        } catch (error) {
          if (attempt < 2 && webkitInternalLoadError) {
            webkitInternalLoadError = false;
            forceDocumentNavigation = true;
            console.warn(`[e2e] WebKit falhou ao carregar a tela lazy de ${path}; repetindo a navegação (${attempt + 2}/3).`);
            continue;
          }
          throw error;
        }
      }
      routedPages.add(page);
      return;
    }
  } catch (error) {
    await test.info().attach("diagnostico-carregamento-de-rota.json", {
      body: JSON.stringify({ path, expectedPath, consoleErrors, failedRequests }, null, 2),
      contentType: "application/json",
    });
    throw error;
  } finally {
    page.off("console", captureConsoleError);
    page.off("requestfailed", captureFailedRequest);
    page.off("pageerror", capturePageError);
  }
}

async function cleanupClient(supabase: SupabaseClient, clientId: string) {
  if (!clientId) return;
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw error;
}

async function exerciseLocalAdminSubscriptionFlow(
  page: Page,
  supabase: SupabaseClient,
  userId: string,
  tenantId: string,
) {
  if (!LOCAL_QA_TARGET) return;
  if (!SERVICE_ROLE_KEY) {
    throw new Error("O fluxo local de assinatura super_admin exige SUPABASE_SERVICE_ROLE_KEY para limpeza segura.");
  }

  const { data: before, error: readError } = await supabase
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
  if (readError) throw readError;
  if (!before) throw new Error("A fixture do super-admin precisa ter uma assinatura para o teste local.");

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const marker = `E2E local admin subscription ${randomUUID()}`;
  const dialog = page.getByRole("dialog");
  const cleanupErrors: string[] = [];

  try {
    await page.getByRole("tab", { name: /Contas e acessos/ }).click();
    await page.getByRole("tab", { name: "Assinaturas" }).click();
    const subscriptions = page.getByTestId("tenant-subscriptions-tab");
    await expect(subscriptions).toBeVisible();

    // `studio-teste-qa` is a substring of the companion tenant slug
    // `studio-teste-qa-b`; match the exact slug text to select only tenant A.
    const exactTenantSlug = subscriptions.getByText(E2E_TENANT_SLUG, {
      exact: true,
    });
    await expect(exactTenantSlug).toHaveCount(1);
    const fixtureRow = exactTenantSlug.locator("xpath=ancestor::li[1]");
    await expect(fixtureRow).toHaveCount(1);
    const manageButton = fixtureRow.getByRole("button", { name: "Gerenciar" });
    // Centre the action in the viewport so the fixed mobile header/BottomNav
    // cannot intercept the tap when the subscriptions list is long.
    await manageButton.evaluate((element: HTMLElement) =>
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }),
    );
    await manageButton.click();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.locator("textarea").last().fill(marker);
    await dialog.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText("Assinatura atualizada", { exact: true })).toBeVisible();

    const { data: events, error: eventError } = await supabase
      .from("subscription_events")
      .select("id,event_type,notes")
      .eq("subscription_id", before.id)
      .like("notes", `${marker}%`);
    if (eventError) throw eventError;
    expect(events?.some((event) => event.event_type === "note")).toBe(true);

    const { data: auditRows, error: auditReadError } = await admin
      .from("audit_logs")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("actor_id", userId)
      .eq("action", "subscription.updated")
      .filter("metadata->>reason", "eq", marker);
    if (auditReadError) throw auditReadError;
    expect(auditRows).toHaveLength(1);
  } finally {
    const { error: restoreError } = await supabase.rpc("admin_manage_tenant_subscription", {
      _tenant_id: tenantId,
      _plan_id: before.plan_id,
      _status: before.status,
      _trial_started_at: before.trial_started_at,
      _trial_ends_at: before.trial_ends_at,
      _current_period_start: before.current_period_start,
      _current_period_end: before.current_period_end,
      _discount_cents: before.discount_cents,
      _discount_reason: before.discount_reason,
      _override_limits: before.override_limits,
      _notes: before.notes,
      _reason: `${marker} cleanup`,
    });
    if (restoreError) cleanupErrors.push(`restore: ${restoreError.message}`);

    const { error: eventCleanupError } = await admin
      .from("subscription_events")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("subscription_id", before.id)
      .like("notes", `${marker}%`);
    if (eventCleanupError) cleanupErrors.push(`event cleanup: ${eventCleanupError.message}`);

    const { error: auditCleanupError } = await admin
      .from("audit_logs")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("actor_id", userId)
      .eq("action", "subscription.updated")
      .filter("metadata->>reason", "eq", marker);
    if (auditCleanupError) cleanupErrors.push(`audit cleanup: ${auditCleanupError.message}`);

    const { error: cleanupAuditError } = await admin
      .from("audit_logs")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("actor_id", userId)
      .eq("action", "subscription.updated")
      .filter("metadata->>reason", "eq", `${marker} cleanup`);
    if (cleanupAuditError) cleanupErrors.push(`restore audit cleanup: ${cleanupAuditError.message}`);

    const { error: cleanupEventError } = await admin
      .from("subscription_events")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("subscription_id", before.id)
      .like("notes", `${marker} cleanup%`);
    if (cleanupEventError) cleanupErrors.push(`restore event cleanup: ${cleanupEventError.message}`);
  }
  if (cleanupErrors.length > 0) throw new Error(cleanupErrors.join("; "));

  const { data: restored, error: restoredError } = await supabase
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
  if (restoredError) throw restoredError;
  expect(restored).toMatchObject({
    id: before.id,
    tenant_id: before.tenant_id,
    plan_id: before.plan_id,
    status: before.status,
    trial_started_at: before.trial_started_at,
    trial_ends_at: before.trial_ends_at,
    current_period_start: before.current_period_start,
    current_period_end: before.current_period_end,
    discount_cents: before.discount_cents,
    override_limits: before.override_limits,
    notes: before.notes,
  });
}

test.describe("RBAC real por perfil", () => {
  test.describe.configure({ timeout: 300_000 });
  test.skip(
    Boolean(QA_TARGET_SKIP_REASON),
    QA_TARGET_SKIP_REASON ?? "Testes de RBAC exigem um alvo QA autorizado.",
  );
  test.skip(
    !HAS_ROLE_FIXTURES,
    "Configure as seis contas de QA, o tenant QA e a URL/chave Supabase para executar RBAC completo.",
  );

  for (const profile of PROFILES) {
    test(`${profile.label}: rotas e jornadas respeitam a hierarquia`, async ({ page }) => {
      const { supabase, session, user, membership } = await signInProfile(profile);
      try {
        await injectSession(page, session, user, membership.tenant_id);

        if (profile.label === "client") {
          await expectPath(page, STAFF_ROUTE_CONTRACT[0].path, "/portal");
          await expectPath(page, "/portal", "/portal", { direct: true });
          for (const route of STAFF_ROUTE_CONTRACT.slice(1)) {
            await expectPath(page, route.path, "/portal");
          }
          for (const path of CLIENT_PORTAL_ROUTES.slice(1)) await expectPath(page, path, path);
          return;
        }

        if (profile.label === "super_admin") {
          await expectPath(page, "/app", "/app");
          await expectPath(page, "/app/super-admin", "/app/super-admin", { direct: true });
          await exerciseLocalAdminSubscriptionFlow(page, supabase, user.id, membership.tenant_id);
          return;
        }

        const roleRoutes = STAFF_ROUTE_CONTRACT.map((route) => ({
          ...route,
          expectedPath: route.roles.includes(profile.label) ? route.path : "/app",
        }));
        const directDeniedRoute = roleRoutes.find((route) => route.expectedPath !== route.path);
        const directAllowedRoute = roleRoutes.find((route) => route.roles.includes(profile.label));
        const firstRoute = directDeniedRoute ?? directAllowedRoute ?? roleRoutes[0];
        await expectPath(page, firstRoute.path, firstRoute.expectedPath);
        if (directDeniedRoute && directAllowedRoute) {
          await expectPath(
            page,
            directAllowedRoute.path,
            directAllowedRoute.path,
            { direct: true },
          );
        }
        for (const route of roleRoutes) {
          if (route === firstRoute || route === directDeniedRoute || route === directAllowedRoute) continue;
          await expectPath(page, route.path, route.expectedPath);
        }
      } finally {
        await supabase.auth.signOut();
      }
    });

    test(`${profile.label}: RLS de clientes respeita o papel`, async () => {
      const { supabase, membership } = await signInProfile(profile);
      const marker = `QA RBAC ${profile.label} ${Date.now()}`;
      let createdClientId = "";

      try {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            tenant_id: membership.tenant_id,
            full_name: marker,
            origin: "qa-rbac",
          })
          .select("id")
          .maybeSingle();

        const canManageClients = ["owner", "manager", "frontdesk", "super_admin"].includes(
          profile.label,
        );
        if (canManageClients) {
          expect(error, `${profile.label} deveria inserir cliente no tenant QA`).toBeNull();
          expect(data?.id).toBeTruthy();
          createdClientId = data?.id ?? "";
        } else {
          expect(error, `${profile.label} não deve inserir cliente por acesso direto ao banco`).toBeTruthy();
          expect(data).toBeNull();
        }
      } finally {
        if (createdClientId) await cleanupClient(supabase, createdClientId);
        await supabase.auth.signOut();
      }
    });
  }
});
