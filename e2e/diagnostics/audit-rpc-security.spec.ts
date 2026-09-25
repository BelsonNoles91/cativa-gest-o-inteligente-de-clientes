import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

function env(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

const SUPABASE_URL = env("VITE_SUPABASE_URL");
const PUBLISHABLE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const E2E_USER = env("E2E_USER");
const E2E_PASS = env("E2E_PASS");
const HAS_ENV = Boolean(SUPABASE_URL && PUBLISHABLE_KEY && E2E_USER && E2E_PASS);
const FOREIGN_TENANT_ID = "00000000-0000-4000-8000-000000000001";

type AuditRow = {
  tenant_id: string | null;
  actor_email: string | null;
  metadata: unknown;
};

function client() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticatedOwnerOrManager() {
  const supabase = client();
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: E2E_USER,
    password: E2E_PASS,
  });
  if (authError || !auth.user) {
    throw new Error(authError?.message ?? "Login E2E não retornou usuário.");
  }

  const [{ data: membership, error: membershipError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabase
        .from("tenant_memberships")
        .select("tenant_id, role")
        .eq("user_id", auth.user.id)
        .eq("status", "active")
        .in("role", ["owner", "manager"])
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("is_super_admin").eq("id", auth.user.id).single(),
    ]);

  if (membershipError) throw membershipError;
  if (profileError) throw profileError;
  if (!membership?.tenant_id) {
    throw new Error("Conta E2E precisa ser owner ou manager de um tenant ativo.");
  }
  expect(profile?.is_super_admin, "A fixture E2E precisa representar um usuário tenant comum.").toBe(
    false,
  );

  return { supabase, tenantId: membership.tenant_id as string };
}

function cursorArgs(tenantId: string | null) {
  return {
    _tenant_id: tenantId,
    _actor_id: null,
    _action_prefix: null,
    _entity: null,
    _from: null,
    _to: null,
    _limit: 25,
    _cursor_id: null,
    _cursor_timestamp: null,
    _sort_order: "desc",
  };
}

function offsetArgs(tenantId: string | null) {
  return {
    _tenant_id: tenantId,
    _actor_id: null,
    _action_prefix: null,
    _entity: null,
    _from: null,
    _to: null,
    _limit: 25,
    _offset: 0,
    _sort_order: "desc",
  };
}

function expectTenantScoped(rows: AuditRow[] | null, tenantId: string) {
  for (const row of rows ?? []) {
    expect(row.tenant_id).toBe(tenantId);
    expect(row.actor_email).toBeNull();
  }
}

async function expectPermissionDenied(
  request: PromiseLike<{ error: { code?: string; message?: string } | null }>,
) {
  const { error } = await request;
  expect(error, "A chamada deveria ser recusada pelo backend.").not.toBeNull();
  expect(error?.code).toBe("42501");
}

test.describe("RPC de auditoria — autorização e redação reais", () => {
  test.skip(!HAS_ENV, "Credenciais E2E/Supabase ausentes.");

  test("owner/manager só consulta logs do próprio tenant nos dois overloads", async () => {
    const { supabase, tenantId } = await authenticatedOwnerOrManager();

    try {
      const cursorOwn = await supabase.rpc("get_audit_logs_advanced", cursorArgs(tenantId));
      expect(cursorOwn.error).toBeNull();
      expectTenantScoped((cursorOwn.data ?? []) as AuditRow[], tenantId);

      await expectPermissionDenied(supabase.rpc("get_audit_logs_advanced", cursorArgs(null)));
      await expectPermissionDenied(
        supabase.rpc("get_audit_logs_advanced", cursorArgs(FOREIGN_TENANT_ID)),
      );

      const offsetOwn = await supabase.rpc("get_audit_logs_advanced", offsetArgs(tenantId));
      expect(offsetOwn.error).toBeNull();
      expectTenantScoped((offsetOwn.data ?? []) as AuditRow[], tenantId);

      await expectPermissionDenied(supabase.rpc("get_audit_logs_advanced", offsetArgs(null)));
      await expectPermissionDenied(
        supabase.rpc("get_audit_logs_advanced", offsetArgs(FOREIGN_TENANT_ID)),
      );
    } finally {
      await supabase.auth.signOut();
    }
  });

  test("redação remove segredos em objetos e arrays aninhados", async () => {
    const supabase = client();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: E2E_USER,
      password: E2E_PASS,
    });
    if (authError) throw authError;

    try {
      const { data, error } = await supabase.rpc("redact_sensitive_data", {
        input_data: {
          password: "senha-secreta",
          safe: "visível",
          nested: { email: "qa@example.com", note: "preservar" },
          items: [
            { phone: "5594999999999", value: "ok" },
            { card_number: "4111111111111111", label: "cartão" },
          ],
        },
      });

      expect(error).toBeNull();
      expect(data).toEqual({
        password: "[REDACTED]",
        safe: "visível",
        nested: { email: "[REDACTED]", note: "preservar" },
        items: [
          { phone: "[REDACTED]", value: "ok" },
          { card_number: "[REDACTED]", label: "cartão" },
        ],
      });
    } finally {
      await supabase.auth.signOut();
    }
  });

  test("cliente anônimo não executa funções de auditoria", async () => {
    const anon = client();

    const audit = await anon.rpc("get_audit_logs_advanced", cursorArgs(null));
    expect(audit.error).not.toBeNull();

    const redaction = await anon.rpc("redact_sensitive_data", {
      input_data: { token: "não-deve-executar" },
    });
    expect(redaction.error).not.toBeNull();
  });
});
