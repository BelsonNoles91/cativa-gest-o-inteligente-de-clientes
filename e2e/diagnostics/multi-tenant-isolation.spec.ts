import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { getDestructiveE2ESkipReason } from "../_helpers/qaTarget";

function env(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

const SUPABASE_URL = env("VITE_SUPABASE_URL");
const PUBLISHABLE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const TENANT_A = { email: env("E2E_USER"), password: env("E2E_PASS") };
const TENANT_B = {
  email: env("E2E_TENANT_B_USER"),
  password: env("E2E_TENANT_B_PASS"),
};

const HAS_TWO_TENANTS = Boolean(
  SUPABASE_URL &&
    PUBLISHABLE_KEY &&
    TENANT_A.email &&
    TENANT_A.password &&
    TENANT_B.email &&
    TENANT_B.password,
);

function supabaseClient() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function signIn(credentials: { email: string; password: string }) {
  const supabase = supabaseClient();
  const { data, error } = await supabase.auth.signInWithPassword(credentials);
  if (error || !data.user) throw new Error(error?.message ?? "Login QA não retornou usuário.");

  const { data: memberships, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", data.user.id)
    .eq("status", "active")
    .in("role", ["owner", "manager", "frontdesk"])
    .limit(1);
  if (membershipError) throw membershipError;
  if (!memberships?.[0]?.tenant_id) {
    throw new Error("Conta QA precisa de papel com escrita para preparar a fixture multi-tenant.");
  }
  return { supabase, tenantId: memberships[0].tenant_id as string };
}

async function createClientFixture(supabase: SupabaseClient, tenantId: string, label: string) {
  const { data, error } = await supabase
    .from("clients")
    .insert({ tenant_id: tenantId, full_name: label, origin: "qa-multi-tenant" })
    .select("id, full_name")
    .single();
  if (error) throw error;
  return data as { id: string; full_name: string };
}

test.describe("Isolamento multi-tenant remoto", () => {
  test.describe.configure({ timeout: 120_000 });
  const qaTargetSkipReason = getDestructiveE2ESkipReason();
  test.skip(Boolean(qaTargetSkipReason), qaTargetSkipReason ?? "");
  test.skip(
    !HAS_TWO_TENANTS,
    "Configure E2E_TENANT_B_USER/E2E_TENANT_B_PASS para validar dois tenants reais no ambiente remoto.",
  );

  test("IDs conhecidos de outro tenant não podem ser lidos nem alterados", async () => {
    const a = await signIn(TENANT_A);
    const b = await signIn(TENANT_B);
    expect(a.tenantId, "As contas precisam pertencer a tenants diferentes.").not.toBe(b.tenantId);

    const marker = Date.now();
    let clientA: { id: string; full_name: string } | null = null;
    let clientB: { id: string; full_name: string } | null = null;

    try {
      clientA = await createClientFixture(a.supabase, a.tenantId, `QA Tenant A ${marker}`);
      clientB = await createClientFixture(b.supabase, b.tenantId, `QA Tenant B ${marker}`);

      const { data: aReadsB, error: aReadError } = await a.supabase
        .from("clients")
        .select("id")
        .eq("id", clientB.id)
        .maybeSingle();
      expect(aReadError).toBeNull();
      expect(aReadsB).toBeNull();

      const { data: bReadsA, error: bReadError } = await b.supabase
        .from("clients")
        .select("id")
        .eq("id", clientA.id)
        .maybeSingle();
      expect(bReadError).toBeNull();
      expect(bReadsA).toBeNull();

      const { data: aUpdatesB, error: aUpdateError } = await a.supabase
        .from("clients")
        .update({ full_name: "cross-tenant-hack-a" })
        .eq("id", clientB.id)
        .select("id");
      expect(aUpdateError).toBeNull();
      expect(aUpdatesB).toHaveLength(0);

      const { data: bUpdatesA, error: bUpdateError } = await b.supabase
        .from("clients")
        .update({ full_name: "cross-tenant-hack-b" })
        .eq("id", clientA.id)
        .select("id");
      expect(bUpdateError).toBeNull();
      expect(bUpdatesA).toHaveLength(0);

      const { data: originalA, error: originalAError } = await a.supabase
        .from("clients")
        .select("full_name")
        .eq("id", clientA.id)
        .single();
      expect(originalAError).toBeNull();
      expect(originalA?.full_name).toBe(clientA.full_name);

      const { data: originalB, error: originalBError } = await b.supabase
        .from("clients")
        .select("full_name")
        .eq("id", clientB.id)
        .single();
      expect(originalBError).toBeNull();
      expect(originalB?.full_name).toBe(clientB.full_name);
    } finally {
      if (clientA) await a.supabase.from("clients").delete().eq("id", clientA.id);
      if (clientB) await b.supabase.from("clients").delete().eq("id", clientB.id);
      await a.supabase.auth.signOut();
      await b.supabase.auth.signOut();
    }
  });
});
