import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { listMyAppointments } from "../portal";

type Result = { data: unknown; error: unknown | null };

function makeQuery(result: Result) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "lt", "not", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query as Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
  };
}

const appointmentRow = {
  id: "appointment-a",
  tenant_id: "tenant-a",
  unit_id: "unit-a",
  client_id: "client-a",
  professional_id: "professional-a",
  resource_id: null,
  cancellation_policy_id: "policy-a",
  status: "confirmed",
  source: "portal",
  starts_at: "2026-10-04T10:00:00.000Z",
  ends_at: "2026-10-04T11:00:00.000Z",
  duration_minutes: 60,
  client_reschedule_count: null,
  buffer_before_minutes: null,
  buffer_after_minutes: null,
  is_walk_in: false,
  is_overbooked: false,
  total_price_cents: 12900,
  notes: "Observação visível ao cliente",
  internal_notes: "NOTA PRIVADA DA EQUIPE",
  confirmed_at: null,
  reminded_at: null,
  arrived_at: null,
  started_at: null,
  completed_at: null,
  canceled_at: null,
  no_show_at: null,
  canceled_reason: null,
  created_at: "2026-10-03T08:00:00.000Z",
  updated_at: "2026-10-03T08:00:00.000Z",
};

describe("portal repository — leitura segura de atendimentos", () => {
  beforeEach(() => vi.clearAllMocks());

  it("filtra tenant/cliente, hidrata apresentação e remove notas internas", async () => {
    const queries = new Map([
      ["appointments", makeQuery({ data: [appointmentRow], error: null })],
      ["appointment_items", makeQuery({ data: [{ appointment_id: "appointment-a", service_id: "service-a", position: 0 }], error: null })],
      ["professionals", makeQuery({ data: [{ id: "professional-a", display_name: "Dra. QA" }], error: null })],
      ["units", makeQuery({ data: [{ id: "unit-a", name: "Unidade Central" }], error: null })],
      ["cancellation_policies", makeQuery({ data: [{ id: "policy-a", name: "Com antecedência", description: "Sem taxa até 24 horas", hours_before_no_charge: 24, late_cancel_fee_pct: 50, no_show_fee_pct: 100 }], error: null })],
      ["services", makeQuery({ data: [{ id: "service-a", name: "Consulta inicial" }], error: null })],
    ]);
    supabaseMock.from.mockImplementation((table: string) => {
      const query = queries.get(table);
      if (!query) throw new Error(`Consulta inesperada: ${table}`);
      return query;
    });

    const appointments = await listMyAppointments({
      tenantId: "tenant-a",
      clientId: "client-a",
      rangeStart: "2026-10-01T00:00:00.000Z",
      rangeEnd: "2026-11-01T00:00:00.000Z",
      excludeStatuses: ["canceled", "no_show"],
    });

    expect(appointments).toHaveLength(1);
    expect(appointments[0]).toMatchObject({
      serviceName: "Consulta inicial",
      professionalName: "Dra. QA",
      unitName: "Unidade Central",
      policy: { name: "Com antecedência", hoursBeforeNoCharge: 24 },
      appointment: {
        tenantId: "tenant-a",
        clientId: "client-a",
        internalNotes: null,
        notes: "Observação visível ao cliente",
      },
    });
    expect(JSON.stringify(appointments)).not.toContain("NOTA PRIVADA DA EQUIPE");

    const appointmentsQuery = queries.get("appointments")!;
    expect(supabaseMock.from).toHaveBeenCalledWith("appointments");
    expect(appointmentsQuery.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(appointmentsQuery.eq).toHaveBeenCalledWith("client_id", "client-a");
    expect(appointmentsQuery.gte).toHaveBeenCalledWith("starts_at", "2026-10-01T00:00:00.000Z");
    expect(appointmentsQuery.lt).toHaveBeenCalledWith("starts_at", "2026-11-01T00:00:00.000Z");
    expect(appointmentsQuery.not).toHaveBeenCalledWith("status", "in", "(canceled,no_show)");
  });

  it("não consulta dados auxiliares quando o cliente não tem atendimentos", async () => {
    const appointmentsQuery = makeQuery({ data: [], error: null });
    supabaseMock.from.mockReturnValue(appointmentsQuery);

    await expect(listMyAppointments({ tenantId: "tenant-a", clientId: "client-a" })).resolves.toEqual([]);

    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(supabaseMock.from).toHaveBeenCalledWith("appointments");
  });

  it("preserva erro de autorização/leitura e não hidrata dados depois da falha", async () => {
    const databaseError = { code: "42501", message: "row-level security denied" };
    supabaseMock.from.mockReturnValue(makeQuery({ data: null, error: databaseError }));

    await expect(listMyAppointments({ tenantId: "tenant-a", clientId: "client-a" })).rejects.toBe(databaseError);
    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
  });
});
