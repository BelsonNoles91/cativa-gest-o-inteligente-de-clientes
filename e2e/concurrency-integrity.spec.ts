import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const requiredEnv = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "E2E_USER",
  "E2E_PASS",
  "E2E_TENANT_SLUG",
] as const;

const hasEnv = requiredEnv.every((key) => Boolean(process.env[key]?.trim()));
const DAY_MS = 24 * 60 * 60 * 1000;

type FixtureContext = {
  tenantId: string;
  unitId: string;
  professionalId: string;
  clientId: string;
  serviceId: string;
  durationMinutes: number;
};

function env(key: (typeof requiredEnv)[number]) {
  return process.env[key]?.trim() ?? "";
}

function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function dateAtOffset(days: number) {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

function assertOk<T>(
  result: { data: T; error: { message: string; code?: string } | null },
  label: string,
) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.code ?? "erro"} ${result.error.message}`);
  }
  return result.data;
}

async function resolveFixture(client: SupabaseClient): Promise<FixtureContext> {
  const auth = assertOk(
    await client.auth.signInWithPassword({
      email: env("E2E_USER"),
      password: env("E2E_PASS"),
    }),
    "login E2E",
  );
  if (!auth.user?.id) throw new Error("Login E2E não retornou usuário.");

  const membership = assertOk(
    await client
      .from("tenant_memberships")
      .select("tenant_id, tenants!inner(slug)")
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .eq("tenants.slug", env("E2E_TENANT_SLUG"))
      .maybeSingle(),
    "resolver tenant QA",
  );
  if (!membership?.tenant_id) throw new Error("Tenant QA não encontrado.");

  const unit = assertOk(
    await client
      .from("units")
      .select("id")
      .eq("tenant_id", membership.tenant_id)
      .eq("is_active", true)
      .order("is_default", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "resolver unidade QA",
  );
  const professional = assertOk(
    await client
      .from("professionals")
      .select("id")
      .eq("tenant_id", membership.tenant_id)
      .eq("display_name", "Profissional QA E2E")
      .eq("is_active", true)
      .maybeSingle(),
    "resolver profissional QA",
  );
  const customer = assertOk(
    await client
      .from("clients")
      .select("id")
      .eq("tenant_id", membership.tenant_id)
      .eq("full_name", "Cliente QA E2E Confirmação")
      .maybeSingle(),
    "resolver cliente QA",
  );
  const service = assertOk(
    await client
      .from("services")
      .select("id, duration_minutes")
      .eq("tenant_id", membership.tenant_id)
      .eq("name", "Serviço QA E2E")
      .eq("is_active", true)
      .maybeSingle(),
    "resolver serviço QA",
  );

  if (!unit?.id || !professional?.id || !customer?.id || !service?.id) {
    throw new Error("Fixtures operacionais de QA estão incompletos.");
  }

  return {
    tenantId: membership.tenant_id,
    unitId: unit.id,
    professionalId: professional.id,
    clientId: customer.id,
    serviceId: service.id,
    durationMinutes: service.duration_minutes ?? 30,
  };
}

async function findSlotBundle(
  client: SupabaseClient,
  fixture: FixtureContext,
  startOffsetDays: number,
) {
  for (let offset = startOffsetDays; offset < startOffsetDays + 28; offset += 1) {
    const day = dateAtOffset(offset);
    const slots = assertOk(
      await client.rpc("get_available_slots", {
        _tenant_id: fixture.tenantId,
        _professional_id: fixture.professionalId,
        _unit_id: fixture.unitId,
        _service_id: fixture.serviceId,
        _day: day,
        _slot_step_minutes: 15,
      }),
      `buscar slots em ${day}`,
    ) as Array<{ slot_start: string; slot_end: string }>;

    if (slots.length < 3) continue;
    const starts = new Set(slots.map((slot) => new Date(slot.slot_start).getTime()));

    for (const slot of slots) {
      const startMs = new Date(slot.slot_start).getTime();
      const adjacentMs =
        startMs + (fixture.durationMinutes + 15) * 60_000;
      const laterMs =
        startMs + (fixture.durationMinutes * 2 + 60) * 60_000;
      const adjacent = slots.find(
        (candidate) => new Date(candidate.slot_start).getTime() === adjacentMs,
      );
      const later = slots.find(
        (candidate) => new Date(candidate.slot_start).getTime() >= laterMs,
      );
      if (adjacent && later && starts.has(adjacentMs)) {
        return { first: slot, adjacent, later };
      }
    }
  }
  throw new Error("Não foi encontrado um conjunto de slots livres para o teste de integridade.");
}

async function createAppointment(
  client: SupabaseClient,
  fixture: FixtureContext,
  startsAt: string,
  marker: string,
  bufferAfterMinutes = 0,
) {
  return client.rpc("create_appointment_atomic", {
    _tenant_id: fixture.tenantId,
    _unit_id: fixture.unitId,
    _client_id: fixture.clientId,
    _professional_id: fixture.professionalId,
    _service_id: fixture.serviceId,
    _starts_at: startsAt,
    _ends_at: addMinutes(startsAt, fixture.durationMinutes),
    _duration_minutes: fixture.durationMinutes,
    _buffer_before_minutes: 0,
    _buffer_after_minutes: bufferAfterMinutes,
    _source: "frontdesk",
    _status: "pending",
    _internal_notes: marker,
    _total_price_cents: 10000,
    _item_price_cents: 10000,
  });
}

test.describe("integridade concorrente da agenda no backend real", () => {
  test.skip(!hasEnv, "Credenciais E2E/Supabase ausentes.");
  test.setTimeout(120_000);

  test("impede dupla reserva, respeita buffer, remarcação, cancelamento e transições", async () => {
    const client = createClient(
      env("VITE_SUPABASE_URL"),
      env("VITE_SUPABASE_PUBLISHABLE_KEY"),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );

    const fixture = await resolveFixture(client);
    const prefix = `E2E_CONCURRENCY_${Date.now()}`;

    try {
      const raceSlots = await findSlotBundle(client, fixture, 21);
      const raceResults = await Promise.all([
        createAppointment(client, fixture, raceSlots.first.slot_start, `${prefix}_RACE_A`),
        createAppointment(client, fixture, raceSlots.first.slot_start, `${prefix}_RACE_B`),
      ]);
      const raceSuccesses = raceResults.filter((result) => !result.error);
      const raceErrors = raceResults.filter((result) => result.error);
      expect(raceSuccesses).toHaveLength(1);
      expect(raceErrors).toHaveLength(1);
      expect(["23P01", "40P01"]).toContain(raceErrors[0].error?.code);

      const persistedRace = assertOk(
        await client
          .from("appointments")
          .select("id")
          .eq("tenant_id", fixture.tenantId)
          .like("internal_notes", `${prefix}_RACE_%`),
        "contar corrida persistida",
      );
      expect(persistedRace).toHaveLength(1);

      const bufferSlots = await findSlotBundle(client, fixture, 35);
      const base = assertOk(
        await createAppointment(
          client,
          fixture,
          bufferSlots.first.slot_start,
          `${prefix}_BUFFER_BASE`,
          15,
        ),
        "criar agendamento com buffer",
      );
      expect(base).toHaveLength(1);

      const overlapStart = addMinutes(
        bufferSlots.first.slot_start,
        fixture.durationMinutes + 5,
      );
      const overlap = await createAppointment(
        client,
        fixture,
        overlapStart,
        `${prefix}_BUFFER_OVERLAP`,
      );
      expect(overlap.error?.code).toBe("23P01");

      const adjacent = assertOk(
        await createAppointment(
          client,
          fixture,
          bufferSlots.adjacent.slot_start,
          `${prefix}_BUFFER_ADJACENT`,
        ),
        "criar horário adjacente ao buffer",
      );
      expect(adjacent).toHaveLength(1);

      const moveSlots = await findSlotBundle(client, fixture, 49);
      const firstMove = assertOk(
        await createAppointment(
          client,
          fixture,
          moveSlots.first.slot_start,
          `${prefix}_MOVE_A`,
        ),
        "criar origem para remarcação",
      )[0];
      const secondMove = assertOk(
        await createAppointment(
          client,
          fixture,
          moveSlots.later.slot_start,
          `${prefix}_MOVE_B`,
        ),
        "criar destino para remarcação",
      )[0];

      const blockedMoveStart = addMinutes(moveSlots.first.slot_start, 5);
      const blockedMove = await client
        .from("appointments")
        .update({
          starts_at: blockedMoveStart,
          ends_at: addMinutes(blockedMoveStart, fixture.durationMinutes),
        })
        .eq("id", secondMove.id);
      expect(blockedMove.error?.code).toBe("23P01");

      const unchanged = assertOk(
        await client
          .from("appointments")
          .select("starts_at")
          .eq("id", secondMove.id)
          .single(),
        "validar rollback da remarcação",
      );
      expect(new Date(unchanged.starts_at).toISOString()).toBe(
        new Date(moveSlots.later.slot_start).toISOString(),
      );
      expect(firstMove.id).toBeTruthy();

      const statusSlots = await findSlotBundle(client, fixture, 63);
      const statusAppointment = assertOk(
        await createAppointment(
          client,
          fixture,
          statusSlots.first.slot_start,
          `${prefix}_STATUS`,
        ),
        "criar agendamento para transições",
      )[0];

      const invalidTransition = await client
        .from("appointments")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", statusAppointment.id);
      expect(invalidTransition.error?.code).toBe("22023");

      assertOk(
        await client
          .from("appointments")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            canceled_reason: "E2E: libera horário para reutilização",
          })
          .eq("id", statusAppointment.id),
        "cancelar agendamento",
      );

      const reused = assertOk(
        await createAppointment(
          client,
          fixture,
          statusSlots.first.slot_start,
          `${prefix}_REUSED`,
        ),
        "reutilizar horário cancelado",
      );
      expect(reused).toHaveLength(1);
    } finally {
      const rows = await client
        .from("appointments")
        .select("id")
        .eq("tenant_id", fixture.tenantId)
        .like("internal_notes", `${prefix}%`);
      if (!rows.error && rows.data?.length) {
        const cleanup = await client
          .from("appointments")
          .delete()
          .in(
            "id",
            rows.data.map((row) => row.id),
          );
        if (cleanup.error) {
          console.warn(`Limpeza E2E falhou: ${cleanup.error.message}`);
        }
      }
      await client.auth.signOut();
    }
  });
});
