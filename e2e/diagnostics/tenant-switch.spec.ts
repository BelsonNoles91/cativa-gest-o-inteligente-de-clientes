import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";

type TenantMembership = {
  tenant_id: string;
  tenants: {
    id: string;
    name: string;
    slug: string;
    segment: string;
  } | null;
};

type UnitRow = {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
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

async function loadTenantContext(supabase: SupabaseClient, userId: string) {
  const { data: memberships, error: membershipError } = await supabase
    .from("tenant_memberships")
    .select("tenant_id, tenants:tenants!inner(id, name, slug, segment)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (membershipError) throw membershipError;

  const typedMemberships = (memberships ?? []) as unknown as TenantMembership[];
  if (typedMemberships.length === 0) {
    throw new Error("Usuário E2E não possui tenant ativo para validar troca de contexto.");
  }

  const tenantIds = typedMemberships.map((membership) => membership.tenant_id);
  const { data: units, error: unitsError } = await supabase
    .from("units")
    .select("id, tenant_id, name, is_default")
    .in("tenant_id", tenantIds)
    .order("is_default", { ascending: false });
  if (unitsError) throw unitsError;

  return {
    memberships: typedMemberships,
    units: (units ?? []) as UnitRow[],
  };
}

async function cleanupUnitByName(
  supabase: SupabaseClient,
  tenantId: string,
  unitName: string,
) {
  const { data: units } = await supabase
    .from("units")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", unitName);
  const unitIds = (units ?? []).map((unit) => unit.id);
  if (unitIds.length === 0) return;

  await supabase.from("unit_settings").delete().in("unit_id", unitIds);
  await supabase.from("units").delete().in("id", unitIds);
}

test.describe("tenant and unit context", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("recupera tenant inválido em cache e troca unidade real pela UI", async ({ page }) => {
    const { supabase, userId } = await createSignedInSupabase();
    const marker = `e2e-unidade-${Date.now()}`;
    const unitName = `E2E Unidade Contexto ${marker}`;
    let createdUnitId = "";

    try {
      const { memberships, units } = await loadTenantContext(supabase, userId);
      const primaryMembership = memberships[0];
      const primaryTenant = primaryMembership.tenants;
      if (!primaryTenant) throw new Error("Tenant principal não foi retornado pela consulta.");

      const originalUnit =
        units.find((unit) => unit.tenant_id === primaryMembership.tenant_id && unit.is_default) ??
        units.find((unit) => unit.tenant_id === primaryMembership.tenant_id);
      if (!originalUnit) {
        throw new Error("Tenant principal não possui unidade para validar troca de contexto.");
      }

      await cleanupUnitByName(supabase, primaryMembership.tenant_id, unitName);

      const { data: createdUnit, error: unitError } = await supabase
        .from("units")
        .insert({
          tenant_id: primaryMembership.tenant_id,
          name: unitName,
          is_default: false,
          phone: "85977776666",
        })
        .select("id")
        .single();
      if (unitError) throw unitError;
      createdUnitId = createdUnit.id as string;

      await page.addInitScript(() => {
        window.localStorage.setItem("cativa.currentTenantId", "00000000-0000-4000-8000-000000000000");
        window.localStorage.setItem("cativa.currentUnitId", "00000000-0000-4000-8000-000000000001");
      });

      await page.goto("/app", { waitUntil: "commit", timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await page.locator("[data-app-main]").waitFor({ state: "visible", timeout: 30_000 });

      await expect(page.locator("header p", { hasText: primaryTenant.name })).toBeVisible({
        timeout: 30_000,
      });
      await expect
        .poll(async () => page.evaluate(() => window.localStorage.getItem("cativa.currentTenantId")))
        .not.toBe("00000000-0000-4000-8000-000000000000");

      await page.getByTestId("tenant-badge-trigger").click();
      const tenantSheet = page.getByRole("dialog", { name: "Estabelecimento" });
      await tenantSheet.getByTestId("tenant-switcher-trigger").click();
      await page
        .getByTestId("tenant-switcher-unit-option")
        .filter({ hasText: unitName })
        .click();

      await expect(tenantSheet.getByTestId("tenant-switcher-current-unit")).toContainText(unitName, {
        timeout: 15_000,
      });
      await expect
        .poll(async () => page.evaluate(() => window.localStorage.getItem("cativa.currentUnitId")))
        .toBe(createdUnitId);

      await tenantSheet.getByTestId("tenant-switcher-trigger").click();
      await page
        .getByTestId("tenant-switcher-unit-option")
        .filter({ hasText: originalUnit.name })
        .click();

      await expect(tenantSheet.getByTestId("tenant-switcher-current-unit")).toContainText(
        originalUnit.name,
        { timeout: 15_000 },
      );
      await expect
        .poll(async () => page.evaluate(() => window.localStorage.getItem("cativa.currentUnitId")))
        .toBe(originalUnit.id);
    } finally {
      if (createdUnitId) {
        await supabase.from("unit_settings").delete().eq("unit_id", createdUnitId);
        await supabase.from("units").delete().eq("id", createdUnitId);
      }
      if (unitName) {
        const { memberships } = await loadTenantContext(supabase, userId).catch(() => ({
          memberships: [],
          units: [],
        }));
        const tenantId = memberships[0]?.tenant_id;
        if (tenantId) await cleanupUnitByName(supabase, tenantId, unitName);
      }
      await supabase.auth.signOut();
    }
  });
});
