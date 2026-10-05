import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { getDestructiveE2ESkipReason } from "../_helpers/qaTarget";
import { assertNoHorizontalOverflow } from "../_helpers/visual";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() ?? "";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";
const OWNER_EMAIL = process.env.E2E_USER?.trim() ?? "";
const OWNER_PASSWORD = process.env.E2E_PASS?.trim() ?? "";
const TARGET_SKIP_REASON = getDestructiveE2ESkipReason();

type Slot = { slot_start: string; slot_end: string };

type ConfirmationFixture = {
  owner: SupabaseClient;
  admin: SupabaseClient;
  tenantId: string;
  appointmentId: string;
  clientId: string;
  clientName: string;
  queueItemId: string;
  marker: string;
};

type PartialConfirmationFixture = {
  admin: SupabaseClient;
  appointmentId: string;
  clientId?: string;
  tenantId?: string;
};

let fixture: ConfirmationFixture | null = null;

test.skip(Boolean(TARGET_SKIP_REASON), TARGET_SKIP_REASON ?? "Alvo QA local não autorizado.");
test.skip(
  !SUPABASE_URL || !PUBLISHABLE_KEY || !SERVICE_ROLE_KEY || !OWNER_EMAIL || !OWNER_PASSWORD,
  "Credenciais sintéticas de owner/service role ou configuração Supabase local ausentes.",
);

function newClient(key: string) {
  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function ensure<T>(data: T | null, error: { message: string } | null, action: string): T {
  if (error) throw new Error(`${action}: ${error.message}`);
  if (data === null) throw new Error(`${action}: resposta vazia.`);
  return data;
}

async function assertMobileDialogFits(page: Page, dialog: Locator): Promise<void> {
  await expect(dialog).toBeVisible();
  await assertNoHorizontalOverflow(page);

  const viewportWidth = page.viewportSize()?.width ?? 0;
  const box = await dialog.boundingBox();
  expect(box, "Dialog da confirmação precisa ter bounding box").not.toBeNull();
  expect(
    box!.width,
    `Dialog (${box!.width}px) deve caber em ${viewportWidth}px, com 8px de respiro lateral`,
  ).toBeLessThanOrEqual(viewportWidth - 16 + 1);
  expect(box!.x, "Dialog não pode sair pela borda esquerda").toBeGreaterThanOrEqual(7);
  expect(
    box!.x + box!.width,
    "Dialog não pode sair pela borda direita",
  ).toBeLessThanOrEqual(viewportWidth - 7);
}

function dateKeyInZone(timeZone: string, offsetDays: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays),
  )
    .toISOString()
    .slice(0, 10);
}

async function findFreeSlot(
  admin: SupabaseClient,
  tenantId: string,
  professionalId: string,
  unitId: string,
  serviceId: string,
  timezone: string,
) {
  for (let offset = 2; offset <= 35; offset += 1) {
    const day = dateKeyInZone(timezone, offset);
    const result = await admin.rpc("get_available_slots", {
      _tenant_id: tenantId,
      _professional_id: professionalId,
      _unit_id: unitId,
      _service_id: serviceId,
      _day: day,
      _slot_step_minutes: 15,
    });
    const slots = ensure(result.data as Slot[] | null, result.error, `buscar horários de ${day}`);
    if (slots.length > 0) return slots[0];
  }
  throw new Error("Nenhum horário livre encontrado para a fixture da Central de Confirmação.");
}

