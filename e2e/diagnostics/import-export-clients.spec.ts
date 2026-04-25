import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
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

async function cleanupClientByName(
  supabase: SupabaseClient,
  tenantId: string,
  fullName: string,
) {
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("full_name", fullName);
  if (clientsError) throw clientsError;

  const clientIds = (clients ?? []).map((client) => client.id as string);
  if (clientIds.length === 0) return;

  await supabase.from("client_files").delete().in("client_id", clientIds);
  await supabase.from("client_photos").delete().in("client_id", clientIds);
  await supabase.from("client_timeline_events").delete().in("client_id", clientIds);
  await supabase.from("client_tag_relations").delete().in("client_id", clientIds);
  await supabase.from("client_notes").delete().in("client_id", clientIds);
  await supabase.from("clients").delete().in("id", clientIds);
}

test.describe("import/export de clientes", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("importa cliente via CSV e exporta a base contendo o registro importado", async ({ page }) => {
    const { supabase, userId } = await createSignedInSupabase();
    const tenantId = await loadTenantId(supabase, userId);
    const marker = `cativa-import-export-${Date.now()}`;
    const fullName = `E2E Import Export Cliente ${marker}`;
    const email = `${marker}@cativa.test`;

    await cleanupClientByName(supabase, tenantId, fullName);

    try {
      await page.goto("/app/dados", { waitUntil: "commit", timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await page.locator("[data-app-main]").waitFor({ state: "visible", timeout: 30_000 });
      await expect(page.getByTestId("import-export-page")).toBeVisible({ timeout: 30_000 });

      const csv = [
        "\ufeffnome,telefone,whatsapp,email,cidade,uf,origem,observacoes,vip",
        `${fullName},85999990000,85999990000,${email},Fortaleza,CE,E2E Import Export,Registro automatizado,true`,
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

      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("clients")
              .select("id, email")
              .eq("tenant_id", tenantId)
              .eq("full_name", fullName)
              .maybeSingle();
            return data?.email ?? "";
          },
          { timeout: 20_000 },
        )
        .toBe(email);

      await page.getByTestId("import-export-tab-export").click();
      await expect(page.getByTestId("export-card-clients")).toBeVisible({ timeout: 15_000 });

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByTestId("export-clients-csv").click(),
      ]);
      const downloadPath = await download.path();
      if (!downloadPath) throw new Error("Playwright não retornou o arquivo exportado.");

      const exportedCsv = await readFile(downloadPath, "utf8");
      expect(exportedCsv).toContain("nome,telefone,whatsapp,email");
      expect(exportedCsv).toContain(fullName);
      expect(exportedCsv).toContain(email);
    } finally {
      await cleanupClientByName(supabase, tenantId, fullName);
      await supabase.auth.signOut();
    }
  });
});
