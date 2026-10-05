import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { getDestructiveE2ESkipReason } from "../_helpers/qaTarget";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL?.trim() ?? "";
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const OWNER_EMAIL = process.env.E2E_USER?.trim() ?? "";
const OWNER_PASSWORD = process.env.E2E_PASS?.trim() ?? "";
const CLIENT_EMAIL = process.env.E2E_CLIENT_USER?.trim() ?? "";
const CLIENT_PASSWORD = process.env.E2E_CLIENT_PASS?.trim() ?? "";
const TARGET_SKIP_REASON = getDestructiveE2ESkipReason();

type Slot = { slot_start: string; slot_end: string };

type PortalFixture = {
  owner: SupabaseClient;
  client: SupabaseClient;
  tenantId: string;
  unitId: string;
  clientId: string;
  ownerUserId: string;
  clientSession: Record<string, unknown>;
  clientUser: Record<string, unknown>;
  serviceId: string;
  professionalId: string;
  timezone: string;
  ownAppointmentId: string | null;
  foreignAppointmentId: string | null;
  foreignClientId: string | null;
  waitlistId: string | null;
  confirmationQueueId: string | null;
  marker: string;
  originalRules: Record<string, unknown> | null;
};

type TemporaryPortalCatalog = {
  serviceId: string;
  serviceCreated: boolean;
  priceId: string | null;
  priceCreated: boolean;
  previousVisibility: { is_active: boolean; is_public: boolean } | null;
};

let fixture: PortalFixture | null = null;
let temporaryPortalCatalog: TemporaryPortalCatalog | null = null;

test.skip(Boolean(TARGET_SKIP_REASON), TARGET_SKIP_REASON ?? "Alvo QA local não autorizado.");
test.skip(
  !SUPABASE_URL || !PUBLISHABLE_KEY || !OWNER_EMAIL || !OWNER_PASSWORD || !CLIENT_EMAIL || !CLIENT_PASSWORD,
  "Credenciais sintéticas de owner/cliente ou configuração Supabase local ausentes.",
);

function newClient() {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

async function signInOwner(client: SupabaseClient) {
  const result = await client.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  return ensure(result.data.user, result.error, "autenticar owner QA");
}

function ensure<T>(data: T | null, error: { message: string } | null, action: string): T {
  if (error) throw new Error(`${action}: ${error.message}`);
  if (data === null) throw new Error(`${action}: resposta vazia.`);
  return data;
}

function dateKeyInZone(timeZone: string, offsetDays: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const date = new Date(
    Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + offsetDays),
  );
  return date.toISOString().slice(0, 10);
}

