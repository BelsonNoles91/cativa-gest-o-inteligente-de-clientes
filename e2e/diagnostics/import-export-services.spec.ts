import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";
import { AUTH_SKIP_REASON, HAS_E2E_AUTH } from "../_helpers/auth";
import { getDestructiveE2ESkipReason } from "../_helpers/qaTarget";

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

async function loadTenantId(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(1)
    .single();
  if (error) throw error;
  return data.tenant_id as string;
}

async function cleanupServiceByName(
  supabase: SupabaseClient,
  tenantId: string,
  serviceName: string,
) {
  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", serviceName);
  if (servicesError) throw servicesError;

  const serviceIds = (services ?? []).map((service) => service.id as string);
  if (serviceIds.length === 0) return;

  await supabase.from("service_prices").delete().in("service_id", serviceIds);
  await supabase.from("professional_services").delete().in("service_id", serviceIds);
  await supabase.from("service_resource_requirements").delete().in("service_id", serviceIds);
  await supabase.from("appointment_items").delete().in("service_id", serviceIds);
  await supabase.from("services").delete().in("id", serviceIds);
}

test.describe("import/export de serviços", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);
  const qaTargetSkipReason = getDestructiveE2ESkipReason();
  test.skip(Boolean(qaTargetSkipReason), qaTargetSkipReason ?? "");

  test("importa serviço via CSV e exporta o catálogo contendo o registro importado", async ({ page }) => {
    const { supabase, userId } = await createSignedInSupabase();
    const tenantId = await loadTenantId(supabase, userId);
    const marker = `cativa-import-export-service-${Date.now()}`;
    const serviceName = `E2E Serviço Import Export ${marker}`;
    const description = `Servico automatizado ${marker}`;

    await cleanupServiceByName(supabase, tenantId, serviceName);

    try {
      await page.goto("/app/dados", { waitUntil: "commit", timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await page.locator("[data-app-main]").waitFor({ state: "visible", timeout: 30_000 });
      await expect(page.getByTestId("import-export-page")).toBeVisible({ timeout: 30_000 });

      await page.getByTestId("import-entity-trigger").click();
      await page.getByTestId("import-entity-services").click();

      const csv = [
        "\ufeffnome,duracao_minutos,preco,buffer_antes,buffer_depois,descricao",
        `${serviceName},75,149.90,5,10,${description}`,
        "",
      ].join("\r\n");

      await page.getByTestId("import-csv-input").setInputFiles({
        name: `${marker}.csv`,
        mimeType: "text/csv",
        buffer: Buffer.from(csv, "utf8"),
      });

      await expect(page.getByText("Tudo validado", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByTestId("import-run-button")).toBeEnabled();
      await page.getByTestId("import-run-button").click();

      await expect(page.getByTestId("import-result")).toContainText("Inseridos: 1", {
        timeout: 30_000,
      });
      await expect(page.getByTestId("import-result")).toContainText("Falharam: 0");

      let serviceId = "";
      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("services")
              .select("id, duration_minutes, buffer_before_minutes, buffer_after_minutes, description")
              .eq("tenant_id", tenantId)
              .eq("name", serviceName)
              .maybeSingle();
            serviceId = (data?.id as string | undefined) ?? "";
            return {
              duration: data?.duration_minutes ?? 0,
              before: data?.buffer_before_minutes ?? -1,
              after: data?.buffer_after_minutes ?? -1,
              description: data?.description ?? "",
            };
          },
          { timeout: 20_000 },
        )
        .toEqual({
          duration: 75,
          before: 5,
          after: 10,
          description,
        });

      await expect
        .poll(
          async () => {
            if (!serviceId) return 0;
            const { data } = await supabase
              .from("service_prices")
              .select("amount_cents")
              .eq("tenant_id", tenantId)
              .eq("service_id", serviceId)
              .eq("is_default", true)
              .maybeSingle();
            return data?.amount_cents ?? 0;
          },
          { timeout: 20_000 },
        )
        .toBe(14990);

      await page.getByTestId("import-export-tab-export").click();
      await expect(page.getByTestId("export-card-services")).toBeVisible({ timeout: 15_000 });

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByTestId("export-services-csv").click(),
      ]);
      const downloadPath = await download.path();
      if (!downloadPath) throw new Error("Playwright não retornou o arquivo exportado.");

      const exportedCsv = await readFile(downloadPath, "utf8");
      expect(exportedCsv).toContain("nome,categoria,duracao_minutos,preco");
      expect(exportedCsv).toContain(serviceName);
      expect(exportedCsv).toContain(description);
      expect(exportedCsv).toContain("149.9");
    } finally {
      await cleanupServiceByName(supabase, tenantId, serviceName);
      await supabase.auth.signOut();
    }
  });
});