async function cleanupFixture(current: PartialConfirmationFixture) {
  const { admin, appointmentId } = current;
  if (appointmentId) {
    const operations = await Promise.all([
      admin.from("confirmation_queue").delete().eq("appointment_id", appointmentId),
      admin.from("appointment_items").delete().eq("appointment_id", appointmentId),
      admin.from("appointment_status_history").delete().eq("appointment_id", appointmentId),
    ]);
    const failed = operations.find((result) => result.error);
    if (failed?.error) throw new Error(`limpar fixture de confirmação: ${failed.error.message}`);

    const appointmentResult = await admin.from("appointments").delete().eq("id", appointmentId);
    if (appointmentResult.error) {
      throw new Error(`remover agendamento de confirmação: ${appointmentResult.error.message}`);
    }

    const [remainingAppointment, ...remainingChildren] = await Promise.all([
      admin.from("appointments").select("id").eq("id", appointmentId).maybeSingle(),
      ...(["confirmation_queue", "appointment_items", "appointment_status_history"] as const).map(
        (table) => admin.from(table).select("id").eq("appointment_id", appointmentId).limit(1).maybeSingle(),
      ),
    ]);
    const failedVerification = [remainingAppointment, ...remainingChildren].find(
      (result) => result.error,
    );
    if (failedVerification?.error) {
      throw new Error(`verificar limpeza da fixture de confirmação: ${failedVerification.error.message}`);
    }
    if (remainingAppointment.data || remainingChildren.some((result) => result.data)) {
      throw new Error("A fixture de confirmação permaneceu no banco após a limpeza.");
    }
  }

  if (current.clientId && current.tenantId) {
    const clientResult = await admin
      .from("clients")
      .select("id, tenant_id, origin")
      .eq("id", current.clientId)
      .maybeSingle();
    if (clientResult.error) {
      throw new Error(`verificar cliente sintético da confirmação: ${clientResult.error.message}`);
    }
    if (clientResult.data) {
      if (
        clientResult.data.tenant_id !== current.tenantId ||
        !["e2e_local_confirmation", "fixture-e2e"].includes(clientResult.data.origin ?? "")
      ) {
        throw new Error("Recusada a limpeza de um cliente que não corresponde à fixture sintética.");
      }
      const references = await admin
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", current.tenantId)
        .eq("client_id", current.clientId);
      if (references.error || (references.count ?? 0) > 0) {
        throw new Error("O cliente sintético ainda está referenciado por agendamentos.");
      }
    }
    const clientDelete = await admin
      .from("clients")
      .delete()
      .eq("tenant_id", current.tenantId)
      .eq("id", current.clientId)
      .in("origin", ["e2e_local_confirmation", "fixture-e2e"]);
    const clientDeleteError = clientDelete.error;
    if (clientDeleteError) {
      throw new Error(`remover cliente sintético da confirmação: ${clientDeleteError.message}`);
    }
    const remainingClient = await admin
      .from("clients")
      .select("id")
      .eq("tenant_id", current.tenantId)
      .eq("id", current.clientId)
      .maybeSingle();
    if (remainingClient.error || remainingClient.data) {
      throw new Error("O cliente sintético permaneceu no banco após a limpeza.");
    }
  }
}

async function cleanupStaleConfirmationFixtures(admin: SupabaseClient, tenantId: string) {
  const staleResult = await admin
    .from("appointments")
    .select("id, internal_notes, client_id")
    .eq("tenant_id", tenantId)
    .like("internal_notes", "E2E_FIXTURE_CONFIRMATION_MODAL%")
    .limit(100);
  const staleRows = ensure(staleResult.data, staleResult.error, "buscar fixtures antigas da confirmação");
  const staleRowsForCleanup = staleRows
    .filter((row) => row.internal_notes?.startsWith("E2E_FIXTURE_CONFIRMATION_MODAL_"))
    .map((row) => ({ id: row.id as string, clientId: row.client_id as string | undefined }));
  for (const stale of staleRowsForCleanup) {
    await cleanupFixture({ admin, appointmentId: stale.id, clientId: stale.clientId, tenantId });
  }
}

async function readFixtureStatuses(current: ConfirmationFixture) {
  const [appointment, queueItem] = await Promise.all([
    current.owner
      .from("appointments")
      .select("status, confirmed_at, canceled_at, canceled_reason")
      .eq("tenant_id", current.tenantId)
      .eq("id", current.appointmentId)
      .single(),
    current.owner
      .from("confirmation_queue")
      .select("status, closed_at")
      .eq("tenant_id", current.tenantId)
      .eq("id", current.queueItemId)
      .single(),
  ]);
  if (appointment.error) throw appointment.error;
  if (queueItem.error) throw queueItem.error;
  return {
    appointmentStatus: appointment.data.status,
    confirmedAt: appointment.data.confirmed_at,
    canceledAt: appointment.data.canceled_at,
    canceledReason: appointment.data.canceled_reason,
    queueStatus: queueItem.data.status,
    queueClosedAt: queueItem.data.closed_at,
  };
}