function dateKeyForInstant(timeZone: string, instant: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function findFreeSlots(current: PortalFixture, count: number, excluded: Set<string> = new Set()) {
  const slots: Slot[] = [];
  for (let offset = 2; offset <= 25 && slots.length < count; offset += 1) {
    const day = dateKeyInZone(current.timezone, offset);
    const result = await current.owner.rpc("get_available_slots", {
      _tenant_id: current.tenantId,
      _professional_id: current.professionalId,
      _unit_id: current.unitId,
      _service_id: current.serviceId,
      _day: day,
      _slot_step_minutes: 15,
    });
    const available = ensure(result.data as Slot[] | null, result.error, `buscar slots de ${day}`);
    for (const slot of available) {
      const key = new Date(slot.slot_start).toISOString();
      if (
        excluded.has(key) ||
        slots.some((selected) => {
          const startsBeforeSelectedEnds = new Date(slot.slot_start).getTime() < new Date(selected.slot_end).getTime();
          const endsAfterSelectedStarts = new Date(slot.slot_end).getTime() > new Date(selected.slot_start).getTime();
          return startsBeforeSelectedEnds && endsAfterSelectedStarts;
        })
      ) continue;
      slots.push(slot);
      excluded.add(key);
      if (slots.length === count) break;
    }
  }
  if (slots.length < count) {
    throw new Error(`A fixture local encontrou somente ${slots.length} de ${count} slots necessários.`);
  }
  return slots;
}

async function createAppointment(
  current: PortalFixture,
  clientId: string,
  slot: Slot,
  marker: string,
) {
  const appointmentResult = await current.owner
    .from("appointments")
    .insert({
      tenant_id: current.tenantId,
      unit_id: current.unitId,
      client_id: clientId,
      professional_id: current.professionalId,
      starts_at: slot.slot_start,
      ends_at: slot.slot_end,
      duration_minutes: 30,
      status: "pending",
      source: "client_portal",
      total_price_cents: 10000,
      internal_notes: marker,
      created_by: current.ownerUserId,
    })
    .select("id")
    .single();
  const appointment = ensure(appointmentResult.data, appointmentResult.error, "criar agendamento sintético");

  const itemResult = await current.owner.from("appointment_items").insert({
    tenant_id: current.tenantId,
    appointment_id: appointment.id,
    service_id: current.serviceId,
    duration_minutes: 30,
    price_cents: 10000,
    position: 0,
  });
  if (itemResult.error) throw new Error(`vincular serviço sintético: ${itemResult.error.message}`);
  return appointment.id as string;
}

test.beforeAll(async () => {
  const owner = newClient();
  let serviceCreated = false;
  let priceCreated = false;
  let serviceId: string | null = null;
  let priceId: string | null = null;
  let previousVisibility: TemporaryPortalCatalog["previousVisibility"] = null;

  try {
    const user = await signInOwner(owner);
    const membershipResult = await owner
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();
    const membership = ensure(membershipResult.data, membershipResult.error, "resolver tenant do owner QA");

    const existingServiceResult = await owner
      .from("services")
      .select("id, is_active, is_public")
      .eq("tenant_id", membership.tenant_id)
      .eq("internal_code", "QA-PORTAL-LOCAL")
      .maybeSingle();
    if (existingServiceResult.error) {
      throw new Error(`buscar serviço sintético do portal: ${existingServiceResult.error.message}`);
    }
    const existingService = existingServiceResult.data;

    if (existingService) {
      serviceId = existingService.id;
      previousVisibility = {
        is_active: existingService.is_active,
        is_public: existingService.is_public,
      };
      if (!existingService.is_active || !existingService.is_public) {
        const { error } = await owner
          .from("services")
          .update({ is_active: true, is_public: true })
          .eq("id", serviceId);
        if (error) throw new Error(`ativar serviço sintético do portal: ${error.message}`);
      }
    } else {
      const serviceResult = await owner
        .from("services")
        .insert({
          tenant_id: membership.tenant_id,
          name: "Serviço QA Portal Local",
          description: "Serviço sintético para a jornada de autoatendimento no portal.",
          internal_code: "QA-PORTAL-LOCAL",
          duration_minutes: 30,
          buffer_before_minutes: 0,
          buffer_after_minutes: 0,
          processing_minutes: 0,
          min_advance_hours: 0,
          max_advance_days: 30,
          is_active: true,
          is_featured: true,
          is_public: true,
          position: 0,
        })
        .select("id")
        .single();
      serviceId = ensure(serviceResult.data, serviceResult.error, "criar serviço sintético do portal").id;
      serviceCreated = true;
    }

    temporaryPortalCatalog = {
      serviceId,
      serviceCreated,
      priceId: null,
      priceCreated: false,
      previousVisibility,
    };

    const existingPriceResult = await owner
      .from("service_prices")
      .select("id")
      .eq("tenant_id", membership.tenant_id)
      .eq("service_id", serviceId)
      .eq("currency", "BRL")
      .maybeSingle();
    if (existingPriceResult.error) {
      throw new Error(`buscar preço do serviço sintético do portal: ${existingPriceResult.error.message}`);
    }
    const existingPrice = existingPriceResult.data;
    if (!existingPrice) {
      const priceResult = await owner
        .from("service_prices")
        .insert({
          tenant_id: membership.tenant_id,
          service_id: serviceId,
          amount_cents: 10000,
          currency: "BRL",
          is_default: true,
        })
        .select("id")
        .single();
      priceId = ensure(priceResult.data, priceResult.error, "criar preço sintético do portal").id;
      priceCreated = true;
      temporaryPortalCatalog.priceId = priceId;
      temporaryPortalCatalog.priceCreated = priceCreated;
    }
  } finally {
    await owner.auth.signOut();
  }
});

test.beforeEach(async () => {
  const owner = newClient();
  const client = newClient();
  const ownerAuth = await owner.auth.signInWithPassword({ email: OWNER_EMAIL, password: OWNER_PASSWORD });
  const ownerUser = ensure(ownerAuth.data.user, ownerAuth.error, "resolver owner QA");
  const clientAuth = await client.auth.signInWithPassword({ email: CLIENT_EMAIL, password: CLIENT_PASSWORD });
  const clientSession = ensure(clientAuth.data.session, clientAuth.error, "autenticar cliente QA");
  const clientUser = ensure(clientAuth.data.user, clientAuth.error, "resolver cliente QA");

  const membershipResult = await owner
    .from("tenant_memberships")
    .select("tenant_id")
    .eq("user_id", ownerUser.id)
    .eq("status", "active")
    .single();
  const membership = ensure(membershipResult.data, membershipResult.error, "resolver tenant do owner");

  const linkResult = await client
    .from("client_users")
    .select("tenant_id, client_id")
    .eq("user_id", clientUser.id)
    .eq("status", "active")
    .single();
  const link = ensure(linkResult.data, linkResult.error, "resolver vínculo cliente-tenant");
  if (link.tenant_id !== membership.tenant_id) {
    throw new Error("As contas sintéticas de owner e cliente precisam compartilhar o tenant QA A.");
  }

  const tenantResult = await owner.from("tenants").select("timezone").eq("id", link.tenant_id).single();
  const tenant = ensure(tenantResult.data, tenantResult.error, "buscar timezone QA");
  const serviceResult = await owner
    .from("services")
    .select("id")
    .eq("tenant_id", link.tenant_id)
    .eq("internal_code", "QA-PORTAL-LOCAL")
    .eq("is_active", true)
    .single();
  const service = ensure(serviceResult.data, serviceResult.error, "buscar serviço QA portal");
  const professionalResult = await owner
    .from("professionals")
    .select("id, unit_id")
    .eq("tenant_id", link.tenant_id)
    .eq("display_name", "Profissional QA Local")
    .eq("is_active", true)
    .single();
  const professional = ensure(professionalResult.data, professionalResult.error, "buscar profissional QA portal");
  const unitId = professional.unit_id;
  if (!unitId) throw new Error("O profissional QA precisa estar associado a uma unidade.");

  fixture = {
    owner,
    client,
    tenantId: link.tenant_id,
    unitId,
    clientId: link.client_id,
    ownerUserId: ownerUser.id,
    clientSession: clientSession as unknown as Record<string, unknown>,
    clientUser: clientUser as unknown as Record<string, unknown>,
    serviceId: service.id,
    professionalId: professional.id,
    timezone: tenant.timezone || "America/Sao_Paulo",
    ownAppointmentId: null,
    foreignAppointmentId: null,
    foreignClientId: null,
    waitlistId: null,
    confirmationQueueId: null,
    marker: `E2E_PORTAL_SELF_SERVICE_${randomUUID()}`,
    originalRules: null,
  };
  const rulesResult = await owner
    .from("client_self_service_rules")
    .select("*")
    .eq("tenant_id", fixture.tenantId)
    .maybeSingle();
  if (rulesResult.error) throw new Error(`ler regras de autoatendimento: ${rulesResult.error.message}`);
  fixture.originalRules = rulesResult.data as Record<string, unknown> | null;

  const [ownSlot, foreignSlot] = await findFreeSlots(fixture, 2);
  fixture.ownAppointmentId = await createAppointment(fixture, fixture.clientId, ownSlot, `${fixture.marker}_OWN`);

  const foreignClientResult = await owner
    .from("clients")
    .insert({
      tenant_id: fixture.tenantId,
      preferred_unit_id: fixture.unitId,
      full_name: `Cliente Isolamento ${fixture.marker.slice(-8)}`,
      email: `${randomUUID()}@cativa.test`,
      origin: "qa-local-fixture",
      status: "active",
      created_by: ownerUser.id,
    })
    .select("id")
    .single();
  const foreignClient = ensure(foreignClientResult.data, foreignClientResult.error, "criar cliente sintético de isolamento");
  fixture.foreignClientId = foreignClient.id;
  fixture.foreignAppointmentId = await createAppointment(
    fixture,
    foreignClient.id,
    foreignSlot,
    `${fixture.marker}_FOREIGN`,
  );

  const waitlistResult = await owner
    .from("waitlist_entries")
    .insert({
      tenant_id: fixture.tenantId,
      client_id: fixture.clientId,
      service_id: fixture.serviceId,
      preferred_professional_id: fixture.professionalId,
      preferred_unit_id: fixture.unitId,
      desired_window_start: ownSlot.slot_start,
      desired_window_end: ownSlot.slot_end,
      status: "open",
      notes: `${fixture.marker}_WAITLIST`,
      created_by: ownerUser.id,
    })
    .select("id")
    .single();
  const waitlist = ensure(waitlistResult.data, waitlistResult.error, "criar entrada sintética na fila de espera");
  fixture.waitlistId = waitlist.id;
});

test.afterEach(async () => {
  const current = fixture;
  fixture = null;
  if (!current) return;

  try {
    if (current.waitlistId) {
      const { error } = await current.owner.from("waitlist_entries").delete().eq("id", current.waitlistId);
      if (error) throw error;
    }
    if (current.confirmationQueueId) {
      const { error } = await current.owner
        .from("confirmation_queue")
        .delete()
        .eq("id", current.confirmationQueueId);
      if (error) throw error;
    }
    const appointmentIds = [current.ownAppointmentId, current.foreignAppointmentId].filter(
      (id): id is string => Boolean(id),
    );
    if (appointmentIds.length) {
      const { error } = await current.owner.from("appointments").delete().in("id", appointmentIds);
      if (error) throw error;
    }
    if (current.foreignClientId) {
      const { error } = await current.owner.from("clients").delete().eq("id", current.foreignClientId);
      if (error) throw error;
    }
    if (current.originalRules) {
      const { error } = await current.owner
        .from("client_self_service_rules")
        .upsert(current.originalRules as never, { onConflict: "tenant_id" });
      if (error) throw error;
    } else {
      const { error } = await current.owner
        .from("client_self_service_rules")
        .delete()
        .eq("tenant_id", current.tenantId);
      if (error) throw error;
    }
  } finally {
    await Promise.all([current.owner.auth.signOut(), current.client.auth.signOut()]);
  }
});

test.afterAll(async () => {
  const catalog = temporaryPortalCatalog;
  temporaryPortalCatalog = null;
  if (!catalog) return;

  const owner = newClient();
  try {
    await signInOwner(owner);

    if (catalog.serviceCreated) {
      const referencesResult = await owner
        .from("appointment_items")
        .select("id")
        .eq("service_id", catalog.serviceId);
      const references = ensure(
        referencesResult.data,
        referencesResult.error,
        "verificar referências antes de limpar serviço temporário",
      );
      if (references.length > 0) {
        throw new Error(
          "O serviço temporário ainda tem agendamentos associados; foi mantido para não quebrar dados de QA.",
        );
      }
    }

    if (catalog.priceCreated && catalog.priceId) {
      const { error } = await owner.from("service_prices").delete().eq("id", catalog.priceId);
      if (error) throw new Error(`remover preço temporário do portal: ${error.message}`);
    }
    if (catalog.serviceCreated) {
      const { error } = await owner.from("services").delete().eq("id", catalog.serviceId);
      if (error) throw new Error(`remover serviço temporário do portal: ${error.message}`);
    } else if (catalog.previousVisibility) {
      const { error } = await owner
        .from("services")
        .update(catalog.previousVisibility)
        .eq("id", catalog.serviceId);
      if (error) throw new Error(`restaurar visibilidade original do serviço: ${error.message}`);
    }
  } finally {
    await owner.auth.signOut();
  }
});

test.describe("autoatendimento do cliente no Supabase QA efêmero", () => {
  test.describe.configure({ timeout: 150_000 });

  test("cancelar pelo portal libera horário e registra oportunidade para a fila", async ({ page }) => {
    const current = fixture;
    if (!current?.ownAppointmentId || !current.waitlistId) throw new Error("Fixture do portal incompleta.");

    await page.addInitScript(
      ({ session, user, tenantId, storageKey }) => {
        window.localStorage.clear();
        window.localStorage.setItem(storageKey, JSON.stringify({ ...session, user, weak_password: null }));
        window.localStorage.setItem("cativa.portal.tenantId", tenantId);
      },
      {
        session: current.clientSession,
        user: current.clientUser,
        tenantId: current.tenantId,
        storageKey: `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`,
      },
    );

    await page.goto("/portal/agenda", { waitUntil: "domcontentloaded" });
    const card = page.locator(
      `[data-testid="portal-appointment-card"][data-appointment-id="${current.ownAppointmentId}"]`,
    );
    await expect(card).toBeVisible({ timeout: 30_000 });
    await card.getByRole("button", { name: "Cancelar", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Motivo").fill("Imprevisto de agenda — teste sintético");
    await dialog.getByRole("button", { name: "Sim, cancelar", exact: true }).click();

    await expect
      .poll(async () => {
        const result = await current.owner
          .from("appointments")
          .select("status, canceled_reason")
          .eq("id", current.ownAppointmentId!)
          .single();
        if (result.error) throw result.error;
        return result.data;
      })
      .toMatchObject({ status: "canceled", canceled_reason: "Imprevisto de agenda — teste sintético" });

    await expect
      .poll(async () => {
        const result = await current.owner
          .from("audit_logs")
          .select("id")
          .eq("tenant_id", current.tenantId)
          .eq("action", "waitlist.opportunity")
          .eq("entity_id", current.ownAppointmentId!);
        if (result.error) throw result.error;
        return result.data?.length ?? 0;
      })
      .toBeGreaterThan(0);
  });

  test("reagendar pela interface preserva o serviço e grava o novo horário", async ({ page }) => {
    const current = fixture;
    if (!current?.ownAppointmentId) throw new Error("Fixture do portal incompleta.");
    const [target] = await findFreeSlots(current, 1);
    const targetDay = dateKeyForInstant(current.timezone, target.slot_start);
    const initial = await current.owner
      .from("appointments")
      .select("starts_at")
      .eq("id", current.ownAppointmentId)
      .single();
    const initialAppointment = ensure(initial.data, initial.error, "ler horário antes do reagendamento");
    const queueResult = await current.owner
      .from("confirmation_queue")
      .insert({
        tenant_id: current.tenantId,
        appointment_id: current.ownAppointmentId,
        client_id: current.clientId,
        stage: "today",
        status: "pending",
        priority: 80,
        scheduled_for: new Date().toISOString(),
        appointment_starts_at: initialAppointment.starts_at,
        notes: `${current.marker}_RESCHEDULE_QUEUE`,
      })
      .select("id")
      .single();
    const queueItem = ensure(queueResult.data, queueResult.error, "criar tarefa de confirmação QA");
    current.confirmationQueueId = queueItem.id;
    const confirmationSetup = await current.owner
      .from("appointments")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", current.ownAppointmentId);
    if (confirmationSetup.error) {
      throw new Error(`preparar reagendamento de horário confirmado: ${confirmationSetup.error.message}`);
    }

    await page.addInitScript(
      ({ session, user, tenantId, storageKey }) => {
        window.localStorage.clear();
        window.localStorage.setItem(storageKey, JSON.stringify({ ...session, user, weak_password: null }));
        window.localStorage.setItem("cativa.portal.tenantId", tenantId);
      },
      {
        session: current.clientSession,
        user: current.clientUser,
        tenantId: current.tenantId,
        storageKey: `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`,
      },
    );

    await page.goto(`/portal/agendar?reschedule=${current.ownAppointmentId}&date=${targetDay}`, {
      waitUntil: "domcontentloaded",
    });
    const serviceOption = page.getByTestId("portal-service-option");
    await expect(serviceOption).toHaveCount(1, { timeout: 30_000 });
    await expect(serviceOption).toHaveAttribute("data-service-id", current.serviceId);
    await serviceOption.click();

    await page
      .getByTestId("portal-professional-option")
      .filter({ hasText: "Profissional QA Local" })
      .click();
    const slot = page.locator(
      `[data-testid="portal-slot-option"][data-slot-start="${target.slot_start}"]`,
    );
    await expect(slot).toBeVisible({ timeout: 30_000 });
    await slot.click();
    await page.getByTestId("portal-slot-continue").click();
    await expect(page.getByText("Confirme seu agendamento")).toBeVisible();
    await page.getByTestId("portal-booking-submit").click();

    await expect(page).toHaveURL(/\/portal\/agenda$/);
    await expect
      .poll(async () => {
        const result = await current.owner
          .from("appointments")
          .select("starts_at, status, confirmed_at, client_reschedule_count")
          .eq("id", current.ownAppointmentId!)
          .single();
        if (result.error) throw result.error;
        return result.data;
      })
      .toMatchObject({ status: "pending", confirmed_at: null, client_reschedule_count: 1 });
    const updated = await current.owner
      .from("appointments")
      .select("starts_at")
      .eq("id", current.ownAppointmentId)
      .single();
    expect(new Date(ensure(updated.data, updated.error, "validar novo horário").starts_at).getTime()).toBe(
      new Date(target.slot_start).getTime(),
    );
    const queueState = await current.owner
      .from("confirmation_queue")
      .select("status, closed_at, appointment_starts_at")
      .eq("id", queueItem.id)
      .single();
    expect(ensure(queueState.data, queueState.error, "validar fila após reagendamento")).toMatchObject({
      status: "pending",
      closed_at: null,
    });
    expect(new Date(queueState.data!.appointment_starts_at).getTime()).toBe(
      new Date(target.slot_start).getTime(),
    );
  });

  test("confirmação exige RPC autorizada e não permite UPDATE direto do cliente", async () => {
    const current = fixture;
    if (!current?.ownAppointmentId) throw new Error("Fixture do portal incompleta.");

    const directUpdate = await current.client
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", current.ownAppointmentId)
      .select("id, status");
    expect(
      directUpdate.error || directUpdate.data?.length === 0,
      "RLS deve negar UPDATE direto do cliente ao próprio agendamento.",
    ).toBeTruthy();

    const rulesUpdate = await current.client
      .from("client_self_service_rules")
      .update({ allow_client_confirm: false })
      .eq("tenant_id", current.tenantId)
      .select("tenant_id");
    expect(
      rulesUpdate.error || rulesUpdate.data?.length === 0,
      "RLS deve impedir que o cliente altere a política do tenant.",
    ).toBeTruthy();

    const confirmation = await current.client.rpc("portal_confirm_appointment", {
      _appointment_id: current.ownAppointmentId,
    });
    expect(confirmation.error?.message).toBeUndefined();

    const appointment = await current.owner
      .from("appointments")
      .select("status, confirmed_at")
      .eq("id", current.ownAppointmentId)
      .single();
    expect(ensure(appointment.data, appointment.error, "ler agendamento confirmado")).toMatchObject({
      status: "confirmed",
    });
    expect(appointment.data?.confirmed_at).toBeTruthy();
  });

  test("reagendamento valida limite e bloqueia tentativa sobre agendamento de outro cliente", async () => {
    const current = fixture;
    if (!current?.ownAppointmentId || !current.foreignAppointmentId) {
      throw new Error("Fixture do portal incompleta.");
    }

    const rulesResult = await current.owner
      .from("client_self_service_rules")
      .upsert(
        {
          tenant_id: current.tenantId,
          max_reschedules_per_appointment: 1,
          min_hours_to_reschedule: 0,
        },
        { onConflict: "tenant_id" },
      );
    if (rulesResult.error) throw new Error(`configurar limite QA: ${rulesResult.error.message}`);

    const candidates = await findFreeSlots(current, 2);
    const first = candidates[0];
    const second = candidates[1];
    const rescheduled = await current.client.rpc("portal_reschedule_appointment", {
      _appointment_id: current.ownAppointmentId,
      _starts_at: first.slot_start,
      _ends_at: first.slot_end,
      _professional_id: current.professionalId,
    });
    expect(rescheduled.error?.message).toBeUndefined();

    const updated = await current.owner
      .from("appointments")
      .select("starts_at, status, client_reschedule_count")
      .eq("id", current.ownAppointmentId)
      .single();
    const updatedRow = ensure(updated.data, updated.error, "ler reagendamento QA");
    expect(updatedRow.status).toBe("pending");
    expect(updatedRow.client_reschedule_count).toBe(1);
    expect(new Date(updatedRow.starts_at).getTime()).toBe(new Date(first.slot_start).getTime());

    const overLimit = await current.client.rpc("portal_reschedule_appointment", {
      _appointment_id: current.ownAppointmentId,
      _starts_at: second.slot_start,
      _ends_at: second.slot_end,
      _professional_id: current.professionalId,
    });
    expect(overLimit.error?.message).toContain("número máximo");

    const foreignCancel = await current.client.rpc("portal_cancel_appointment", {
      _appointment_id: current.foreignAppointmentId,
      _reason: "Tentativa de acesso indevido",
    });
    expect(foreignCancel.error?.message).toContain("não tem acesso");

    const foreignAppointment = await current.owner
      .from("appointments")
      .select("status")
      .eq("id", current.foreignAppointmentId)
      .single();
    expect(ensure(foreignAppointment.data, foreignAppointment.error, "validar proteção IDOR").status).toBe(
      "pending",
    );
  });

  test("cancelamento aplica bloqueio, motivo obrigatório e janela mínima no servidor", async () => {
    const current = fixture;
    if (!current?.ownAppointmentId) throw new Error("Fixture do portal incompleta.");

    const disabled = await current.owner.from("client_self_service_rules").upsert(
      { tenant_id: current.tenantId, allow_client_cancel: false, min_hours_to_cancel: 0 },
      { onConflict: "tenant_id" },
    );
    if (disabled.error) throw new Error(`desativar cancelamento na fixture: ${disabled.error.message}`);

    const disabledAttempt = await current.client.rpc("portal_cancel_appointment", {
      _appointment_id: current.ownAppointmentId,
      _reason: "Motivo sintético",
    });
    expect(disabledAttempt.error?.message).toContain("desativado");

    const requiredReason = await current.owner.from("client_self_service_rules").upsert(
      {
        tenant_id: current.tenantId,
        allow_client_cancel: true,
        require_cancel_reason: true,
        min_hours_to_cancel: 0,
      },
      { onConflict: "tenant_id" },
    );
    if (requiredReason.error) throw new Error(`configurar motivo obrigatório: ${requiredReason.error.message}`);

    const missingReason = await current.client.rpc("portal_cancel_appointment", {
      _appointment_id: current.ownAppointmentId,
    });
    expect(missingReason.error?.message).toContain("Informe o motivo");

    const minimumWindow = await current.owner.from("client_self_service_rules").upsert(
      {
        tenant_id: current.tenantId,
        allow_client_cancel: true,
        require_cancel_reason: false,
        min_hours_to_cancel: 900,
      },
      { onConflict: "tenant_id" },
    );
    if (minimumWindow.error) throw new Error(`configurar antecedência mínima: ${minimumWindow.error.message}`);

    const tooLate = await current.client.rpc("portal_cancel_appointment", {
      _appointment_id: current.ownAppointmentId,
      _reason: "Imprevisto sintético",
    });
    expect(tooLate.error?.message).toContain("só até");

    const unchanged = await current.owner
      .from("appointments")
      .select("status")
      .eq("id", current.ownAppointmentId)
      .single();
    expect(ensure(unchanged.data, unchanged.error, "confirmar cancelamento recusado").status).toBe("pending");
  });
});
