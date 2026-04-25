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

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
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

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
      return { supabase, userId: data.user.id };
    }
    lastError = error ?? new Error("Login E2E não retornou usuário.");
    await sleep(attempt * 1000);
  }

  throw lastError instanceof Error ? lastError : new Error("Falha ao autenticar no Supabase.");
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

async function cleanupProfessionalByDisplayName(
  supabase: SupabaseClient,
  displayName: string,
) {
  const { data: professionals, error: professionalsError } = await supabase
    .from("professionals")
    .select("id")
    .eq("display_name", displayName);
  if (professionalsError) throw professionalsError;

  const professionalIds = (professionals ?? []).map((professional) => professional.id as string);
  if (professionalIds.length === 0) return;

  await supabase.from("team_invitations").delete().in("professional_id", professionalIds);
  await supabase.from("service_professional_prices").delete().in("professional_id", professionalIds);
  await supabase.from("professional_services").delete().in("professional_id", professionalIds);
  await supabase.from("professional_availability").delete().in("professional_id", professionalIds);
  await supabase.from("time_off_blocks").delete().in("professional_id", professionalIds);
  await supabase.from("recurring_blocks").delete().in("professional_id", professionalIds);
  await supabase.from("professionals").delete().in("id", professionalIds);
}

test.describe("import/export de equipe", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("importa profissional via CSV e exporta a equipe contendo o registro importado", async ({ page }) => {
    const { supabase, userId } = await createSignedInSupabase();
    await loadTenantId(supabase, userId);
    const marker = `cativa-import-export-team-${Date.now()}`;
    const displayName = `E2E Profissional Import Export ${marker}`;
    const email = `${marker}@cativa.test`;
    const phone = "85988887777";

    await cleanupProfessionalByDisplayName(supabase, displayName);

    try {
      await page.goto("/app/dados", { waitUntil: "commit", timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await page.locator("[data-app-main]").waitFor({ state: "visible", timeout: 30_000 });
      await expect(page.getByTestId("import-export-page")).toBeVisible({ timeout: 30_000 });

      await page.getByTestId("import-entity-trigger").click();
      await page.getByTestId("import-entity-team").click();

      const csv = [
        "\ufeffapelido_publico,funcao,especialidade,email,telefone,comissao,ativo",
        `${displayName},Especialista QA,Estetica automatizada,${email},${phone},17.5,sim`,
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
              .from("professionals")
              .select("id, tenant_id, display_name, role_title, specialty, email, phone, is_active")
              .eq("display_name", displayName)
              .maybeSingle();
            if (!data) return null;

            const { data: commissionRows } = await supabase.rpc(
              "list_professionals_with_commission",
              { _tenant_id: data.tenant_id },
            );
            const commission = (commissionRows ?? []).find((row) => row.id === data.id);

            return {
              roleTitle: data?.role_title ?? "",
              specialty: data?.specialty ?? "",
              email: data?.email ?? "",
              phone: data?.phone ?? "",
              commissionPct: Number(commission?.commission_pct ?? 0),
              isActive: Boolean(data?.is_active),
            };
          },
          { timeout: 20_000 },
        )
        .toEqual({
          roleTitle: "Especialista QA",
          specialty: "Estetica automatizada",
          email,
          phone,
          commissionPct: 17.5,
          isActive: true,
        });

      await page.getByTestId("import-export-tab-export").click();
      await expect(page.getByTestId("export-card-team")).toBeVisible({ timeout: 15_000 });

      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 30_000 }),
        page.getByTestId("export-team-csv").click(),
      ]);
      const downloadPath = await download.path();
      if (!downloadPath) throw new Error("Playwright não retornou o arquivo exportado.");

      const exportedCsv = await readFile(downloadPath, "utf8");
      expect(exportedCsv).toContain("apelido_publico,funcao,especialidade,email");
      expect(exportedCsv).toContain(displayName);
      expect(exportedCsv).toContain(email);
      expect(exportedCsv).toContain("17.5");
    } finally {
      await cleanupProfessionalByDisplayName(supabase, displayName);
      await supabase.auth.signOut();
    }
  });
});