test.beforeEach(async () => {
  const owner = newClient(PUBLISHABLE_KEY);
  const admin = newClient(SERVICE_ROLE_KEY);
  const ownerAuth = await owner.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  const ownerUser = ensure(ownerAuth.data.user, ownerAuth.error, "resolver owner QA");
  let appointmentId = "";
  let currentFixture: PartialConfirmationFixture | null = null;

  try {
    const membershipResult = await owner
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", ownerUser.id)
      .eq("status", "active")
      .single();
    const membership = ensure(membershipResult.data, membershipResult.error, "resolver tenant do owner");
    const tenantId = membership.tenant_id as string;
    await cleanupStaleConfirmationFixtures(admin, tenantId);

    const [tenantResult, professionalResult, serviceResult] = await Promise.all([
      admin.from("tenants").select("timezone").eq("id", tenantId).single(),
      admin
        .from("professionals")
        .select("id, unit_id")
        .eq("tenant_id", tenantId)
        .eq("display_name", "Profissional QA Local")
        .eq("is_active", true)
        .single(),
      admin
        .from("services")
        .select("id, duration_minutes")
        .eq("tenant_id", tenantId)
        .eq("internal_code", "E2E-CONFIRMATION")
        .eq("is_active", true)
        .single(),
    ]);
    const tenant = ensure(tenantResult.data, tenantResult.error, "buscar tenant QA");
    const professional = ensure(professionalResult.data, professionalResult.error, "buscar profissional QA");
    const service = ensure(serviceResult.data, serviceResult.error, "buscar serviço QA");
    const unitId = professional.unit_id as string | null;
    if (!unitId) throw new Error("O profissional QA precisa estar associado a uma unidade.");

    const timezone = tenant.timezone || "America/Sao_Paulo";
    const slot = await findFreeSlot(
      admin,
      tenantId,
      professional.id as string,
      unitId,
      service.id as string,
      timezone,
    );
    const marker = `E2E_FIXTURE_CONFIRMATION_MODAL_${randomUUID()}`;
    const clientName = `Cliente QA Confirmação ${randomUUID().slice(0, 8)}`;
    const clientResult = await admin
      .from("clients")
      .insert({
        tenant_id: tenantId,
        preferred_unit_id: unitId,
        full_name: clientName,
        email: `${randomUUID()}@cativa.test`,
        status: "active",
        origin: "e2e_local_confirmation",
        created_by: ownerUser.id,
      })
      .select("id")
      .single();
    const client = ensure(clientResult.data, clientResult.error, "criar cliente sintético QA");
    currentFixture = { admin, appointmentId: "", clientId: client.id as string, tenantId };
    const appointmentResult = await admin
      .from("appointments")
      .insert({
        tenant_id: tenantId,
        unit_id: unitId,
        client_id: client.id,
        professional_id: professional.id,
        starts_at: slot.slot_start,
        ends_at: slot.slot_end,
        duration_minutes: service.duration_minutes,
        status: "pending",
        source: "frontdesk",
        total_price_cents: 10000,
        internal_notes: marker,
        created_by: ownerUser.id,
      })
      .select("id")
      .single();
    const appointment = ensure(appointmentResult.data, appointmentResult.error, "criar agendamento QA");
    appointmentId = appointment.id as string;
    currentFixture.appointmentId = appointmentId;

    const itemResult = await admin.from("appointment_items").insert({
      tenant_id: tenantId,
      appointment_id: appointmentId,
      service_id: service.id,
      duration_minutes: service.duration_minutes,
      price_cents: 10000,
      position: 0,
    });
    if (itemResult.error) throw new Error(`vincular serviço QA: ${itemResult.error.message}`);

    const queuePayload = {
      tenant_id: tenantId,
      appointment_id: appointmentId,
      client_id: client.id,
      stage: "today",
      status: "pending",
      priority: 80,
      scheduled_for: new Date().toISOString(),
      appointment_starts_at: slot.slot_start,
      attempts_count: 0,
      closed_at: null,
      notes: marker,
    };
    const existingQueue = await admin
      .from("confirmation_queue")
      .select("id")
      .eq("appointment_id", appointmentId)
      .eq("stage", "today")
      .maybeSingle();
    if (existingQueue.error) throw existingQueue.error;

    const queueResult = existingQueue.data
      ? await admin
          .from("confirmation_queue")
          .update(queuePayload)
          .eq("id", existingQueue.data.id)
          .select("id")
          .single()
      : await admin.from("confirmation_queue").insert(queuePayload).select("id").single();
    const queueItem = ensure(queueResult.data, queueResult.error, "criar item da fila QA");

    currentFixture = {
      owner,
      admin,
      tenantId,
      appointmentId,
      clientId: client.id as string,
      clientName,
      queueItemId: queueItem.id as string,
      marker,
    };
    fixture = currentFixture;
  } catch (error) {
    try {
      if (currentFixture) await cleanupFixture(currentFixture);
    } finally {
      await owner.auth.signOut();
    }
    throw error;
  }
});

test.afterEach(async () => {
  const current = fixture;
  fixture = null;
  if (!current) return;
  try {
    await cleanupFixture(current);
  } finally {
    await current.owner.auth.signOut();
  }
});

