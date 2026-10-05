#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { invokeWithRetry } from "./e2e-provision-retry.mjs";

function env(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

const SUPABASE_URL = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
const PUBLISHABLE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
const SUPER_ADMIN_USER = env("E2E_SUPER_ADMIN_USER");
const SUPER_ADMIN_PASS = env("E2E_SUPER_ADMIN_PASS");
const FIXTURE_PASS = env("E2E_PASS");
const TENANT_A_SLUG = env("E2E_TENANT_SLUG") || "studio-teste-qa";
const TENANT_B_SLUG = env("E2E_TENANT_B_SLUG") || `${TENANT_A_SLUG}-b`;
const EMAIL_DOMAIN = env("E2E_EMAIL_DOMAIN") || "cativa.test";
const RUN_ID = (env("E2E_RUN_ID") || env("GITHUB_RUN_ID") || `local-${Date.now()}`)
  .replace(/[^a-zA-Z0-9._-]/g, "-")
  .slice(0, 80);

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !SUPER_ADMIN_USER || !SUPER_ADMIN_PASS || !FIXTURE_PASS) {
  throw new Error(
    "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_SUPER_ADMIN_USER, E2E_SUPER_ADMIN_PASS e E2E_PASS (senha das fixtures) são obrigatórios.",
  );
}
if (FIXTURE_PASS.length < 12) {
  throw new Error("E2E_PASS precisa ter ao menos 12 caracteres para as contas de fixture.");
}
if (![".test", ".local", ".example"].some((suffix) => EMAIL_DOMAIN.endsWith(suffix))) {
  throw new Error("E2E_EMAIL_DOMAIN precisa terminar em .test, .local ou .example.");
}

