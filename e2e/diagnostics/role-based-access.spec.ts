import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

type QaRole = "owner" | "manager" | "frontdesk" | "professional";

type QaProfile = {
  label: QaRole;
  email: string;
  password: string;
};

type Membership = {
  tenant_id: string;
  role: QaRole | "super_admin" | "client";
  status: string;
  tenants: { slug: string } | null;
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
const E2E_TENANT_SLUG = env("E2E_TENANT_SLUG");

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
];

const HAS_ROLE_FIXTURES = Boolean(
  SUPABASE_URL &&
    PUBLISHABLE_KEY &&
    PROFILES.every((profile) => profile.email && profile.password),
);

const OPEN_ROUTES = ["/app", "/app/agenda", "/app/clientes", "/app/confirmacoes"];
const MANAGER_ROUTES = [
  "/app/servicos",
  "/app/pacotes",
  "/app/analytics",
  "/app/meu-plano",
  "/app/assinatura",
  "/app/dados",
  "/app/configuracoes",
];

function createSupabase() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
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

  let query = supabase
    .from("tenant_memberships")
    .select("tenant_id, role, status, tenants:tenants!inner(slug)")
    .eq("user_id", data.user.id)
    .eq("status", "active");
  if (E2E_TENANT_SLUG) query = query.eq("tenants.slug", E2E_TENANT_SLUG);

  const { data: memberships, error: membershipError } = await query;
  if (membershipError) throw membershipError;
  const membership = (memberships?.[0] ?? null) as Membership | null;
  if (!membership) {
    throw new Error(`Perfil ${profile.label} não possui membership ativo no tenant QA.`);
  }
  if (membership.role !== profile.label) {
    throw new Error(
      `Perfil ${profile.label} autenticou com role ${membership.role}; fixture QA está inconsistente.`,
    );
  }

  return { supabase, session: data.session, user: data.user, membership };
}

async function injectSession(
  page: Page,
  session: Session,
  user: User,
  tenantId: string,
) {
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

async function expectRoute(page: Page, path: string, allowed: boolean) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: 20_000 });
  if (allowed) {
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe(path);
  } else {
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe("/app");
  }
}

async function cleanupClient(supabase: SupabaseClient, clientId: string) {
  if (!clientId) return;
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw error;
}

test.describe("RBAC real por perfil", () => {
  test.describe.configure({ timeout: 300_000 });
  test.skip(
    !HAS_ROLE_FIXTURES,
    "Credenciais QA de owner/manager/frontdesk/professional não estão configuradas.",
  );

  for (const profile of PROFILES) {
    test(`${profile.label}: rotas respeitam a hierarquia`, async ({ page }) => {
      const { supabase, session, user, membership } = await signInProfile(profile);
      try {
        await injectSession(page, session, user, membership.tenant_id);

        for (const path of OPEN_ROUTES) await expectRoute(page, path, true);

        const canUseManagerRoutes = profile.label === "owner" || profile.label === "manager";
        for (const path of MANAGER_ROUTES) {
          await expectRoute(page, path, canUseManagerRoutes);
        }

        await expectRoute(page, "/app/super-admin", false);
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

        const canManageClients = profile.label !== "professional";
        if (canManageClients) {
          expect(error, `${profile.label} deveria inserir cliente no próprio tenant`).toBeNull();
          expect(data?.id).toBeTruthy();
          createdClientId = data?.id ?? "";
        } else {
          expect(error, "professional não deve inserir cliente por acesso direto ao banco").toBeTruthy();
          expect(data).toBeNull();
        }
      } finally {
        if (createdClientId) await cleanupClient(supabase, createdClientId);
        await supabase.auth.signOut();
      }
    });
  }
});
