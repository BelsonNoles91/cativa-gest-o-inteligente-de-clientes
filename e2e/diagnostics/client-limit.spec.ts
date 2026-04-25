import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";

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
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function env(key: string) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function createSignedInSupabase() {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const supabaseUrl = env("VITE_SUPABASE_URL");
  const publishableKey = env("VITE_SUPABASE_PUBLISHABLE_KEY");
  const email = env("E2E_USER");
  const password = env("E2E_PASS");

  if (!supabaseUrl || !publishableKey || !email || !password) {
    throw new Error(
      "VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_USER e E2E_PASS são obrigatórios.",
    );
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error("Login E2E não retornou usuário.");
  return { supabase, userId: data.user.id };
}

async function loadClientLimitContext(supabase: SupabaseClient, userId: string) {
  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();
  if (membershipError) throw membershipError;
  const tenantId = membership.tenant_id as string;

  const { data: limits, error: limitsError } = await supabase.rpc(
    "effective_subscription_limits",
    { _tenant_id: tenantId },
  );
  if (limitsError) throw limitsError;

  const { count, error: countError } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  if (countError) throw countError;

  return {
    tenantId,
    maxActiveClients: asNumberOrNull((limits as Record<string, unknown>).max_active_clients),
    activeClientsCount: count ?? 0,
  };
}

async function createTemporaryClients(
  supabase: SupabaseClient,
  tenantId: string,
  userId: string,
  amount: number,
  marker: string,
) {
  if (amount <= 0) return [] as string[];
  const payload = Array.from({ length: amount }, (_, index) => ({
    tenant_id: tenantId,
    created_by: userId,
    full_name: `E2E Limite Cliente ${marker} ${index + 1}`,
    email: `limit-client-${marker}-${index + 1}@cativa.test`,
    phone: "85955554444",
    status: "active",
  }));

  const { data, error } = await supabase.from("clients").insert(payload).select("id");
  if (error) throw error;
  return (data ?? []).map((client) => client.id as string);
}

async function cleanupTemporaryClients(supabase: SupabaseClient, clientIds: string[]) {
  if (clientIds.length === 0) return;
  await supabase.from("client_files").delete().in("client_id", clientIds);
  await supabase.from("client_photos").delete().in("client_id", clientIds);
  await supabase.from("client_timeline_events").delete().in("client_id", clientIds);
  await supabase.from("client_tag_relations").delete().in("client_id", clientIds);
  await supabase.from("client_notes").delete().in("client_id", clientIds);
  await supabase.from("clients").delete().in("id", clientIds);
}

test.describe("active client limits", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("bloqueia criação de cliente quando max_active_clients é atingido", async ({ page }) => {
    const { supabase, userId } = await createSignedInSupabase();
    const marker = `${Date.now()}`;
    let createdClientIds: string[] = [];

    try {
      let context = await loadClientLimitContext(supabase, userId);
      const alreadyBlocked =
        context.maxActiveClients !== null &&
        context.activeClientsCount >= context.maxActiveClients;

      if (!alreadyBlocked) {
        const missingToLimit =
          context.maxActiveClients === null
            ? Number.POSITIVE_INFINITY
            : context.maxActiveClients - context.activeClientsCount;
        test.skip(
          !Number.isFinite(missingToLimit) || missingToLimit > 3,
          "Plano atual não está próximo de um limite automatizável de clientes ativos.",
        );
        createdClientIds = await createTemporaryClients(
          supabase,
          context.tenantId,
          userId,
          missingToLimit,
          marker,
        );
        context = await loadClientLimitContext(supabase, userId);
      }

      expect(context.maxActiveClients).not.toBeNull();
      expect(context.activeClientsCount).toBeGreaterThanOrEqual(context.maxActiveClients!);

      await page.goto("/app/clientes", { waitUntil: "commit", timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await page.locator("[data-app-main]").waitFor({ state: "visible", timeout: 30_000 });

      await expect(page.getByTestId("clients-active-limit-badge")).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByTestId("clients-create-cta")).toBeDisabled({
        timeout: 30_000,
      });
    } finally {
      await cleanupTemporaryClients(supabase, createdClientIds);
      await supabase.auth.signOut();
    }
  });
});