const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function assertResult(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function ensureTenant(slug, name) {
  const existing = assertResult(
    await supabase.from("tenants").select("id, slug, name").eq("slug", slug).maybeSingle(),
    `buscar tenant ${slug}`,
  );
  if (existing) return existing;

  return assertResult(
    await supabase
      .from("tenants")
      .insert({
        name,
        slug,
        segment: "salao",
        status: "active",
        created_by: (await supabase.auth.getUser()).data.user?.id,
      })
      .select("id, slug, name")
      .single(),
    `criar tenant ${slug}`,
  );
}

async function ensureDefaultUnit(tenantId) {
  const existing = assertResult(
    await supabase
      .from("units")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle(),
    "buscar unidade padrão do tenant QA",
  );
  if (existing) return existing;

  return assertResult(
    await supabase
      .from("units")
      .insert({ tenant_id: tenantId, name: "Unidade Principal QA", is_default: true })
      .select("id")
      .single(),
    "criar unidade padrão do tenant QA",
  );
}

async function provisionTenant(tenantId) {
  const { data, error } = await invokeWithRetry(
    () => supabase.functions.invoke("admin-provision-test-users", {
      body: {
        tenant_id: tenantId,
        password: FIXTURE_PASS,
        email_domain: EMAIL_DOMAIN,
      },
    }),
    {
      onRetry: ({ nextAttempt, maxAttempts, delayMs, status }) => {
        console.warn(
          `Falha transitória no provisionamento QA${status ? ` (HTTP ${status})` : " (rede)"}; nova tentativa ${nextAttempt}/${maxAttempts} em ${delayMs} ms.`,
        );
      },
    },
  );
  if (error) {
    let detail = error.message;
    const response = error.context;
    if (response instanceof Response) {
      const status = response.status;
      try {
        const payload = await response.clone().json();
        const remoteMessage =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : JSON.stringify(payload);
        detail = `HTTP ${status}: ${remoteMessage}`;
      } catch {
        const text = await response.clone().text().catch(() => "");
        detail = `HTTP ${status}${text ? `: ${text}` : ""}`;
      }
    }
    throw new Error(`provisionar usuários QA: ${detail}`);
  }
  if (!data || data.error) {
    throw new Error(`provisionar usuários QA: ${data?.error ?? "resposta inválida"}`);
  }

  const accounts = Array.isArray(data.accounts)
    ? data.accounts
    : Array.isArray(data.results)
      ? data.results
      : [];
  const byRole = new Map(accounts.map((entry) => [entry.role, entry]));
  for (const role of ["owner", "manager", "frontdesk", "professional", "client"]) {
    const entry = byRole.get(role);
    if (!entry?.email || !entry?.user_id || !entry?.password_set) {
      throw new Error(`fixture QA incompleta para o papel ${role}`);
    }
  }
  return byRole;
}

function exportForLaterStep(key, value, { secret = false } = {}) {
  const githubEnv = env("GITHUB_ENV");
  if (!githubEnv) {
    if (!secret) console.log(`${key}=${value}`);
    return;
  }
  appendFileSync(githubEnv, `${key}=${value}\n`, { encoding: "utf8" });
}

async function main() {
  const auth = assertResult(
    await supabase.auth.signInWithPassword({ email: SUPER_ADMIN_USER, password: SUPER_ADMIN_PASS }),
    "autenticar usuário QA principal",
  );
  if (!auth.user) throw new Error("autenticação QA não retornou usuário");

  const profile = assertResult(
    await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", auth.user.id)
      .single(),
    "validar perfil QA principal",
  );
  if (!profile?.is_super_admin) {
    throw new Error(
      "E2E_SUPER_ADMIN_USER precisa ser super_admin para chamar o provisionador de fixtures de segurança.",
    );
  }

  const tenantA = await ensureTenant(TENANT_A_SLUG, "Studio Teste QA");
  const unitA = await ensureDefaultUnit(tenantA.id);
  const rolesA = await provisionTenant(tenantA.id);

  const tenantB = await ensureTenant(TENANT_B_SLUG, "Studio Teste QA B");
  const unitB = await ensureDefaultUnit(tenantB.id);
  const rolesB = await provisionTenant(tenantB.id);

  const ownerEmail = rolesA.get("owner").email;
  if (ownerEmail.toLowerCase() === SUPER_ADMIN_USER.toLowerCase()) {
    throw new Error("A conta super-admin não pode ser reutilizada como owner da fixture QA.");
  }

  // A conta administrativa só provisiona as fixtures. Daqui em diante,
  // E2E_USER/E2E_PASS representam o owner do tenant QA para as jornadas.
  exportForLaterStep("E2E_USER", ownerEmail);
  exportForLaterStep("E2E_PASS", FIXTURE_PASS, { secret: true });
  exportForLaterStep("E2E_MANAGER_USER", rolesA.get("manager").email);
  exportForLaterStep("E2E_MANAGER_PASS", FIXTURE_PASS, { secret: true });
  exportForLaterStep("E2E_FRONTDESK_USER", rolesA.get("frontdesk").email);
  exportForLaterStep("E2E_FRONTDESK_PASS", FIXTURE_PASS, { secret: true });
  exportForLaterStep("E2E_PROFESSIONAL_USER", rolesA.get("professional").email);
  exportForLaterStep("E2E_PROFESSIONAL_PASS", FIXTURE_PASS, { secret: true });
  exportForLaterStep("E2E_CLIENT_USER", rolesA.get("client").email);
  exportForLaterStep("E2E_CLIENT_PASS", FIXTURE_PASS, { secret: true });
  exportForLaterStep("E2E_TENANT_B_USER", rolesB.get("owner").email);
  exportForLaterStep("E2E_TENANT_B_PASS", FIXTURE_PASS, { secret: true });
  exportForLaterStep("E2E_TENANT_B_SLUG", tenantB.slug);
  exportForLaterStep("E2E_TENANT_A_ID", tenantA.id);
  exportForLaterStep("E2E_TENANT_B_ID", tenantB.id);
  exportForLaterStep("E2E_RUN_ID", RUN_ID);

  // O manifesto é deliberadamente sintético e não contém senha/chave. Ele
  // permite correlacionar evidências de RLS, layout e carga sem depender de
  // e-mails fixos, e torna a limpeza/diagnóstico de uma execução idempotente.
  const manifestDir = join(process.cwd(), "e2e", ".artifacts-qa");
  mkdirSync(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, `fixtures-${RUN_ID}.json`);
  const manifest = {
    runId: RUN_ID,
    createdAt: new Date().toISOString(),
    target: new URL(SUPABASE_URL).host,
    tenants: [
      { id: tenantA.id, slug: tenantA.slug, unitId: unitA.id, accounts: Object.fromEntries(rolesA) },
      { id: tenantB.id, slug: tenantB.slug, unitId: unitB.id, accounts: Object.fromEntries(rolesB) },
    ],
    cleanup: {
      strategy: "idempotent-static-slugs",
      destructiveRequiresQaProjectRef: true,
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  exportForLaterStep("E2E_FIXTURE_MANIFEST", manifestPath);

  console.log(
    `Fixtures QA prontas (run_id=${RUN_ID}): ${tenantA.slug} (RBAC) e ${tenantB.slug} (isolamento multi-tenant).`,
  );
  await supabase.auth.signOut();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
