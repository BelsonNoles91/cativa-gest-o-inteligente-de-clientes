import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => {
  type QueryResult = { data: unknown; error: unknown | null };
  const results = new Map<string, QueryResult>();
  const queries: Array<{ table: string; query: Record<string, any> }> = [];

  const from = vi.fn((table: string) => {
    const currentResult = () => results.get(table) ?? { data: [], error: null };
    const query: Record<string, any> = {};
    for (const method of [
      "select", "eq", "gte", "lt", "gt", "not", "in", "or", "order",
      "insert", "upsert", "update", "delete",
    ]) {
      query[method] = vi.fn(() => query);
    }
    query.single = vi.fn(async () => currentResult());
    query.maybeSingle = vi.fn(async () => currentResult());
    query.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(currentResult()).then(resolve, reject);
    queries.push({ table, query });
    return query;
  });

  return { from, rpc: vi.fn(), results, queries };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import {
  createAvailability,
  createRecurringBlock,
  createResource,
  createTimeOff,
  createWaitlistEntry,
  deleteAvailability,
  deleteRecurringBlock,
  deleteResource,
  deleteTimeOff,
  deleteWaitlistEntry,
  getAppointment,
  getAvailableSlots,
  insertAppointment,
  listAppointmentItems,
  listAppointmentItemsForAppointments,
  listAppointments,
  listAppointmentsHydrated,
  listBusinessHours,
  listProfessionalAvailability,
  listProfessionalsLite,
  listRecurringBlocks,
  listResources,
  listTimeOff,
  listWaitlist,
  listWaitlistHydrated,
  setAppointmentStatus,
  setWaitlistStatus,
  updateAppointment,
  updateWaitlistEntry,
  upsertBusinessHour,
} from "../scheduling";

const tenantId = "tenant-a";
const rangeStart = "2026-10-05T00:00:00.000Z";
const rangeEnd = "2026-10-06T00:00:00.000Z";
const databaseError = { code: "503", message: "database unavailable" };

function respond(table: string, data: unknown, error: unknown | null = null) {
  supabaseMock.results.set(table, { data, error });
}

function latestQuery(table: string) {
  const found = supabaseMock.queries.filter((call) => call.table === table).at(-1);
  if (!found) throw new Error(`No query was recorded for ${table}`);
  return found.query;
}

function appointmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "appointment-1",
    tenant_id: tenantId,
    unit_id: "unit-a",
    client_id: "client-a",
    professional_id: "professional-a",
    resource_id: null,
    cancellation_policy_id: null,
    status: "pending",
    source: "frontdesk",
    starts_at: rangeStart,
    ends_at: "2026-10-05T00:45:00.000Z",
    duration_minutes: 45,
    buffer_before_minutes: null,
    buffer_after_minutes: null,
    is_walk_in: false,
    is_overbooked: false,
    total_price_cents: null,
    notes: null,
    internal_notes: null,
    confirmed_at: null,
    reminded_at: null,
    arrived_at: null,
    started_at: null,
    completed_at: null,
    canceled_at: null,
    no_show_at: null,
    canceled_reason: null,
    created_at: rangeStart,
    updated_at: rangeStart,
    ...overrides,
  };
}

function waitlistRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "waitlist-1",
    tenant_id: tenantId,
    preferred_unit_id: "unit-a",
    client_id: "client-a",
    service_id: "service-a",
    preferred_professional_id: "professional-a",
    desired_window_start: rangeStart,
    desired_window_end: rangeEnd,
    notes: "Preferência de manhã",
    priority: 80,
    status: "open",
    contacted_at: null,
    scheduled_appointment_id: null,
    created_at: rangeStart,
    ...overrides,
  };
}

