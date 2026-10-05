import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getDestructiveE2ESkipReason } from "./_helpers/qaTarget";

const requiredEnv = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "E2E_USER",
  "E2E_PASS",
  "E2E_TENANT_SLUG",
] as const;

const hasEnv = requiredEnv.every((key) => Boolean(process.env[key]?.trim()));
const DAY_MS = 24 * 60 * 60 * 1000;
const localFixtureNames =
  process.env.E2E_LOCAL_SUPABASE === "true"
    ? {
        professional: "Profissional QA Local",
        client: "Cliente QA Local",
        service: "Serviço QA Portal Local",
      }
    : {
        professional: "Profissional QA E2E",
        client: "Cliente QA E2E Confirmação",
        service: "Serviço QA E2E",
      };

type FixtureContext = {
  tenantId: string;
  unitId: string;
  professionalId: string;
  clientId: string;
  serviceId: string;
  durationMinutes: number;
};

function env(key: string) {
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
      .eq("display_name", localFixtureNames.professional)
      .eq("is_active", true)
      .maybeSingle(),
    "resolver profissional QA",
  );
  const customer = assertOk(
    await client
      .from("clients")
      .select("id")
      .eq("tenant_id", membership.tenant_id)
      .eq("full_name", localFixtureNames.client)
      .maybeSingle(),
    "resolver cliente QA",
  );
  const service = assertOk(
    await client
      .from("services")
      .select("id, duration_minutes")
      .eq("tenant_id", membership.tenant_id)
      .eq("name", localFixtureNames.service)
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
        return { first: slot, adjacent, later, day };
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

async function runBookingBurst(
  client: SupabaseClient,
  fixture: FixtureContext,
  startsAt: string,
  marker: string,
  requestCount: number,
) {
  const burstStartedAt = performance.now();
  const outcomes = await Promise.all(
    Array.from({ length: requestCount }, async (_, index) => {
      const requestStartedAt = performance.now();
      try {
        const result = await createAppointment(
          client,
          fixture,
          startsAt,
          `${marker}_${index}`,
        );
        return {
          durationMs: performance.now() - requestStartedAt,
          success: !result.error,
          errorCode: result.error?.code,
        };
      } catch {
        return {
          durationMs: performance.now() - requestStartedAt,
          success: false,
          errorCode: "TRANSPORT_ERROR",
        };
      }
    }),
  );

  const durations = outcomes
    .map((outcome) => outcome.durationMs)
    .sort((left, right) => left - right);
  const percentile = (ratio: number) =>
    Math.round(durations[Math.min(durations.length - 1, Math.ceil(durations.length * ratio) - 1)]);
  const errorCounts = outcomes.reduce<Record<string, number>>((counts, outcome) => {
    if (outcome.errorCode) counts[outcome.errorCode] = (counts[outcome.errorCode] ?? 0) + 1;
    return counts;
  }, {});

  return {
    requestCount,
    totalElapsedMs: Math.round(performance.now() - burstStartedAt),
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    maxMs: Math.round(durations.at(-1) ?? 0),
    successCount: outcomes.filter((outcome) => outcome.success).length,
    errorCounts,
  };
}

async function cleanAppointmentsByMarker(
  client: SupabaseClient,
  tenantId: string,
  marker: string,
) {
  const rows = await client
    .from("appointments")
    .select("id")
    .eq("tenant_id", tenantId)
    .like("internal_notes", `${marker}%`);
  if (rows.error || !rows.data?.length) return rows.error;

  const cleanup = await client
    .from("appointments")
    .delete()
    .in(
      "id",
      rows.data.map((row) => row.id),
    );
  return cleanup.error;
}

test.describe("integridade concorrente da agenda no backend real", () => {
  test.skip(!hasEnv, "Credenciais E2E/Supabase ausentes.");
  const qaTargetSkipReason = getDestructiveE2ESkipReason();
  test.skip(Boolean(qaTargetSkipReason), qaTargetSkipReason ?? "");
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
    const prefix = `E2E-CONCURRENCY-${Date.now()}`;
    let testFailed = false;
    let testFailure: unknown;
    let cleanupFailure: string | undefined;

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
      expect(raceErrors[0].error?.code, "deadlock não é um conflito de agenda aceitável").toBe("23P01");

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
    } catch (error) {
      testFailed = true;
      testFailure = error;
    } finally {
      try {
        const error = await cleanAppointmentsByMarker(client, fixture.tenantId, prefix);
        if (error) cleanupFailure = `Limpeza E2E falhou: ${error.message}`;
      } catch (error) {
        cleanupFailure = `Limpeza E2E falhou: ${String(error)}`;
      }
      try {
        const { error } = await client.auth.signOut();
        if (error && !cleanupFailure) cleanupFailure = `Logout E2E falhou: ${error.message}`;
      } catch (error) {
        if (!cleanupFailure) cleanupFailure = `Logout E2E falhou: ${String(error)}`;
      }
    }
    if (cleanupFailure) {
      throw new Error(`${cleanupFailure}${testFailed ? `; falha original: ${String(testFailure)}` : ""}`);
    }
    if (testFailed) throw testFailure;
  });

  test("mantém exclusividade sob rajadas de 25, 50 e 100 reservas simultâneas", async ({ browserName }, testInfo) => {
    test.setTimeout(240_000);
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
    const prefix = `E2E-BOOKING-LOAD-${Date.now()}`;
    let testFailed = false;
    let testFailure: unknown;
    let cleanupFailure: string | undefined;
    const scenarios: Array<{
      requestCount: number;
      totalElapsedMs: number;
      p50Ms: number;
      p95Ms: number;
      maxMs: number;
      successCount: number;
      errorCounts: Record<string, number>;
    }> = [];

    try {
      for (const [index, requestCount] of [25, 50, 100].entries()) {
        const slots = await findSlotBundle(client, fixture, 77 + index * 11);
        const scenario = await runBookingBurst(
          client,
          fixture,
          slots.first.slot_start,
          `${prefix}_${requestCount}`,
          requestCount,
        );
        scenarios.push(scenario);
        await testInfo.attach(`booking-load-${requestCount}.json`, {
          body: JSON.stringify(
            {
              runId: prefix,
              target: "Supabase QA local descartável",
              browserName,
              scenario,
              expectedConflictCodes: ["23P01"],
              referenceMutationP95Ms: 1200,
            },
            null,
            2,
          ),
          contentType: "application/json",
        });

        expect(
          scenario.successCount,
          `Rajada de ${requestCount}: exatamente uma reserva deve persistir; erros: ${JSON.stringify(scenario.errorCounts)}`,
        ).toBe(1);
        expect(
          Object.keys(scenario.errorCounts).every((code) => code === "23P01"),
          `Rajada de ${requestCount}: deadlock ou erro inesperado: ${JSON.stringify(scenario.errorCounts)}`,
        ).toBe(true);
        expect(
          scenario.p95Ms,
          `Rajada de ${requestCount}: p95 excedeu o limite operacional de 5 s (referência do plano: 1,2 s).`,
        ).toBeLessThanOrEqual(5000);
      }

      console.log(
        `Carga local de reservas: ${JSON.stringify({ runId: prefix, scenarios })}`,
      );
    } catch (error) {
      testFailed = true;
      testFailure = error;
    } finally {
      try {
        const error = await cleanAppointmentsByMarker(client, fixture.tenantId, prefix);
        if (error) cleanupFailure = `Limpeza da carga E2E falhou: ${error.message}`;
      } catch (error) {
        cleanupFailure = `Limpeza da carga E2E falhou: ${String(error)}`;
      }
      try {
        const { error } = await client.auth.signOut();
        if (error && !cleanupFailure) cleanupFailure = `Logout da carga E2E falhou: ${error.message}`;
      } catch (error) {
        if (!cleanupFailure) cleanupFailure = `Logout da carga E2E falhou: ${String(error)}`;
      }
    }
    if (cleanupFailure) {
      throw new Error(`${cleanupFailure}${testFailed ? `; falha original: ${String(testFailure)}` : ""}`);
    }
    if (testFailed) throw testFailure;
  });

  test("SOAK: mantém integridade e recupera o slot em rajadas repetidas", async ({ browserName }, testInfo) => {
    test.skip(process.env.E2E_RUN_SOAK !== "true", "Execute npm run test:backend:soak para habilitar o soak QA local.");

    const durationMs = Number(process.env.E2E_SOAK_DURATION_MS ?? "60000");
    const concurrency = Number(process.env.E2E_SOAK_CONCURRENCY ?? "8");
    if (!Number.isInteger(durationMs) || durationMs < 10_000 || durationMs > 600_000) {
      throw new Error("E2E_SOAK_DURATION_MS deve ser um inteiro entre 10000 e 600000.");
    }
    if (!Number.isInteger(concurrency) || concurrency < 2 || concurrency > 25) {
      throw new Error("E2E_SOAK_CONCURRENCY deve ser um inteiro entre 2 e 25.");
    }
    test.setTimeout(durationMs + 120_000);

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
    const prefix = `E2E-BOOKING-SOAK-${Date.now()}`;
    const startedAt = performance.now();
    const batches: Array<Awaited<ReturnType<typeof runBookingBurst>>> = [];
    let testFailed = false;
    let testFailure: unknown;
    let cleanupFailure: string | undefined;

    try {
      const slots = await findSlotBundle(client, fixture, 21);
      let round = 0;
      while (performance.now() - startedAt < durationMs) {
        const marker = `${prefix}_ROUND_${String(round).padStart(4, "0")}`;
        const batch = await runBookingBurst(
          client,
          fixture,
          slots.first.slot_start,
          marker,
          concurrency,
        );
        batches.push(batch);

        expect(
          batch.successCount,
          `Lote ${round}: exatamente uma reserva deve vencer; erros: ${JSON.stringify(batch.errorCounts)}`,
        ).toBe(1);
        expect(
          Object.keys(batch.errorCounts).every((code) => code === "23P01"),
          `Lote ${round}: deadlock ou erro inesperado: ${JSON.stringify(batch.errorCounts)}`,
        ).toBe(true);
        expect(batch.p95Ms, `Lote ${round}: p95 excedeu 5 s`).toBeLessThanOrEqual(5000);

        const persisted = assertOk(
          await client
            .from("appointments")
            .select("id")
            .eq("tenant_id", fixture.tenantId)
            .like("internal_notes", `${marker}%`),
          `verificar reserva do lote ${round}`,
        );
        expect(persisted, `Lote ${round}: deve persistir exatamente uma reserva.`).toHaveLength(1);

        const cleanupError = await cleanAppointmentsByMarker(client, fixture.tenantId, marker);
        if (cleanupError) throw new Error(`Limpeza do lote ${round} falhou: ${cleanupError.message}`);
        const remaining = assertOk(
          await client
            .from("appointments")
            .select("id")
            .eq("tenant_id", fixture.tenantId)
            .like("internal_notes", `${marker}%`),
          `confirmar limpeza do lote ${round}`,
        );
        expect(remaining, `Lote ${round}: a limpeza deve remover todas as reservas sintéticas.`).toHaveLength(0);

        round += 1;
        if (round % 100 === 0) {
          console.log(`Soak local de reservas: ${round} lotes completos em ${Math.round(performance.now() - startedAt)} ms.`);
        }
      }
      expect(batches.length, "o soak deve concluir ao menos um lote").toBeGreaterThan(0);
    } catch (error) {
      testFailed = true;
      testFailure = error;
    } finally {
      try {
        const error = await cleanAppointmentsByMarker(client, fixture.tenantId, prefix);
        if (error) cleanupFailure = `Limpeza final do soak falhou: ${error.message}`;
        const residual = assertOk(
          await client
            .from("appointments")
            .select("id")
            .eq("tenant_id", fixture.tenantId)
            .like("internal_notes", `${prefix}%`),
          "confirmar limpeza final do soak",
        );
        if (residual.length && !cleanupFailure) {
          cleanupFailure = `Limpeza final deixou ${residual.length} reserva(s) sintética(s).`;
        }
      } catch (error) {
        cleanupFailure = `Limpeza final do soak falhou: ${String(error)}`;
      }
      try {
        const { error } = await client.auth.signOut();
        if (error && !cleanupFailure) cleanupFailure = `Logout do soak falhou: ${error.message}`;
      } catch (error) {
        if (!cleanupFailure) cleanupFailure = `Logout do soak falhou: ${String(error)}`;
      }

      const p95Values = batches.map((batch) => batch.p95Ms).sort((left, right) => left - right);
      const summary = {
        runId: prefix,
        target: "Supabase QA local descartável",
        browserName,
        durationMs: Math.round(performance.now() - startedAt),
        configuredDurationMs: durationMs,
        concurrency,
        completedBatches: batches.length,
        totalRequests: batches.reduce((total, batch) => total + batch.requestCount, 0),
        successfulReservations: batches.reduce((total, batch) => total + batch.successCount, 0),
        maxBatchP95Ms: Math.max(0, ...p95Values),
        medianBatchP95Ms: p95Values.length ? p95Values[Math.floor(p95Values.length / 2)] : null,
        errorCounts: batches.reduce<Record<string, number>>((counts, batch) => {
          for (const [code, count] of Object.entries(batch.errorCounts)) {
            counts[code] = (counts[code] ?? 0) + count;
          }
          return counts;
        }, {}),
        cleanupFailure: cleanupFailure ?? null,
      };
      console.log(`Resumo do soak de reservas: ${JSON.stringify(summary)}`);
      try {
        await testInfo.attach("appointment-soak-summary.json", {
          body: JSON.stringify(summary, null, 2),
          contentType: "application/json",
        });
      } catch (error) {
        if (!cleanupFailure) cleanupFailure = `Anexar relatório do soak falhou: ${String(error)}`;
      }
    }
    if (cleanupFailure) {
      throw new Error(`${cleanupFailure}${testFailed ? `; falha original: ${String(testFailure)}` : ""}`);
    }
    if (testFailed) throw testFailure;
  });

  test("MIXED: mantém leituras da agenda responsivas durante reservas concorrentes", async ({ browserName }, testInfo) => {
    test.skip(process.env.E2E_RUN_MIXED !== "true", "Execute npm run test:backend:mixed para habilitar tráfego misto QA local.");
    test.setTimeout(120_000);

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
    const slots = await findSlotBundle(client, fixture, 21);
    const prefix = `E2E-BOOKING-MIXED-${Date.now()}`;
    const readLatencies: number[] = [];
    const writeLatencies: number[] = [];
    const readErrors: string[] = [];
    const conflictCounts: Record<string, number> = {};
    let testFailed = false;
    let testFailure: unknown;
    let cleanupFailure: string | undefined;

    const percentile95 = (values: number[]) => {
      const sorted = [...values].sort((left, right) => left - right);
      return sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null;
    };

    try {
      for (let round = 0; round < 10; round += 1) {
        const marker = `${prefix}_ROUND_${String(round).padStart(2, "0")}`;
        const [booking, reads] = await Promise.all([
          runBookingBurst(client, fixture, slots.first.slot_start, marker, 25),
          Promise.all(
            Array.from({ length: 12 }, async (_, index) => {
              const started = performance.now();
              const result = index % 2 === 0
                ? await client.rpc("get_available_slots", {
                    _tenant_id: fixture.tenantId,
                    _professional_id: fixture.professionalId,
                    _unit_id: fixture.unitId,
                    _service_id: fixture.serviceId,
                    _day: slots.day,
                    _slot_step_minutes: 15,
                  })
                : await client
                    .from("appointments")
                    .select("id")
                    .eq("tenant_id", fixture.tenantId)
                    .limit(20);

              return {
                durationMs: performance.now() - started,
                errorCode: result.error?.code,
                dataPresent: result.data !== null,
              };
            }),
          ),
        ]);

        writeLatencies.push(booking.p95Ms);
        expect(booking.successCount, `Lote ${round}: exatamente uma reserva deve vencer.`).toBe(1);
        for (const [code, count] of Object.entries(booking.errorCounts)) {
          conflictCounts[code] = (conflictCounts[code] ?? 0) + count;
        }
        expect(
          Object.keys(booking.errorCounts).every((code) => code === "23P01"),
          `Lote ${round}: deadlock ou erro inesperado: ${JSON.stringify(booking.errorCounts)}`,
        ).toBe(true);
        expect(booking.p95Ms, `Lote ${round}: p95 de mutação acima de 1,2 s.`).toBeLessThanOrEqual(1200);

        for (const read of reads) {
          readLatencies.push(read.durationMs);
          if (read.errorCode || !read.dataPresent) {
            readErrors.push(read.errorCode ?? "resposta sem dados");
          }
        }
        expect(readErrors, `Lote ${round}: falha nas consultas paralelas.`).toEqual([]);
        expect(percentile95(reads.map((read) => read.durationMs)), `Lote ${round}: p95 de leitura acima de 800 ms.`)
          .toBeLessThanOrEqual(800);

        const persisted = assertOk(
          await client
            .from("appointments")
            .select("id")
            .eq("tenant_id", fixture.tenantId)
            .like("internal_notes", `${marker}%`),
          `verificar reserva do lote misto ${round}`,
        );
        expect(persisted, `Lote ${round}: deve haver exatamente uma reserva persistida.`).toHaveLength(1);

        const cleanupError = await cleanAppointmentsByMarker(client, fixture.tenantId, marker);
        if (cleanupError) throw new Error(`Limpeza do lote misto ${round} falhou: ${cleanupError.message}`);
      }

      console.log(`Resumo do tráfego misto: ${JSON.stringify({
        runId: prefix,
        target: "Supabase QA local descartável",
        browserName,
        rounds: 10,
        writeRequests: 250,
        readRequests: readLatencies.length,
        readP95Ms: percentile95(readLatencies),
        maxReadMs: Math.max(...readLatencies),
        mutationP95MaxMs: Math.max(...writeLatencies),
        conflictCounts,
      })}`);
    } catch (error) {
      testFailed = true;
      testFailure = error;
    } finally {
      try {
        const error = await cleanAppointmentsByMarker(client, fixture.tenantId, prefix);
        if (error) cleanupFailure = `Limpeza final do tráfego misto falhou: ${error.message}`;
        const residual = assertOk(
          await client
            .from("appointments")
            .select("id")
            .eq("tenant_id", fixture.tenantId)
            .like("internal_notes", `${prefix}%`),
          "confirmar limpeza final do tráfego misto",
        );
        if (residual.length && !cleanupFailure) {
          cleanupFailure = `Limpeza final deixou ${residual.length} reserva(s) sintética(s).`;
        }
      } catch (error) {
        cleanupFailure = `Limpeza final do tráfego misto falhou: ${String(error)}`;
      }
      try {
        const { error } = await client.auth.signOut();
        if (error && !cleanupFailure) cleanupFailure = `Logout do tráfego misto falhou: ${error.message}`;
      } catch (error) {
        if (!cleanupFailure) cleanupFailure = `Logout do tráfego misto falhou: ${String(error)}`;
      }

      try {
        await testInfo.attach("appointment-mixed-traffic-summary.json", {
          body: JSON.stringify({
            runId: prefix,
            readRequests: readLatencies.length,
            readP95Ms: percentile95(readLatencies),
            maxReadMs: readLatencies.length ? Math.max(...readLatencies) : null,
            mutationP95MaxMs: writeLatencies.length ? Math.max(...writeLatencies) : null,
            conflictCounts,
            readErrors,
            cleanupFailure: cleanupFailure ?? null,
          }, null, 2),
          contentType: "application/json",
        });
      } catch (error) {
        if (!cleanupFailure) cleanupFailure = `Anexar relatório do tráfego misto falhou: ${String(error)}`;
      }
    }
    if (cleanupFailure) {
      throw new Error(`${cleanupFailure}${testFailed ? `; falha original: ${String(testFailure)}` : ""}`);
    }
    if (testFailed) throw testFailure;
  });

  test("MULTI-TENANT: owner e recepção operam enquanto outro tenant permanece isolado", async ({ browserName }, testInfo) => {
    test.skip(
      process.env.E2E_RUN_MULTITENANT !== "true",
      "Execute npm run test:backend:multitenant para habilitar carga multi-tenant QA.",
    );
    const requiredMultiTenantEnv = [
      "E2E_FRONTDESK_USER",
      "E2E_FRONTDESK_PASS",
      "E2E_TENANT_B_USER",
      "E2E_TENANT_B_PASS",
    ];
    const missingMultiTenantEnv = requiredMultiTenantEnv.filter((key) => !env(key));
    test.skip(
      missingMultiTenantEnv.length > 0,
      `Credenciais multi-tenant ausentes: ${missingMultiTenantEnv.join(", ")}.`,
    );
    test.setTimeout(120_000);

    const createApiClient = () => createClient(
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

    const clientA = createApiClient();
    const fixtureA = await resolveFixture(clientA);
    const clientFrontdesk = createApiClient();
    const frontdeskAuth = assertOk(
      await clientFrontdesk.auth.signInWithPassword({
        email: env("E2E_FRONTDESK_USER"),
        password: env("E2E_FRONTDESK_PASS"),
      }),
      "login recepção QA",
    );
    if (!frontdeskAuth.user?.id) throw new Error("Login da recepção não retornou usuário.");
    const frontdeskMembership = assertOk(
      await clientFrontdesk
        .from("tenant_memberships")
        .select("tenant_id, role, tenants!inner(slug)")
        .eq("user_id", frontdeskAuth.user.id)
        .eq("status", "active")
        .eq("tenants.slug", env("E2E_TENANT_SLUG"))
        .maybeSingle(),
      "validar papel e tenant da recepção",
    );
    expect(frontdeskMembership?.tenant_id).toBe(fixtureA.tenantId);
    expect(frontdeskMembership?.role).toBe("frontdesk");

    const clientB = createApiClient();
    const ownerBAuth = assertOk(
      await clientB.auth.signInWithPassword({
        email: env("E2E_TENANT_B_USER"),
        password: env("E2E_TENANT_B_PASS"),
      }),
      "login owner tenant B QA",
    );
    if (!ownerBAuth.user?.id) throw new Error("Login do owner B não retornou usuário.");
    const tenantBSlug = env("E2E_TENANT_B_SLUG") || `${env("E2E_TENANT_SLUG")}-b`;
    const membershipB = assertOk(
      await clientB
        .from("tenant_memberships")
        .select("tenant_id, role, tenants!inner(slug)")
        .eq("user_id", ownerBAuth.user.id)
        .eq("status", "active")
        .eq("tenants.slug", tenantBSlug)
        .maybeSingle(),
      "validar papel e tenant do owner B",
    );
    if (!membershipB?.tenant_id) throw new Error("Owner B não possui membership ativo no tenant B.");
    expect(membershipB.tenant_id).not.toBe(fixtureA.tenantId);
    expect(membershipB.role).toBe("owner");

    const prefix = `E2E-BOOKING-MULTITENANT-${Date.now()}`;
    const readLatencies: number[] = [];
    const writeP95Latencies: number[] = [];
    const readErrors: string[] = [];
    const conflictCounts: Record<string, number> = {};
    let clientBFixtureId: string | undefined;
    let testFailed = false;
    let testFailure: unknown;
    let cleanupFailure: string | undefined;
    const percentile95 = (values: number[]) => {
      const sorted = [...values].sort((left, right) => left - right);
      return sorted.length ? sorted[Math.ceil(sorted.length * 0.95) - 1] : null;
    };
    const measureRead = async (
      label: string,
      request: () => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>,
    ) => {
      const started = performance.now();
      const result = await request();
      return {
        label,
        durationMs: performance.now() - started,
        data: result.data,
        errorCode: result.error?.code,
        errorMessage: result.error?.message,
      };
    };

    try {
      const fixtureClientB = assertOk(
        await clientB
          .from("clients")
          .insert({
            tenant_id: membershipB.tenant_id,
            full_name: `${prefix} cliente sintético B`,
            origin: "qa-multitenant-load",
            created_by: ownerBAuth.user.id,
          })
          .select("id")
          .single(),
        "criar cliente sintético temporário do tenant B",
      );
      clientBFixtureId = fixtureClientB.id;
      const slotsA = await findSlotBundle(clientA, fixtureA, 21);

      for (let round = 0; round < 10; round += 1) {
        const marker = `${prefix}_ROUND_${String(round).padStart(2, "0")}`;
        const [ownerBurst, frontdeskBurst, reads] = await Promise.all([
          runBookingBurst(clientA, fixtureA, slotsA.first.slot_start, `${marker}_OWNER`, 13),
          runBookingBurst(clientFrontdesk, fixtureA, slotsA.first.slot_start, `${marker}_FRONTDESK`, 12),
          Promise.all([
            measureRead("owner A lê disponibilidade", () => clientA.rpc("get_available_slots", {
              _tenant_id: fixtureA.tenantId,
              _professional_id: fixtureA.professionalId,
              _unit_id: fixtureA.unitId,
              _service_id: fixtureA.serviceId,
              _day: slotsA.day,
              _slot_step_minutes: 15,
            })),
            measureRead("recepção A lê suas reservas sintéticas", () => clientFrontdesk
              .from("appointments")
              .select("id")
              .eq("tenant_id", fixtureA.tenantId)
              .like("internal_notes", `${marker}%`)),
            measureRead("owner B lê seu cliente", () => clientB
              .from("clients")
              .select("id")
              .eq("tenant_id", membershipB.tenant_id)
              .eq("id", fixtureClientB.id)
              .maybeSingle()),
            measureRead("owner B tenta ler cliente A", () => clientB
              .from("clients")
              .select("id")
              .eq("id", fixtureA.clientId)
              .maybeSingle()),
            measureRead("owner B tenta ler reservas A", () => clientB
              .from("appointments")
              .select("id")
              .eq("tenant_id", fixtureA.tenantId)
              .like("internal_notes", `${marker}%`)),
          ]),
        ]);

        const bursts = [ownerBurst, frontdeskBurst];
        const successes = bursts.reduce((total, batch) => total + batch.successCount, 0);
        expect(successes, `Lote ${round}: owner e recepção devem produzir um único vencedor.`).toBe(1);
        const roundErrors = bursts.flatMap((batch) => Object.entries(batch.errorCounts));
        for (const [code, count] of roundErrors) conflictCounts[code] = (conflictCounts[code] ?? 0) + count;
        expect(
          roundErrors.every(([code]) => code === "23P01"),
          `Lote ${round}: deadlock ou erro inesperado: ${JSON.stringify(roundErrors)}`,
        ).toBe(true);
        writeP95Latencies.push(...bursts.map((batch) => batch.p95Ms));
        expect(Math.max(...bursts.map((batch) => batch.p95Ms)), `Lote ${round}: p95 de mutação acima de 1,2 s.`)
          .toBeLessThanOrEqual(1200);

        for (const read of reads) {
          readLatencies.push(read.durationMs);
          if (read.errorCode) readErrors.push(`${read.label}: ${read.errorCode}`);
        }
        expect(readErrors, `Lote ${round}: erro de leitura entre papéis/tenants.`).toEqual([]);
        expect(percentile95(reads.map((read) => read.durationMs)), `Lote ${round}: p95 de leitura acima de 800 ms.`)
          .toBeLessThanOrEqual(800);
        expect(reads.find((read) => read.label === "owner B tenta ler cliente A")?.data)
          .toBeNull();
        expect(reads.find((read) => read.label === "owner B tenta ler reservas A")?.data)
          .toEqual([]);
        expect((reads.find((read) => read.label === "owner B lê seu cliente")?.data as { id?: string } | null)?.id)
          .toBe(fixtureClientB.id);

        const persisted = assertOk(
          await clientA
            .from("appointments")
            .select("id")
            .eq("tenant_id", fixtureA.tenantId)
            .like("internal_notes", `${marker}%`),
          `confirmar gravação conjunta do lote ${round}`,
        );
        expect(persisted, `Lote ${round}: exatamente uma reserva A deve persistir.`).toHaveLength(1);
        const hiddenFromB = assertOk(
          await clientB
            .from("appointments")
            .select("id")
            .eq("tenant_id", fixtureA.tenantId)
            .like("internal_notes", `${marker}%`),
          `revalidar isolamento A/B após lote ${round}`,
        );
        expect(hiddenFromB, `Lote ${round}: owner B não deve ver a reserva do tenant A.`).toHaveLength(0);

        const cleanupError = await cleanAppointmentsByMarker(clientA, fixtureA.tenantId, marker);
        if (cleanupError) throw new Error(`Limpeza do lote multi-tenant ${round} falhou: ${cleanupError.message}`);
      }

      console.log(`Resumo multi-tenant: ${JSON.stringify({
        runId: prefix,
        target: "Supabase QA local descartável",
        browserName,
        roles: ["tenant A owner", "tenant A frontdesk", "tenant B owner"],
        rounds: 10,
        writeRequests: 250,
        readRequests: readLatencies.length,
        readP95Ms: percentile95(readLatencies),
        maxReadMs: Math.max(...readLatencies),
        mutationP95MaxMs: Math.max(...writeP95Latencies),
        conflictCounts,
        crossTenantLeaks: 0,
      })}`);
    } catch (error) {
      testFailed = true;
      testFailure = error;
    } finally {
      try {
        const error = await cleanAppointmentsByMarker(clientA, fixtureA.tenantId, prefix);
        if (error) cleanupFailure = `Limpeza final multi-tenant falhou: ${error.message}`;
        const residual = assertOk(
          await clientA
            .from("appointments")
            .select("id")
            .eq("tenant_id", fixtureA.tenantId)
            .like("internal_notes", `${prefix}%`),
          "confirmar limpeza final multi-tenant",
        );
        if (residual.length && !cleanupFailure) cleanupFailure = `Limpeza final deixou ${residual.length} reserva(s) A.`;
      } catch (error) {
        cleanupFailure = `Limpeza final multi-tenant falhou: ${String(error)}`;
      }
      if (clientBFixtureId) {
        try {
          const { error } = await clientB.from("clients").delete().eq("id", clientBFixtureId);
          if (error && !cleanupFailure) cleanupFailure = `Limpeza do cliente B sintético falhou: ${error.message}`;
        } catch (error) {
          if (!cleanupFailure) cleanupFailure = `Limpeza do cliente B sintético falhou: ${String(error)}`;
        }
      }
      for (const session of [clientA, clientFrontdesk, clientB]) {
        try {
          const { error } = await session.auth.signOut();
          if (error && !cleanupFailure) cleanupFailure = `Logout multi-tenant falhou: ${error.message}`;
        } catch (error) {
          if (!cleanupFailure) cleanupFailure = `Logout multi-tenant falhou: ${String(error)}`;
        }
      }
      try {
        await testInfo.attach("appointment-multitenant-summary.json", {
          body: JSON.stringify({
            runId: prefix,
            readRequests: readLatencies.length,
            readP95Ms: percentile95(readLatencies),
            maxReadMs: readLatencies.length ? Math.max(...readLatencies) : null,
            mutationP95MaxMs: writeP95Latencies.length ? Math.max(...writeP95Latencies) : null,
            conflictCounts,
            readErrors,
            crossTenantLeaks: 0,
            cleanupFailure: cleanupFailure ?? null,
          }, null, 2),
          contentType: "application/json",
        });
      } catch (error) {
        if (!cleanupFailure) cleanupFailure = `Anexar relatório multi-tenant falhou: ${String(error)}`;
      }
    }
    if (cleanupFailure) {
      throw new Error(`${cleanupFailure}${testFailed ? `; falha original: ${String(testFailure)}` : ""}`);
    }
    if (testFailed) throw testFailure;
  });
});
