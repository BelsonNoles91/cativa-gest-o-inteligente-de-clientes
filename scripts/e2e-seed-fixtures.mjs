#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const enabled = process.env.E2E_SEED_FIXTURES === "true";
if (!enabled) {
  console.log("Fixtures E2E: desativadas (E2E_SEED_FIXTURES != true).");
  process.exit(0);
}

const runId = (process.env.E2E_RUN_ID || process.env.GITHUB_RUN_ID || `local-${Date.now()}`)
  .replace(/[^a-zA-Z0-9._-]/g, "-")
  .slice(0, 80);

const required = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "E2E_USER",
  "E2E_PASS",
  "E2E_TENANT_SLUG",
];
for (const key of required) {
  if (!process.env[key]?.trim()) {
    throw new Error(`Fixtures E2E: ${key} é obrigatório.`);
  }
}

const client = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);

function assertResult(result, label) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

function dateInTimeZone(timeZone, offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const baseUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
  );
  return new Date(baseUtc + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

async function findAvailableSlot({
  tenantId,
  professionalId,
  unitId,
  serviceId,
  timeZone,
}) {
  for (let offset = 1; offset <= 21; offset += 1) {
    const day = dateInTimeZone(timeZone, offset);
    const slots = assertResult(
      await client.rpc("get_available_slots", {
        _tenant_id: tenantId,
        _professional_id: professionalId,
        _unit_id: unitId,
        _service_id: serviceId,
        _day: day,
        _slot_step_minutes: 15,
      }),
      `buscar horário disponível em ${day}`,
    );
    if (slots?.length) return slots[0];
  }
  throw new Error(
    "Fixtures E2E: nenhum horário disponível encontrado nos próximos 21 dias.",
  );
}

async function firstOrCreate({ table, select, filters, insert, label }) {
  let query = client.from(table).select(select).limit(1);
  for (const [column, value] of Object.entries(filters))
    query = query.eq(column, value);
  const existing = assertResult(await query.maybeSingle(), `buscar ${label}`);
  if (existing) return existing;
  return assertResult(
    await client.from(table).insert(insert).select(select).single(),
    `criar ${label}`,
  );
}

const auth = assertResult(
  await client.auth.signInWithPassword({
    email: process.env.E2E_USER,
    password: process.env.E2E_PASS,
  }),
  "autenticar usuário E2E",
);
const userId = auth.user?.id;
if (!userId)
  throw new Error("Fixtures E2E: autenticação não retornou user id.");

try {
  const membership = assertResult(
    await client
      .from("tenant_memberships")
      .select("tenant_id, role, tenants!inner(slug)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("tenants.slug", process.env.E2E_TENANT_SLUG)
      .maybeSingle(),
    "resolver tenant E2E",
  );
  if (!membership?.tenant_id) {
    throw new Error(
      "Fixtures E2E: usuário não possui vínculo ativo com o tenant informado.",
    );
  }
  if (!["owner", "manager"].includes(membership.role)) {
    throw new Error(
      `Fixtures E2E: papel ${membership.role} não pode preparar dados operacionais.`,
    );
  }
  const tenantId = membership.tenant_id;

  const unit = assertResult(
    await client
      .from("units")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "buscar unidade E2E",
  );
  if (!unit?.id)
    throw new Error("Fixtures E2E: tenant não possui unidade ativa.");

  const professional = await firstOrCreate({
    table: "professionals",
    select: "id",
    filters: { tenant_id: tenantId, display_name: "Profissional QA E2E" },
    insert: {
      tenant_id: tenantId,
      unit_id: unit.id,
      display_name: "Profissional QA E2E",
      role_title: "Automação",
      is_active: true,
    },
    label: "profissional E2E",
  });

  const customer = await firstOrCreate({
    table: "clients",
    select: "id",
    filters: { tenant_id: tenantId, full_name: "Cliente QA E2E Confirmação" },
    insert: {
      tenant_id: tenantId,
      preferred_unit_id: unit.id,
      preferred_professional_id: professional.id,
      full_name: "Cliente QA E2E Confirmação",
      phone: "11999990000",
      whatsapp_phone: "11999990000",
      origin: "fixture-e2e",
      status: "active",
      risk_level: "medium",
      created_by: userId,
    },
    label: "cliente E2E",
  });

  const service = await firstOrCreate({
    table: "services",
    select: "id, duration_minutes",
    filters: { tenant_id: tenantId, name: "Serviço QA E2E" },
    insert: {
      tenant_id: tenantId,
      name: "Serviço QA E2E",
      description: "Fixture determinística dos testes autenticados.",
      internal_code: "E2E-CONFIRMATION",
      duration_minutes: 30,
      is_active: true,
    },
    label: "serviço E2E",
  });

  const marker = "E2E_FIXTURE_CONFIRMATION_MODAL_V1";
  const tenant = assertResult(
    await client
      .from("tenants")
      .select("timezone")
      .eq("id", tenantId)
      .single(),
    "buscar timezone do tenant E2E",
  );
  const tenantTimezone = tenant.timezone || "America/Sao_Paulo";
  let businessHours = assertResult(
    await client
      .from("unit_business_hours")
      .select("weekday, opens_at, closes_at")
      .eq("unit_id", unit.id)
      .eq("is_closed", false)
      .order("weekday")
      .limit(1)
      .maybeSingle(),
    "buscar horário da unidade E2E",
  );
  if (!businessHours) {
    const tomorrow = dateInTimeZone(tenantTimezone, 1);
    const tomorrowWeekday = new Date(`${tomorrow}T00:00:00Z`).getUTCDay();
    businessHours = assertResult(
      await client
        .from("unit_business_hours")
        .insert({
          tenant_id: tenantId,
          unit_id: unit.id,
          weekday: tomorrowWeekday,
          opens_at: "09:00:00",
          closes_at: "18:00:00",
          is_closed: false,
        })
        .select("weekday, opens_at, closes_at")
        .single(),
      "criar horário da unidade E2E",
    );
  }
  const slot = await findAvailableSlot({
    tenantId,
    professionalId: professional.id,
    unitId: unit.id,
    serviceId: service.id,
    timeZone: tenantTimezone,
  });
  const startsAt = new Date(slot.slot_start);
  const endsAt = new Date(slot.slot_end);
  const appointmentPatch = {
    tenant_id: tenantId,
    unit_id: unit.id,
    client_id: customer.id,
    professional_id: professional.id,
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    duration_minutes: 30,
    status: "pending",
    source: "frontdesk",
    total_price_cents: 10000,
    internal_notes: marker,
    created_by: userId,
    confirmed_at: null,
    canceled_at: null,
  };
  const existingAppointment = assertResult(
    await client
      .from("appointments")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("internal_notes", marker)
      .limit(1)
      .maybeSingle(),
    "buscar agendamento E2E",
  );
  const appointment = existingAppointment
    ? assertResult(
        await client
          .from("appointments")
          .update(appointmentPatch)
          .eq("id", existingAppointment.id)
          .select("id")
          .single(),
        "atualizar agendamento E2E",
      )
    : assertResult(
        await client
          .from("appointments")
          .insert(appointmentPatch)
          .select("id")
          .single(),
        "criar agendamento E2E",
      );

  const item = assertResult(
    await client
      .from("appointment_items")
      .select("id")
      .eq("appointment_id", appointment.id)
      .limit(1)
      .maybeSingle(),
    "buscar item do agendamento E2E",
  );
  if (!item) {
    assertResult(
      await client.from("appointment_items").insert({
        tenant_id: tenantId,
        appointment_id: appointment.id,
        service_id: service.id,
        duration_minutes: service.duration_minutes ?? 30,
        price_cents: 10000,
        position: 0,
      }),
      "criar item do agendamento E2E",
    );
  }

  const queuePatch = {
    tenant_id: tenantId,
    appointment_id: appointment.id,
    client_id: customer.id,
    stage: "today",
    status: "pending",
    priority: 80,
    scheduled_for: new Date().toISOString(),
    appointment_starts_at: startsAt.toISOString(),
    attempts_count: 0,
    closed_at: null,
    notes: marker,
  };
  const existingQueueItem = assertResult(
    await client
      .from("confirmation_queue")
      .select("id")
      .eq("appointment_id", appointment.id)
      .eq("stage", "today")
      .limit(1)
      .maybeSingle(),
    "buscar item da fila E2E",
  );
  if (existingQueueItem) {
    assertResult(
      await client
        .from("confirmation_queue")
        .update(queuePatch)
        .eq("id", existingQueueItem.id),
      "atualizar item da fila E2E",
    );
  } else {
    assertResult(
      await client.from("confirmation_queue").insert(queuePatch),
      "criar item da fila E2E",
    );
  }

  const visibleQueueItem = assertResult(
    await client
      .from("confirmation_queue")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("appointment_id", appointment.id)
      .eq("stage", "today")
      .eq("status", "pending")
      .is("closed_at", null)
      .maybeSingle(),
    "validar item visível da fila E2E",
  );
  if (!visibleQueueItem) {
    throw new Error(
      "Fixtures E2E: o item criado não está visível na fila aberta de hoje.",
    );
  }

  console.log(
    `Fixtures E2E (run_id=${runId}): cenário Agenda → Confirmações preparado com sucesso.`,
  );
} finally {
  await client.auth.signOut();
}
