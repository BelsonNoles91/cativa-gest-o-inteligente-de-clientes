#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function env(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

const SUPABASE_URL = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
const PUBLISHABLE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY");
const E2E_USER = env("E2E_USER");
const E2E_PASS = env("E2E_PASS");
const TENANT_A_SLUG = env("E2E_TENANT_SLUG") || "studio-teste-qa";
const TENANT_B_SLUG = env("E2E_TENANT_B_SLUG") || `${TENANT_A_SLUG}-b`;
const EMAIL_DOMAIN = env("E2E_EMAIL_DOMAIN") || "cativa.test";

if (!SUPABASE_URL || !PUBLISHABLE_KEY || !E2E_USER || !E2E_PASS) {
  throw new Error(
    "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_USER e E2E_PASS são obrigatórios.",
  );
}
if (E2E_PASS.length < 12) {
  throw new Error("E2E_PASS precisa ter ao menos 12 caracteres para o provisionamento seguro.");
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
  const { data, error } = await supabase.functions.invoke("admin-provision-test-users", {
    body: {
      tenant_id: tenantId,
      password: E2E_PASS,
      email_domain: EMAIL_DOMAIN,
    },
  });
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
  for (const role of ["owner", "manager", "frontdesk", "professional"]) {
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
    await supabase.auth.signInWithPassword({ email: E2E_USER, password: E2E_PASS }),
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
      "E2E_USER precisa ser super_admin para chamar o provisionador de fixtures de segurança.",
    );
  }

  const tenantA = await ensureTenant(TENANT_A_SLUG, "Studio Teste QA");
  await ensureDefaultUnit(tenantA.id);
  const rolesA = await provisionTenant(tenantA.id);

  const tenantB = await ensureTenant(TENANT_B_SLUG, "Studio Teste QA B");
  await ensureDefaultUnit(tenantB.id);
  const rolesB = await provisionTenant(tenantB.id);

  exportForLaterStep("E2E_MANAGER_USER", rolesA.get("manager").email);
  exportForLaterStep("E2E_MANAGER_PASS", E2E_PASS, { secret: true });
  exportForLaterStep("E2E_FRONTDESK_USER", rolesA.get("frontdesk").email);
  exportForLaterStep("E2E_FRONTDESK_PASS", E2E_PASS, { secret: true });
  exportForLaterStep("E2E_PROFESSIONAL_USER", rolesA.get("professional").email);
  exportForLaterStep("E2E_PROFESSIONAL_PASS", E2E_PASS, { secret: true });
  exportForLaterStep("E2E_TENANT_B_USER", rolesB.get("owner").email);
  exportForLaterStep("E2E_TENANT_B_PASS", E2E_PASS, { secret: true });
  exportForLaterStep("E2E_TENANT_B_SLUG", tenantB.slug);

  console.log(
    `Fixtures QA prontas: ${tenantA.slug} (RBAC) e ${tenantB.slug} (isolamento multi-tenant).`,
  );
  await supabase.auth.signOut();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