test.describe("Central de Confirmação com tenant local descartável", () => {
  test("confirmar na fila atual atualiza o agendamento e fecha a tarefa", async ({ page }) => {
    if (!fixture) throw new Error("Fixture local da Central de Confirmação não preparada.");
    const current = fixture;

    await page.goto("/app/confirmacoes", { waitUntil: "domcontentloaded" });
    const queueCard = page
      .locator("[data-app-main] [data-queue-item]")
      .filter({ hasText: current.clientName });
    await expect(queueCard).toHaveCount(1);
    await expect(queueCard).toBeVisible({ timeout: 30_000 });
    const confirmButton = queueCard.getByRole("button", { name: "Confirmar", exact: true });
    // Evita que o scroll suave da página dispute com a rolagem automática do
    // click e deixe o alvo sob o header fixo ou o BottomNav em viewports mobile.
    await page.addStyleTag({
      content: "html, body, * { scroll-behavior: auto !important; transition-duration: 0.01ms !important; }",
    });
    await confirmButton.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }),
    );
    // Em WebKit/iPhone, scrollIntoView(center) pode manter um alvo que já está
    // parcialmente visível logo abaixo do topo da viewport, embora o header
    // sticky o cubra. Ajusta somente a rolagem da página pelo tamanho real do
    // header; a asserção abaixo continua exigindo que o botão fique totalmente
    // fora das áreas cobertas pelo header e pela navegação inferior.
    await confirmButton.evaluate((element) => {
      const header = document.querySelector('[data-testid="tenant-badge-trigger"]')?.closest("header");
      if (!header) throw new Error("Header do app não encontrado para validar a área segura.");

      const topLimit = header.getBoundingClientRect().bottom + 8;
      const topDelta = element.getBoundingClientRect().top - topLimit;
      if (topDelta < 0) window.scrollBy(0, topDelta);
    });
    await expect(confirmButton).toBeInViewport();
    const buttonBox = await confirmButton.boundingBox();
    const fixedChrome = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="tenant-badge-trigger"]')?.closest("header");
      const bottomNav = document.querySelector('nav[aria-label="Navegação principal"]');
      return {
        headerBottom: header?.getBoundingClientRect().bottom ?? 0,
        bottomNavTop: bottomNav?.getBoundingClientRect().top ?? window.innerHeight,
      };
    });
    expect(buttonBox, "Botão de confirmação precisa ter posição mensurável").not.toBeNull();
    expect(buttonBox!.y, "Botão não pode ficar sob o header fixo").toBeGreaterThan(fixedChrome.headerBottom + 8);
    expect(buttonBox!.y + buttonBox!.height, "Botão não pode ficar sob a navegação fixa").toBeLessThan(fixedChrome.bottomNavTop - 8);
    await confirmButton.click();
    await expect
      .poll(() => readFixtureStatuses(current), { timeout: 20_000 })
      .toMatchObject({ appointmentStatus: "confirmed", queueStatus: "confirmed" });
    await expect(page.getByText("Status atualizado", { exact: true })).toBeVisible({ timeout: 5_000 });

    const finalState = await readFixtureStatuses(current);
    expect(finalState.confirmedAt).toBeTruthy();
    expect(finalState.queueClosedAt).toBeTruthy();
  });

  test("cancelar pela central cancela o agendamento e não o marca como confirmado", async ({ page }) => {
    if (!fixture) throw new Error("Fixture local da Central de Confirmação não preparada.");
    const current = fixture;

    await page.goto("/app/confirmacoes", { waitUntil: "domcontentloaded" });
    const queueCard = page
      .locator("[data-app-main] [data-queue-item]")
      .filter({ hasText: current.clientName });
    await expect(queueCard).toBeVisible({ timeout: 30_000 });
    const actionsButton = queueCard.getByRole("button", { name: "Ações", exact: true });
    await actionsButton.click();

    const dialog = page.getByRole("dialog").first();
    await assertMobileDialogFits(page, dialog);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(actionsButton, "Foco deve voltar ao controle que abriu o dialog").toBeFocused();

    await actionsButton.click();
    await assertMobileDialogFits(page, dialog);
    await dialog.getByRole("tab", { name: "Status", exact: true }).click();
    await dialog.getByRole("button", { name: "Cancelou", exact: true }).click();

    await expect
      .poll(() => readFixtureStatuses(current), { timeout: 20_000 })
      .toMatchObject({ appointmentStatus: "canceled", queueStatus: "canceled", confirmedAt: null });
    const finalState = await readFixtureStatuses(current);
    expect(finalState.canceledAt).toBeTruthy();
    expect(finalState.canceledReason).toBe("Cancelamento registrado na Central de Confirmação.");
    expect(finalState.queueClosedAt).toBeTruthy();
  });
});
