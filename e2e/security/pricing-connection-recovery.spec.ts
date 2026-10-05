import { expect, test } from "@playwright/test";
import { assertPublicBackendWasIsolated, mockPublicBackend } from "../_helpers/publicMocks";
import { assertNoHorizontalOverflow } from "../_helpers/visual";

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "apikey, authorization, x-client-info, content-type, prefer",
  "access-control-allow-methods": "GET, POST, OPTIONS",
};

test.describe("rotas públicas — recuperação de conexão em planos", () => {
  test("mostra fallback após HTTP 503 e carrega o catálogo ao tentar novamente", async ({ page }) => {
    // Keep the fault-injection run offline from third-party asset CDNs too.
    await page.route("https://fonts.googleapis.com/**", (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: "" }),
    );
    await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
    await mockPublicBackend(page);

    let failedPlanReads = 0;
    let recoveredPlanReads = 0;
    let featureReads = 0;
    let allowRecovery = false;
    let serveFreeComeco = false;

    await page.route("**/rest/v1/plans**", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      if (!allowRecovery) {
        failedPlanReads += 1;
        await route.fulfill({
          status: 503,
          headers: { ...corsHeaders, "retry-after": "0" },
          contentType: "application/json",
          body: JSON.stringify({ code: "503", message: "Serviço temporariamente indisponível" }),
        });
        return;
      }

      recoveredPlanReads += 1;
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(serveFreeComeco
          ? [{
              id: "qa-comeco",
              code: "comeco",
              name: "Começo",
              description: "Plano sintético de entrada com avaliação de 30 dias.",
              billing_period: "monthly",
              price_cents: 0,
              currency: "BRL",
              trial_days: 30,
              grace_period_days: 0,
              max_units: 1,
              max_professionals: 1,
              max_active_clients: 100,
              max_storage_mb: 256,
              max_appointments_month: 30,
              status: "public",
              is_default: true,
              features: {},
              display_order: 1,
              created_at: "2026-10-01T00:00:00.000Z",
              updated_at: "2026-10-02T00:00:00.000Z",
            }]
          : [{
              id: "qa-plan-recovery",
              code: "qa-recovery",
              name: "Plano QA recuperado",
              description: "Plano sintético para verificar a recuperação após falha.",
              billing_period: "monthly",
              price_cents: 12345,
              currency: "BRL",
              trial_days: 14,
              grace_period_days: 7,
              max_units: 2,
              max_professionals: 10,
              max_active_clients: 500,
              max_storage_mb: 1024,
              max_appointments_month: 5000,
              status: "public",
              is_default: true,
              features: {},
              display_order: 1,
              created_at: "2026-10-01T00:00:00.000Z",
              updated_at: "2026-10-02T00:00:00.000Z",
            }]),
      });
    });

    await page.route("**/rest/v1/plan_features**", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      featureReads += 1;
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: "[]",
      });
    });

    await page.goto("/planos", { waitUntil: "domcontentloaded" });

    const connectionAlert = page.getByRole("alert");
    // The real PostgREST client retries retryable 503s before surfacing an
    // error; Retry-After: 0 keeps this deterministic without bypassing retries.
    await expect(connectionAlert).toContainText("Falha na conexão", { timeout: 15_000 });
    const retryButton = connectionAlert.getByRole("button", { name: "Tentar novamente" });
    await expect(retryButton).toBeEnabled();
    const retryBox = await retryButton.boundingBox();
    expect(retryBox, "o botão de nova tentativa deve permanecer visível").not.toBeNull();
    expect(retryBox!.width, "o alvo de toque deve ter ao menos 44 CSS px de largura").toBeGreaterThanOrEqual(44);
    expect(retryBox!.height, "o alvo de toque deve ter ao menos 44 CSS px de altura").toBeGreaterThanOrEqual(44);
    for (const planName of ["Começo", "Solo", "Equipe", "Rede"]) {
      await expect(page.getByRole("heading", { name: planName, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Grátis por 30 dias · sem cartão", { exact: true })).toBeVisible();
    await expect(page.getByText(/57,90/)).toBeVisible();
    await expect(page.getByText(/97,90/)).toBeVisible();
    await expect(page.getByText(/247,90/)).toBeVisible();
    await expect(page.getByText("Até 30 agendamentos por mês", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Apoio", exact: true })).toHaveCount(0);
    await expect(page.getByText("[object Object]")).toHaveCount(0);
    await assertNoHorizontalOverflow(page);
    expect(failedPlanReads, "a resposta 503 deve atravessar o retry automático do cliente").toBeGreaterThan(1);

    allowRecovery = true;
    await retryButton.click();

    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Plano QA recuperado", exact: true })).toBeVisible();
    await expect(page.getByText(/123,45/)).toBeVisible();
    expect(recoveredPlanReads).toBeGreaterThan(0);
    expect(featureReads).toBe(1);

    serveFreeComeco = true;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Começo", exact: true })).toBeVisible();
    await expect(page.getByText("Grátis", { exact: true })).toBeVisible();
    await expect(page.getByText("Grátis por 30 dias · sem cartão", { exact: true })).toBeVisible();
    await expect(page.getByText("Sob consulta", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Plano gratuito para sempre · sem cartão", { exact: true })).toHaveCount(0);
    await assertNoHorizontalOverflow(page);

    assertPublicBackendWasIsolated(page);
  });
});
