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

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return supabase;
}

async function cleanupClientByName(supabase: SupabaseClient, fullName: string) {
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id")
    .eq("full_name", fullName);
  if (clientsError) throw clientsError;

  const clientIds = (clients ?? []).map((client) => client.id);
  if (clientIds.length === 0) return;

  const { data: files } = await supabase
    .from("client_files")
    .select("storage_path")
    .in("client_id", clientIds);
  const { data: photos } = await supabase
    .from("client_photos")
    .select("storage_path")
    .in("client_id", clientIds);

  const paths = [...(files ?? []), ...(photos ?? [])]
    .map((item) => item.storage_path)
    .filter((path): path is string => Boolean(path));

  if (paths.length > 0) {
    await supabase.storage.from("client-media").remove(paths);
  }

  await supabase.from("client_files").delete().in("client_id", clientIds);
  await supabase.from("client_photos").delete().in("client_id", clientIds);
  await supabase.from("client_timeline_events").delete().in("client_id", clientIds);
  await supabase.from("client_tag_relations").delete().in("client_id", clientIds);
  await supabase.from("client_notes").delete().in("client_id", clientIds);
  await supabase.from("clients").delete().in("id", clientIds);
}

test.describe("CRM media", () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(!HAS_E2E_AUTH, AUTH_SKIP_REASON);

  test("faz upload e remove arquivo e foto pela UI do CRM", async ({ page }) => {
    const supabase = await createSignedInSupabase();
    const marker = `cativa-crm-media-${Date.now()}`;
    const fullName = `E2E Cliente Midia ${marker}`;
    const fileName = `${marker}.txt`;
    const photoName = `${marker}.svg`;
    const description = "Arquivo gerado pelo E2E para validar CRM media";
    const photoCaption = "Foto gerada pelo E2E para validar CRM media";
    let fileStoragePath = "";
    let photoStoragePath = "";

    await cleanupClientByName(supabase, fullName);

    try {
      await page.goto("/app/clientes", { waitUntil: "commit", timeout: 15_000 });
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await page.locator("[data-app-main]").waitFor({ state: "visible", timeout: 30_000 });

      await page.getByTestId("clients-create-cta").click();
      const dialog = page.getByRole("dialog", { name: /novo cliente/i });
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      await dialog.getByTestId("client-form-full-name").fill(fullName);
      await dialog.getByTestId("client-form-email").fill(`${marker}@cativa.test`);
      await dialog.getByTestId("client-form-phone").fill("85999999999");
      await dialog.getByTestId("client-form-origin").fill("E2E CRM media");
      await dialog.getByTestId("client-form-submit").click();

      await expect(page.getByText("Cliente cadastrado", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByRole("heading", { name: fullName })).toBeVisible({
        timeout: 20_000,
      });

      await page.getByTestId("client-media-tab").click();
      await page.getByTestId("client-file-description").fill(description);
      await page.getByTestId("client-file-upload-input").setInputFiles({
        name: fileName,
        mimeType: "text/plain",
        buffer: Buffer.from(`${marker}\n`, "utf8"),
      });

      const fileItem = page.getByTestId("client-file-item").filter({ hasText: fileName });
      await expect(fileItem).toBeVisible({ timeout: 30_000 });
      await expect(fileItem).toContainText(description);

      let fileRecord: { storage_path: string; file_name: string } | null = null;

      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("client_files")
              .select("storage_path, file_name")
              .eq("file_name", fileName)
              .maybeSingle();
            fileRecord = data;
            return Boolean(data?.storage_path);
          },
          { timeout: 20_000 },
        )
        .toBe(true);

      fileStoragePath = fileRecord!.storage_path;

      const { data: signedData, error: signedError } = await supabase.storage
        .from("client-media")
        .createSignedUrl(fileStoragePath, 60);
      expect(signedError).toBeNull();
      expect(signedData?.signedUrl).toBeTruthy();

      const response = await fetch(signedData!.signedUrl);
      expect(response.ok).toBe(true);
      await expect(response.text()).resolves.toContain(marker);

      await fileItem.getByTestId("client-file-remove").click();
      await expect(page.getByText("Arquivo removido", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(fileItem).toHaveCount(0, { timeout: 20_000 });

      await expect
        .poll(
          async () => {
            const { count } = await supabase
              .from("client_files")
              .select("id", { count: "exact", head: true })
              .eq("file_name", fileName);
            return count ?? 0;
          },
          { timeout: 20_000 },
        )
        .toBe(0);

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"><title>${marker}</title><rect width="12" height="12" fill="#f97316"/></svg>`;

      await page.getByTestId("client-photo-caption").fill(photoCaption);
      await page.getByTestId("client-photo-upload-input").setInputFiles({
        name: photoName,
        mimeType: "image/svg+xml",
        buffer: Buffer.from(svg, "utf8"),
      });

      const photoItem = page.getByTestId("client-photo-item").filter({ hasText: photoCaption });
      await expect(photoItem).toBeVisible({ timeout: 30_000 });

      let photoRecord: { storage_path: string; caption: string | null } | null = null;

      await expect
        .poll(
          async () => {
            const { data } = await supabase
              .from("client_photos")
              .select("storage_path, caption")
              .eq("caption", photoCaption)
              .maybeSingle();
            photoRecord = data;
            return Boolean(data?.storage_path);
          },
          { timeout: 20_000 },
        )
        .toBe(true);

      photoStoragePath = photoRecord!.storage_path;

      const { data: photoSignedData, error: photoSignedError } = await supabase.storage
        .from("client-media")
        .createSignedUrl(photoStoragePath, 60);
      expect(photoSignedError).toBeNull();
      expect(photoSignedData?.signedUrl).toBeTruthy();

      const photoResponse = await fetch(photoSignedData!.signedUrl);
      expect(photoResponse.ok).toBe(true);
      await expect(photoResponse.text()).resolves.toContain(marker);

      await photoItem.getByTestId("client-photo-remove").click();
      await expect(page.getByText("Foto removida", { exact: true })).toBeVisible({
        timeout: 20_000,
      });
      await expect(photoItem).toHaveCount(0, { timeout: 20_000 });

      await expect
        .poll(
          async () => {
            const { count } = await supabase
              .from("client_photos")
              .select("id", { count: "exact", head: true })
              .eq("caption", photoCaption);
            return count ?? 0;
          },
          { timeout: 20_000 },
        )
        .toBe(0);
    } finally {
      const paths = [fileStoragePath, photoStoragePath].filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from("client-media").remove(paths);
      }
      await cleanupClientByName(supabase, fullName);
      await supabase.auth.signOut();
    }
  });
});