describe("scheduling repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.results.clear();
    supabaseMock.queries.length = 0;
  });

  it("lista recursos, filtra unidade preservando recursos globais e mapeia opcionais", async () => {
    respond("resources", [{
      id: "room-1", tenant_id: tenantId, unit_id: null, name: "Sala 1",
      resource_type: "room", color: null, notes: null, is_active: true,
    }]);

    await expect(listResources(tenantId, "unit-a")).resolves.toEqual([{
      id: "room-1", tenantId, unitId: null, name: "Sala 1", resourceType: "room",
      color: null, notes: null, isActive: true,
    }]);
    expect(supabaseMock.from).toHaveBeenCalledWith("resources");
    expect(latestQuery("resources").eq).toHaveBeenCalledWith("tenant_id", tenantId);
    expect(latestQuery("resources").or).toHaveBeenCalledWith("unit_id.eq.unit-a,unit_id.is.null");
  });

  it("não aplica filtro de unidade ausente e trata lista de recursos vazia", async () => {
    respond("resources", null);
    await expect(listResources(tenantId, null)).resolves.toEqual([]);
    expect(latestQuery("resources").or).not.toHaveBeenCalled();
  });

  it("cria recurso com defaults explícitos e propaga erros de exclusão", async () => {
    respond("resources", {
      id: "room-2", tenant_id: tenantId, unit_id: null, name: "Sala 2",
      resource_type: "room", color: null, notes: null, is_active: true,
    });
    await expect(createResource({ tenantId, name: "Sala 2" })).resolves.toMatchObject({
      id: "room-2", resourceType: "room", isActive: true,
    });
    expect(latestQuery("resources").insert).toHaveBeenCalledWith({
      tenant_id: tenantId, name: "Sala 2", resource_type: "room", unit_id: null,
      color: null, notes: null,
    });

    await expect(deleteResource("room-2")).resolves.toBeUndefined();
    expect(latestQuery("resources").delete).toHaveBeenCalledOnce();
    expect(latestQuery("resources").eq).toHaveBeenCalledWith("id", "room-2");

    respond("resources", null, databaseError);
    await expect(deleteResource("room-2")).rejects.toBe(databaseError);
  });

  it("lista e grava horário comercial no conflito tenant/unidade/dia", async () => {
    respond("unit_business_hours", [{
      id: "hours-1", tenant_id: tenantId, unit_id: "unit-a", weekday: 1,
      opens_at: "09:00:00", closes_at: "18:00:00", is_closed: false,
    }]);
    await expect(listBusinessHours(tenantId, "unit-a")).resolves.toMatchObject([
      { id: "hours-1", weekday: 1, opensAt: "09:00:00", isClosed: false },
    ]);
    expect(latestQuery("unit_business_hours").eq).toHaveBeenCalledWith("tenant_id", tenantId);
    expect(latestQuery("unit_business_hours").eq).toHaveBeenCalledWith("unit_id", "unit-a");

    await upsertBusinessHour({
      tenantId, unitId: "unit-a", weekday: 1, opensAt: "10:00", closesAt: "16:00", isClosed: true,
    });
    expect(latestQuery("unit_business_hours").upsert).toHaveBeenCalledWith({
      tenant_id: tenantId, unit_id: "unit-a", weekday: 1, opens_at: "10:00", closes_at: "16:00", is_closed: true,
    }, { onConflict: "tenant_id,unit_id,weekday" });
    await upsertBusinessHour({ tenantId, unitId: "unit-a", weekday: 2, opensAt: "09:00", closesAt: "17:00" });
    expect(latestQuery("unit_business_hours").upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ is_closed: false }), expect.any(Object),
    );
  });

  it("lista disponibilidade profissional com filtro opcional e cria/exclui intervalos", async () => {
    respond("professional_availability", [{
      id: "availability-1", tenant_id: tenantId, professional_id: "professional-a",
      unit_id: null, weekday: 2, starts_at: "09:00:00", ends_at: "17:00:00", is_active: true,
    }]);
    await expect(listProfessionalAvailability(tenantId, "professional-a")).resolves.toMatchObject([
      { id: "availability-1", professionalId: "professional-a", isActive: true },
    ]);
    expect(latestQuery("professional_availability").eq).toHaveBeenCalledWith("professional_id", "professional-a");
    await listProfessionalAvailability(tenantId);
    expect(latestQuery("professional_availability").eq).not.toHaveBeenCalledWith("professional_id", expect.anything());
    await createAvailability({
      tenantId, professionalId: "professional-a", weekday: 2, startsAt: "09:00", endsAt: "17:00",
    });
    expect(latestQuery("professional_availability").insert).toHaveBeenCalledWith({
      tenant_id: tenantId, professional_id: "professional-a", weekday: 2,
      starts_at: "09:00", ends_at: "17:00", unit_id: null,
    });
    await deleteAvailability("availability-1");
    expect(latestQuery("professional_availability").delete).toHaveBeenCalledOnce();
  });

  it("lista e grava bloqueios pontuais e recorrentes, usando valores null por omissão", async () => {
    respond("time_off_blocks", [{
      id: "time-off-1", tenant_id: tenantId, scope: "professional", professional_id: "professional-a",
      unit_id: null, starts_at: rangeStart, ends_at: rangeEnd, reason: null,
    }]);
    await expect(listTimeOff(tenantId, rangeStart, rangeEnd)).resolves.toMatchObject([
      { id: "time-off-1", scope: "professional", reason: null },
    ]);
    expect(latestQuery("time_off_blocks").lt).toHaveBeenCalledWith("starts_at", rangeEnd);
    expect(latestQuery("time_off_blocks").gt).toHaveBeenCalledWith("ends_at", rangeStart);
    await createTimeOff({ tenantId, scope: "unit", startsAt: rangeStart, endsAt: rangeEnd });
    expect(latestQuery("time_off_blocks").insert).toHaveBeenCalledWith({
      tenant_id: tenantId, scope: "unit", starts_at: rangeStart, ends_at: rangeEnd,
      reason: null, professional_id: null, unit_id: null,
    });
    await deleteTimeOff("time-off-1");

    respond("recurring_blocks", [{
      id: "recurring-1", tenant_id: tenantId, professional_id: null, unit_id: "unit-a",
      weekday: 0, starts_at: "12:00:00", ends_at: "13:00:00", reason: "Almoço", is_active: true,
    }]);
    await expect(listRecurringBlocks(tenantId)).resolves.toMatchObject([
      { id: "recurring-1", unitId: "unit-a", reason: "Almoço", isActive: true },
    ]);
    await createRecurringBlock({ tenantId, weekday: 0, startsAt: "12:00", endsAt: "13:00" });
    expect(latestQuery("recurring_blocks").insert).toHaveBeenCalledWith({
      tenant_id: tenantId, weekday: 0, starts_at: "12:00", ends_at: "13:00",
      professional_id: null, unit_id: null, reason: null,
    });
    await deleteRecurringBlock("recurring-1");
    expect(latestQuery("recurring_blocks").delete).toHaveBeenCalledOnce();
  });

  it("converte slots da RPC e devolve lista vazia com log em erro transitório", async () => {
    supabaseMock.rpc.mockResolvedValue({
      data: [{ slot_start: rangeStart, slot_end: "2026-10-05T00:45:00.000Z" }], error: null,
    });
    await expect(getAvailableSlots({
      tenantId, professionalId: "professional-a", unitId: "unit-a", serviceId: "service-a", day: "2026-10-05",
    })).resolves.toEqual([{ startsAt: rangeStart, endsAt: "2026-10-05T00:45:00.000Z" }]);
    expect(supabaseMock.rpc).toHaveBeenCalledWith("get_available_slots", {
      _tenant_id: tenantId, _professional_id: "professional-a", _unit_id: "unit-a",
      _service_id: "service-a", _day: "2026-10-05", _slot_step_minutes: 15,
    });

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: databaseError });
    await expect(getAvailableSlots({
      tenantId, professionalId: "professional-a", unitId: "unit-a", serviceId: "service-a",
      day: "2026-10-05", slotStepMinutes: 30,
    })).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalledWith("[SchedulingRepo:getAvailableSlots]", databaseError);
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith("get_available_slots", expect.objectContaining({
      _slot_step_minutes: 30,
    }));
    consoleError.mockRestore();
  });

  it("aplica todos os filtros de agenda, mapeia defaults e propaga falhas", async () => {
    respond("appointments", [appointmentRow()]);
    await expect(listAppointments({
      tenantId, unitId: "unit-a", professionalId: "professional-a", clientId: "client-a",
      rangeStart, rangeEnd, excludeStatuses: ["canceled", "no_show"],
    })).resolves.toMatchObject([{
      id: "appointment-1", tenantId, status: "pending", source: "frontdesk",
      bufferBeforeMinutes: 0, bufferAfterMinutes: 0, totalPriceCents: 0,
      resourceId: null, cancellationPolicyId: null, canceledAt: null,
    }]);
    expect(latestQuery("appointments").eq).toHaveBeenCalledWith("tenant_id", tenantId);
    expect(latestQuery("appointments").eq).toHaveBeenCalledWith("unit_id", "unit-a");
    expect(latestQuery("appointments").eq).toHaveBeenCalledWith("professional_id", "professional-a");
    expect(latestQuery("appointments").eq).toHaveBeenCalledWith("client_id", "client-a");
    expect(latestQuery("appointments").not).toHaveBeenCalledWith("status", "in", "(canceled,no_show)");

    respond("appointments", null, databaseError);
    await expect(listAppointments({ tenantId, rangeStart, rangeEnd })).rejects.toBe(databaseError);
    respond("appointments", null);
    await expect(listAppointments({ tenantId, rangeStart, rangeEnd })).resolves.toEqual([]);
  });

  it("hidrata o primeiro serviço e dados relacionados, aceitando relações ausentes", async () => {
    respond("appointments", [
      appointmentRow({
        appointment_items: [
          { service: { id: "service-a", name: "Corte" } },
          { service: { id: "service-b", name: "Ignorado após o primeiro item" } },
        ],
        client: { full_name: "Cliente A" }, professional: { display_name: "Profissional A" },
        unit: { name: "Unidade A" }, resource: { name: "Sala 1" },
      }),
      appointmentRow({
        id: "appointment-2", appointment_items: [], client: null, professional: null, unit: null, resource: null,
      }),
    ]);
    await expect(listAppointmentsHydrated({ tenantId, rangeStart, rangeEnd })).resolves.toEqual([
      {
        appointment: expect.objectContaining({ id: "appointment-1" }),
        serviceId: "service-a", serviceName: "Corte", clientName: "Cliente A",
        professionalName: "Profissional A", unitName: "Unidade A", resourceName: "Sala 1",
      },
      {
        appointment: expect.objectContaining({ id: "appointment-2" }),
        serviceId: null, serviceName: null, clientName: null, professionalName: null, unitName: null, resourceName: null,
      },
    ]);
    respond("appointments", null);
    await expect(listAppointmentsHydrated({ tenantId, rangeStart, rangeEnd })).resolves.toEqual([]);
    respond("appointments", null, databaseError);
    await expect(listAppointmentsHydrated({ tenantId, rangeStart, rangeEnd })).rejects.toBe(databaseError);
  });

  it("aplica filtros opcionais também à consulta hidratada", async () => {
    respond("appointments", []);
    await listAppointmentsHydrated({
      tenantId, unitId: "unit-a", professionalId: "professional-a", clientId: "client-a",
      rangeStart, rangeEnd, excludeStatuses: ["canceled"],
    });
    expect(latestQuery("appointments").eq).toHaveBeenCalledWith("unit_id", "unit-a");
    expect(latestQuery("appointments").eq).toHaveBeenCalledWith("professional_id", "professional-a");
    expect(latestQuery("appointments").eq).toHaveBeenCalledWith("client_id", "client-a");
    expect(latestQuery("appointments").not).toHaveBeenCalledWith("status", "in", "(canceled)");
  });

  it("busca agendamento individual e distingue ausência de registro de falha", async () => {
    respond("appointments", appointmentRow({ resource_id: "room-1", total_price_cents: 3500 }));
    await expect(getAppointment("appointment-1")).resolves.toMatchObject({
      id: "appointment-1", resourceId: "room-1", totalPriceCents: 3500,
    });
    expect(latestQuery("appointments").maybeSingle).toHaveBeenCalledOnce();
    respond("appointments", null);
    await expect(getAppointment("missing")).resolves.toBeNull();
    respond("appointments", null, databaseError);
    await expect(getAppointment("appointment-1")).rejects.toBe(databaseError);
  });

  it("cria agendamento apenas pela RPC atômica e valida retorno vazio", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: [appointmentRow({ status: "confirmed" })], error: null });
    const input = {
      tenantId, unitId: "unit-a", clientId: "client-a", professionalId: "professional-a",
      serviceId: "service-a", startsAt: rangeStart, endsAt: rangeEnd, durationMinutes: 45,
    };
    await expect(insertAppointment(input)).resolves.toMatchObject({ id: "appointment-1", status: "confirmed" });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("create_appointment_atomic", {
      _tenant_id: tenantId, _unit_id: "unit-a", _client_id: "client-a", _professional_id: "professional-a",
      _service_id: "service-a", _starts_at: rangeStart, _ends_at: rangeEnd, _duration_minutes: 45,
      _buffer_before_minutes: 0, _buffer_after_minutes: 0, _resource_id: undefined,
      _cancellation_policy_id: undefined, _source: "frontdesk", _status: "pending",
      _notes: undefined, _internal_notes: undefined, _total_price_cents: 0,
      _is_walk_in: false, _is_overbooked: false, _created_by: undefined, _item_price_cents: 0,
    });
    expect(supabaseMock.from).not.toHaveBeenCalled();

    supabaseMock.rpc.mockResolvedValue({ data: [], error: null });
    await expect(insertAppointment(input)).rejects.toThrow("O agendamento não foi criado.");
    supabaseMock.rpc.mockResolvedValue({ data: null, error: databaseError });
    await expect(insertAppointment(input)).rejects.toBe(databaseError);
  });

  it("mapeia campos customizados de criação e só atualiza valores explicitamente fornecidos", async () => {
    supabaseMock.rpc.mockResolvedValue({ data: [appointmentRow()], error: null });
    await insertAppointment({
      tenantId, unitId: "unit-a", clientId: "client-a", professionalId: "professional-a", serviceId: "service-a",
      startsAt: rangeStart, endsAt: rangeEnd, durationMinutes: 45, bufferBeforeMinutes: 5, bufferAfterMinutes: 10,
      resourceId: "room-1", cancellationPolicyId: "policy-1", source: "client_portal", status: "requested",
      notes: "nota", internalNotes: "interna", totalPriceCents: 5000, itemPriceCents: 4500,
      isWalkIn: true, isOverbooked: true, createdBy: "user-a",
    });
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith("create_appointment_atomic", expect.objectContaining({
      _buffer_before_minutes: 5, _buffer_after_minutes: 10, _resource_id: "room-1",
      _cancellation_policy_id: "policy-1", _source: "client_portal", _status: "requested",
      _notes: "nota", _internal_notes: "interna", _total_price_cents: 5000, _item_price_cents: 4500,
      _is_walk_in: true, _is_overbooked: true, _created_by: "user-a",
    }));

    respond("appointments", appointmentRow({ notes: null, resource_id: null }));
    await updateAppointment("appointment-1", {
      startsAt: rangeStart, endsAt: rangeEnd, unitId: "unit-b", professionalId: "professional-b",
      resourceId: null, notes: null, internalNotes: "private", isOverbooked: true,
    });
    expect(latestQuery("appointments").update).toHaveBeenCalledWith({
      starts_at: rangeStart, ends_at: rangeEnd, unit_id: "unit-b", professional_id: "professional-b",
      resource_id: null, notes: null, internal_notes: "private", is_overbooked: true,
    });
    await updateAppointment("appointment-1", { notes: null, resourceId: null, isOverbooked: false });
    expect(latestQuery("appointments").update).toHaveBeenCalledWith({
      resource_id: null, notes: null, is_overbooked: false,
    });
    await expect(updateAppointment("appointment-1", {})).resolves.toMatchObject({ id: "appointment-1" });
    expect(latestQuery("appointments").update).toHaveBeenLastCalledWith({});
    respond("appointments", null, databaseError);
    await expect(updateAppointment("appointment-1", { unitId: "unit-b" })).rejects.toBe(databaseError);
  });

  it.each([
    ["confirmed", "confirmed_at"], ["reminded", "reminded_at"], ["arrived", "arrived_at"],
    ["in_service", "started_at"], ["completed", "completed_at"], ["no_show", "no_show_at"],
  ] as const)("registra timestamp ao mudar para %s", async (status, stampColumn) => {
    await setAppointmentStatus("appointment-1", status);
    const patch = latestQuery("appointments").update.mock.calls.at(-1)?.[0];
    expect(patch).toMatchObject({ status });
    expect(new Date(patch[stampColumn]).toISOString()).toBe(patch[stampColumn]);
  });

  it("registra cancelamento com motivo opcional e propaga falha de status", async () => {
    await setAppointmentStatus("appointment-1", "canceled", { reason: "Cliente solicitou" });
    const patch = latestQuery("appointments").update.mock.calls.at(-1)?.[0];
    expect(patch).toMatchObject({ status: "canceled", canceled_reason: "Cliente solicitou" });
    expect(new Date(patch.canceled_at).toISOString()).toBe(patch.canceled_at);

    await setAppointmentStatus("appointment-1", "canceled");
    expect(latestQuery("appointments").update).toHaveBeenLastCalledWith(expect.objectContaining({ canceled_reason: null }));
    respond("appointments", null, databaseError);
    await expect(setAppointmentStatus("appointment-1", "pending")).rejects.toBe(databaseError);
  });

  it("lista itens de agendamento e evita consulta quando a lista de IDs é vazia", async () => {
    respond("appointment_items", [{
      id: "item-1", appointment_id: "appointment-1", service_id: "service-a", duration_minutes: 45,
      price_cents: 2500, position: 0, notes: null,
    }]);
    await expect(listAppointmentItems("appointment-1")).resolves.toMatchObject([
      { id: "item-1", appointmentId: "appointment-1", serviceId: "service-a", priceCents: 2500 },
    ]);
    expect(latestQuery("appointment_items").eq).toHaveBeenCalledWith("appointment_id", "appointment-1");
    const callCount = supabaseMock.from.mock.calls.length;
    await expect(listAppointmentItemsForAppointments([])).resolves.toEqual([]);
    expect(supabaseMock.from).toHaveBeenCalledTimes(callCount);
    await expect(listAppointmentItemsForAppointments(["appointment-1", "appointment-2"])).resolves.toHaveLength(1);
    expect(latestQuery("appointment_items").in).toHaveBeenCalledWith("appointment_id", ["appointment-1", "appointment-2"]);
    respond("appointment_items", null, databaseError);
    await expect(listAppointmentItems("appointment-1")).rejects.toBe(databaseError);
  });

  it("lista fila de espera ordenada e mapeia opcionais, incluindo filtro por status", async () => {
    respond("waitlist_entries", [waitlistRow()]);
    await expect(listWaitlist(tenantId, "open")).resolves.toMatchObject([
      { id: "waitlist-1", tenantId, status: "open", priority: 80, contactedAt: null },
    ]);
    expect(latestQuery("waitlist_entries").eq).toHaveBeenCalledWith("tenant_id", tenantId);
    expect(latestQuery("waitlist_entries").eq).toHaveBeenCalledWith("status", "open");
    await listWaitlist(tenantId);
    expect(latestQuery("waitlist_entries").eq).toHaveBeenCalledTimes(1);
    respond("waitlist_entries", null);
    await expect(listWaitlist(tenantId)).resolves.toEqual([]);
    respond("waitlist_entries", null, databaseError);
    await expect(listWaitlist(tenantId)).rejects.toBe(databaseError);
  });

  it("hidrata fila em lote, deduplica IDs, prefere WhatsApp e aceita referências opcionais", async () => {
    respond("waitlist_entries", [
      waitlistRow(),
      waitlistRow({
        id: "waitlist-2", client_id: "client-a", service_id: null, preferred_professional_id: null,
        preferred_unit_id: null, priority: 10,
      }),
    ]);
    respond("clients", [{ id: "client-a", full_name: "Cliente A", phone: "111", whatsapp_phone: "222" }]);
    respond("services", [{ id: "service-a", name: "Corte" }]);
    respond("professionals", [{ id: "professional-a", display_name: "Ana" }]);
    respond("units", [{ id: "unit-a", name: "Centro" }]);

    await expect(listWaitlistHydrated(tenantId)).resolves.toEqual([
      {
        entry: expect.objectContaining({ id: "waitlist-1" }), clientName: "Cliente A", clientPhone: "222",
        serviceName: "Corte", professionalName: "Ana", unitName: "Centro",
      },
      {
        entry: expect.objectContaining({ id: "waitlist-2" }), clientName: "Cliente A", clientPhone: "222",
        serviceName: null, professionalName: null, unitName: null,
      },
    ]);
    expect(latestQuery("clients").in).toHaveBeenCalledWith("id", ["client-a"]);
    expect(latestQuery("services").in).toHaveBeenCalledWith("id", ["service-a"]);
    expect(latestQuery("professionals").in).toHaveBeenCalledWith("id", ["professional-a"]);
    expect(latestQuery("units").in).toHaveBeenCalledWith("id", ["unit-a"]);

    respond("waitlist_entries", []);
    const callCount = supabaseMock.from.mock.calls.length;
    await expect(listWaitlistHydrated(tenantId)).resolves.toEqual([]);
    expect(supabaseMock.from).toHaveBeenCalledTimes(callCount + 1);
  });

  it("propaga falha de qualquer consulta secundária ao hidratar a fila", async () => {
    respond("waitlist_entries", [waitlistRow()]);
    respond("clients", null, databaseError);
    respond("services", []);
    respond("professionals", []);
    respond("units", []);
    await expect(listWaitlistHydrated(tenantId)).rejects.toBe(databaseError);
  });

  it.each(["services", "professionals", "units"] as const)(
    "propaga falha de hidratação da tabela %s",
    async (failedTable) => {
      respond("waitlist_entries", [waitlistRow()]);
      respond("clients", []);
      respond("services", []);
      respond("professionals", []);
      respond("units", []);
      respond(failedTable, null, databaseError);
      await expect(listWaitlistHydrated(tenantId)).rejects.toBe(databaseError);
    },
  );

  it("não consulta catálogos opcionais quando não há referências e usa telefone comum como fallback", async () => {
    respond("waitlist_entries", [waitlistRow({
      service_id: null, preferred_professional_id: null, preferred_unit_id: null,
    })]);
    respond("clients", [{ id: "client-a", full_name: null, phone: "111", whatsapp_phone: null }]);
    await expect(listWaitlistHydrated(tenantId)).resolves.toEqual([{
      entry: expect.objectContaining({ id: "waitlist-1", serviceId: null }),
      clientName: null, clientPhone: "111", serviceName: null, professionalName: null, unitName: null,
    }]);
    expect(supabaseMock.from).not.toHaveBeenCalledWith("services");
    expect(supabaseMock.from).not.toHaveBeenCalledWith("professionals");
    expect(supabaseMock.from).not.toHaveBeenCalledWith("units");
  });

  it("cria, atualiza, altera estado e exclui itens da fila sem perder null explícito", async () => {
    await createWaitlistEntry({ tenantId, clientId: "client-a" });
    expect(latestQuery("waitlist_entries").insert).toHaveBeenCalledWith({
      tenant_id: tenantId, client_id: "client-a", preferred_unit_id: null, service_id: null,
      preferred_professional_id: null, desired_window_start: null, desired_window_end: null,
      notes: null, priority: 50,
    });
    await updateWaitlistEntry("waitlist-1", {
      preferredUnitId: null, preferredProfessionalId: "professional-b", serviceId: "service-b",
      desiredWindowStart: rangeStart, desiredWindowEnd: rangeEnd, notes: null, priority: 100,
    });
    expect(latestQuery("waitlist_entries").update).toHaveBeenCalledWith({
      preferred_unit_id: null, preferred_professional_id: "professional-b", service_id: "service-b",
      desired_window_start: rangeStart, desired_window_end: rangeEnd, notes: null, priority: 100,
    });
    await updateWaitlistEntry("waitlist-1", {});
    expect(latestQuery("waitlist_entries").update).toHaveBeenLastCalledWith({});

    await setWaitlistStatus("waitlist-1", "contacted");
    const contacted = latestQuery("waitlist_entries").update.mock.calls.at(-1)?.[0];
    expect(contacted.status).toBe("contacted");
    expect(new Date(contacted.contacted_at).toISOString()).toBe(contacted.contacted_at);
    await setWaitlistStatus("waitlist-1", "scheduled", { scheduledAppointmentId: "appointment-1" });
    expect(latestQuery("waitlist_entries").update).toHaveBeenLastCalledWith({
      status: "scheduled", scheduled_appointment_id: "appointment-1",
    });
    await setWaitlistStatus("waitlist-1", "scheduled");
    expect(latestQuery("waitlist_entries").update).toHaveBeenLastCalledWith({
      status: "scheduled", scheduled_appointment_id: null,
    });
    await setWaitlistStatus("waitlist-1", "open");
    expect(latestQuery("waitlist_entries").update).toHaveBeenLastCalledWith({ status: "open" });
    await deleteWaitlistEntry("waitlist-1");
    expect(latestQuery("waitlist_entries").delete).toHaveBeenCalledOnce();
    respond("waitlist_entries", null, databaseError);
    await expect(deleteWaitlistEntry("waitlist-1")).rejects.toBe(databaseError);
  });

  it("lista profissionais ativos por tenant e opcionalmente inclui unidade global", async () => {
    respond("professionals", [{
      id: "professional-a", display_name: "Ana", color: null, unit_id: null, is_active: true,
    }]);
    await expect(listProfessionalsLite(tenantId, "unit-a")).resolves.toEqual([{
      id: "professional-a", displayName: "Ana", color: null, unitId: null, isActive: true,
    }]);
    expect(latestQuery("professionals").eq).toHaveBeenCalledWith("tenant_id", tenantId);
    expect(latestQuery("professionals").eq).toHaveBeenCalledWith("is_active", true);
    expect(latestQuery("professionals").or).toHaveBeenCalledWith("unit_id.eq.unit-a,unit_id.is.null");
    respond("professionals", null, databaseError);
    await expect(listProfessionalsLite(tenantId)).rejects.toBe(databaseError);
  });

  it("normaliza respostas null como listas vazias em todos os leitores de agenda", async () => {
    respond("unit_business_hours", null);
    await expect(listBusinessHours(tenantId, "unit-a")).resolves.toEqual([]);
    respond("professional_availability", null);
    await expect(listProfessionalAvailability(tenantId)).resolves.toEqual([]);
    respond("time_off_blocks", null);
    await expect(listTimeOff(tenantId, rangeStart, rangeEnd)).resolves.toEqual([]);
    respond("recurring_blocks", null);
    await expect(listRecurringBlocks(tenantId)).resolves.toEqual([]);
    respond("appointments", null);
    await expect(listAppointments({ tenantId, rangeStart, rangeEnd })).resolves.toEqual([]);
    await expect(listAppointmentsHydrated({ tenantId, rangeStart, rangeEnd })).resolves.toEqual([]);
    respond("appointment_items", null);
    await expect(listAppointmentItems("appointment-1")).resolves.toEqual([]);
    await expect(listAppointmentItemsForAppointments(["appointment-1"])).resolves.toEqual([]);
    respond("waitlist_entries", null);
    await expect(listWaitlist(tenantId)).resolves.toEqual([]);
    respond("professionals", null);
    await expect(listProfessionalsLite(tenantId)).resolves.toEqual([]);
    supabaseMock.rpc.mockResolvedValue({ data: null, error: null });
    await expect(getAvailableSlots({
      tenantId, professionalId: "professional-a", unitId: "unit-a", serviceId: "service-a", day: "2026-10-05",
    })).resolves.toEqual([]);
  });

  it("degrada relações ausentes na hidratação da fila sem inventar valores", async () => {
    respond("waitlist_entries", [waitlistRow()]);
    respond("clients", null);
    respond("services", null);
    respond("professionals", null);
    respond("units", null);
    await expect(listWaitlistHydrated(tenantId)).resolves.toEqual([{
      entry: expect.objectContaining({ id: "waitlist-1" }), clientName: null, clientPhone: null,
      serviceName: null, professionalName: null, unitName: null,
    }]);
  });

  const failedOperations: Array<{ name: string; table: string; run: () => Promise<unknown> }> = [
    { name: "listResources", table: "resources", run: () => listResources(tenantId) },
    { name: "createResource", table: "resources", run: () => createResource({ tenantId, name: "Sala" }) },
    { name: "listBusinessHours", table: "unit_business_hours", run: () => listBusinessHours(tenantId, "unit-a") },
    { name: "upsertBusinessHour", table: "unit_business_hours", run: () => upsertBusinessHour({
      tenantId, unitId: "unit-a", weekday: 1, opensAt: "09:00", closesAt: "17:00",
    }) },
    { name: "listProfessionalAvailability", table: "professional_availability", run: () => listProfessionalAvailability(tenantId) },
    { name: "createAvailability", table: "professional_availability", run: () => createAvailability({
      tenantId, professionalId: "professional-a", weekday: 1, startsAt: "09:00", endsAt: "17:00",
    }) },
    { name: "deleteAvailability", table: "professional_availability", run: () => deleteAvailability("availability-1") },
    { name: "listTimeOff", table: "time_off_blocks", run: () => listTimeOff(tenantId, rangeStart, rangeEnd) },
    { name: "createTimeOff", table: "time_off_blocks", run: () => createTimeOff({
      tenantId, scope: "unit", startsAt: rangeStart, endsAt: rangeEnd,
    }) },
    { name: "deleteTimeOff", table: "time_off_blocks", run: () => deleteTimeOff("time-off-1") },
    { name: "listRecurringBlocks", table: "recurring_blocks", run: () => listRecurringBlocks(tenantId) },
    { name: "createRecurringBlock", table: "recurring_blocks", run: () => createRecurringBlock({
      tenantId, weekday: 1, startsAt: "12:00", endsAt: "13:00",
    }) },
    { name: "deleteRecurringBlock", table: "recurring_blocks", run: () => deleteRecurringBlock("block-1") },
    { name: "listAppointments", table: "appointments", run: () => listAppointments({ tenantId, rangeStart, rangeEnd }) },
    { name: "listAppointmentsHydrated", table: "appointments", run: () => listAppointmentsHydrated({ tenantId, rangeStart, rangeEnd }) },
    { name: "getAppointment", table: "appointments", run: () => getAppointment("appointment-1") },
    { name: "updateAppointment", table: "appointments", run: () => updateAppointment("appointment-1", { unitId: "unit-b" }) },
    { name: "setAppointmentStatus", table: "appointments", run: () => setAppointmentStatus("appointment-1", "pending") },
    { name: "listAppointmentItems", table: "appointment_items", run: () => listAppointmentItems("appointment-1") },
    { name: "listAppointmentItemsForAppointments", table: "appointment_items", run: () => listAppointmentItemsForAppointments(["appointment-1"]) },
    { name: "listWaitlist", table: "waitlist_entries", run: () => listWaitlist(tenantId) },
    { name: "createWaitlistEntry", table: "waitlist_entries", run: () => createWaitlistEntry({ tenantId, clientId: "client-a" }) },
    { name: "updateWaitlistEntry", table: "waitlist_entries", run: () => updateWaitlistEntry("waitlist-1", { priority: 20 }) },
    { name: "setWaitlistStatus", table: "waitlist_entries", run: () => setWaitlistStatus("waitlist-1", "open") },
    { name: "deleteWaitlistEntry", table: "waitlist_entries", run: () => deleteWaitlistEntry("waitlist-1") },
    { name: "listProfessionalsLite", table: "professionals", run: () => listProfessionalsLite(tenantId) },
  ];

  it.each(failedOperations)("propaga erro do Supabase em $name", async ({ table, run }) => {
    respond(table, null, databaseError);
    await expect(run()).rejects.toBe(databaseError);
  });
});
