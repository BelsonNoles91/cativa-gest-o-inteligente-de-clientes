import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";

type JsonRecord = Record<string, unknown>;

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

function isBooleanFeatureEnabled(value: unknown): boolean {
  if (value === true || value === "true" || value === 1) return true;
  if (typeof value === "number") return value > 0;
  return false;
}

function asNumberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function loadUnitLimitContext(supabase: SupabaseClient, userId: string) {
  const { data: membership, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();
  if (membershipError) throw membershipError;
  const tenantId = membership.tenant_id as string;

  const { data: subscription, error: subscriptionError } = await supabase
    .from("tenant_subscriptions")
    .select("id, plan_id, override_limits")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (subscriptionError) throw subscriptionError;
  if (!subscription) throw new Error("Tenant QA não possui assinatura para validar limites.");

  const [{ data: plan, error: planError }, { count: unitsCount, error: unitsError }] =
    await Promise.all([
      supabase
        .from("plans")
        .select("id, name, max_units")
        .eq("id", subscription.plan_id)
        .single(),
      supabase
        .from("units")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId),
    ]);
  if (planError) throw planError;
  if (unitsError) throw unitsError;

  const [{ data: planFeatures }, { data: tenantFlags }, { data: globalFlags }] =
    await Promise.all([
      supabase
        .from("plan_features")
        .select("feature_key, value")
        .eq("plan_id", subscription.plan_id),
      supabase
        .from("feature_flags")
        .select("flag_key, value")
        .eq("tenant_id", tenantId),
      supabase
        .from("feature_flags")
        .select("flag_key, value")
        .is("tenant_id", null),
    ]);

  const featureMap = new Map<string, unknown>();
  for (const feature of planFeatures ?? []) {
    featureMap.set(feature.feature_key as string, feature.value);
  }
  for (const flag of globalFlags ?? []) {
    featureMap.set(flag.flag_key as string, flag.value);
  }
  for (const flag of tenantFlags ?? []) {
    featureMap.set(flag.flag_key as string, flag.value);
  }

  const overrides = (subscription.override_limits ?? {}) as JsonRecord;
  const maxUnits =
    asNumberOrNull(overrides.max_units) ??
    asNumberOrNull((plan as JsonRecord).max_units);

  return {
    tenantId,
    planName: plan.name as string,
    maxUnits,
    unitsCount: unitsCount ?? 0,
    multiUnit: isBooleanFeatureEnabled(featureMap.get("multi_unit")),
  };
}

async function createTemporaryUnits(
  supabase: SupabaseClient,
  tenantId: string,
  amount: number,
  marker: string,
) {
  if (amount <= 0) return [] as string[];
  const payload = Array.from({ length: amount }, (_, index) => ({
    tenant_id: tenantId,
    name: `E2E Limite Unidade ${marker} ${index + 1}`,
    is_default: false,
    phone: "85966665555",
  }));

  const { data, error } = await supabase
    .from("units")
    .insert(payload)
    .select("id");
  if (error) throw error;
  return (data ?? []).map((unit) => unit.id as string);
}

async function cleanupTemporaryUnits(supabase: SupabaseClient, unitIds: string[]) {
  if (unitIds.length === 0) return;
  await supabase.from("unit_settings").delete().in("unit_id", unitIds);
  await supabase.from("units").delete().in("id", unitIds);
}

test.describe("plan limits", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("bloqueia criação de unidade quando plano ou limite efetivo não permite", async ({ page }) => {
    const { supabase, userId } = await createSignedInSupabase();
    const marker = `${Date.now()}`;
    let createdUnitIds: string[] = [];

    try {
      let context = await loadUnitLimitContext(supabase, userId);
      const blockedByFeature = !context.multiUnit && context.unitsCount >= 1;
      const blockedByMax =
        context.maxUnits !== null && context.unitsCount >= context.maxUnits;

      if (!blockedByFeature && !blockedByMax) {
        const missingToLimit =
          context.maxUnits === null ? Number.POSITIVE_INFINITY : context.maxUnits - context.unitsCount;
        test.skip(
          !Number.isFinite(missingToLimit) || missingToLimit > 3,
          `Plano atual (${context.planName}) não está próximo de um limite automatizável de unidades.`,
        );
        createdUnitIds = await createTemporaryUnits(
          supabase,
          context.tenantId,
          missingToLimit,
          marker,
        );
        context = await loadUnitLimitContext(supabase, userId);
      }

      await page.goto("/app/configuracoes", { waitUntil: "commit", timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await page.locator("[data-app-main]").waitFor({ state: "visible", timeout: 30_000 });

      await page.getByTestId("settings-tab-units").click();
      await expect(page.getByTestId("units-settings")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId("units-create-trigger")).toBeDisabled({
        timeout: 30_000,
      });
      await expect(page.getByTestId("units-limit-warning")).toBeVisible({
        timeout: 30_000,
      });

      if (!context.multiUnit) {
        await expect(page.getByTestId("units-limit-warning")).toContainText(
          "permite apenas uma unidade",
        );
      } else {
        await expect(page.getByTestId("units-limit-warning")).toContainText(
          "Limite de unidades atingido",
        );
      }
    } finally {
      await cleanupTemporaryUnits(supabase, createdUnitIds);
      await supabase.auth.signOut();
    }
  });
});
