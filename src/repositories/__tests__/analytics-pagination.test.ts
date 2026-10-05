import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  from: vi.fn(),
  ranges: [] as Array<{ table: string; from: number; to: number }>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { fetchAppointments, fetchClients } from "@/repositories/analytics";

type FixtureRow = Record<string, unknown>;

function makeQuery(table: string, fixtures: Record<string, FixtureRow[]>, ranges: Array<{ table: string; from: number; to: number }>) {
  const state: {
    filters: Map<string, unknown>;
    inFilters: Map<string, unknown[]>;
    gteFilters: Map<string, unknown>;
    ltFilters: Map<string, unknown>;
    from: number;
    to: number;
  } = { filters: new Map(), inFilters: new Map(), gteFilters: new Map(), ltFilters: new Map(), from: 0, to: 499 };

  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((key: string, value: unknown) => {
      state.filters.set(key, value);
      return query;
    }),
    in: vi.fn((key: string, values: unknown[]) => {
      state.inFilters.set(key, values);
      return query;
    }),
    gte: vi.fn((key: string, value: unknown) => {
      state.gteFilters.set(key, value);
      return query;
    }),
    lt: vi.fn((key: string, value: unknown) => {
      state.ltFilters.set(key, value);
      return query;
    }),
    order: vi.fn(() => query),
    range: vi.fn((from: number, to: number) => {
      state.from = from;
      state.to = to;
      ranges.push({ table, from, to });
      return query;
    }),
    then: (resolve: (value: { data: FixtureRow[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) => {
      const filtered = (fixtures[table] ?? []).filter((row) => {
        for (const [key, value] of state.filters) {
          if (row[key] !== value) return false;
        }
        for (const [key, values] of state.inFilters) {
          if (!values.includes(row[key])) return false;
        }
        for (const [key, value] of state.gteFilters) {
          if (String(row[key]) < String(value)) return false;
        }
        for (const [key, value] of state.ltFilters) {
          if (String(row[key]) >= String(value)) return false;
        }
        return true;
      });
      return Promise.resolve({ data: filtered.slice(state.from, state.to + 1), error: null }).then(resolve, reject);
    },
  };
  return query;
}

describe("analytics repository pagination under large tenants", () => {
  beforeEach(() => {
    const clients = Array.from({ length: 1_001 }, (_, index) => ({
      id: `client-${String(index).padStart(4, "0")}`,
      tenant_id: "tenant-a",
      created_at: `2025-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
      is_vip: false,
      full_name: `Cliente ${index}`,
      email: null,
      phone: null,
      last_visit_at: null,
    }));
    const appointments: FixtureRow[] = [];
    const appointmentItems: FixtureRow[] = [];
    for (let index = 0; index < 1_001; index += 1) {
      const count = index === 0 ? 600 : 1;
      for (let visit = 0; visit < count; visit += 1) {
        const month = (visit % 12) + 1;
        const year = 1900 + Math.floor(visit / 12);
        appointments.push({
          id: `appointment-${index}-${visit}`,
          tenant_id: "tenant-a",
          client_id: `client-${String(index).padStart(4, "0")}`,
          starts_at: `${year}-${String(month).padStart(2, "0")}-10T10:00:00.000Z`,
          status: "completed",
        });
      }
    }
    appointments.push({
      id: "foreign-tenant-appointment",
      tenant_id: "tenant-b",
      client_id: "client-0000",
      starts_at: "2025-12-01T10:00:00.000Z",
      status: "completed",
    });

    for (let index = 0; index < 1_001; index += 1) {
      const id = `large-appointment-${String(index).padStart(4, "0")}`;
      const day = String((index % 28) + 1).padStart(2, "0");
      appointments.push({
        id,
        tenant_id: "tenant-a",
        unit_id: "unit-a",
        professional_id: "pro-a",
        client_id: "large-client",
        starts_at: `2025-01-${day}T10:00:00.000Z`,
        ends_at: `2025-01-${day}T11:00:00.000Z`,
        duration_minutes: 60,
        status: "completed",
        source: "frontdesk",
        total_price_cents: 10_000,
        is_overbooked: false,
        confirmed_at: null,
        reminded_at: null,
        no_show_at: null,
        canceled_at: null,
        completed_at: null,
        created_at: "2025-01-01T00:00:00.000Z",
      });
      appointmentItems.push({
        id: `item-${index}`,
        appointment_id: id,
        service_id: `service-${index}`,
        position: 0,
      });
    }

    const fixtures = { clients, appointments, appointment_items: appointmentItems };
    const ranges: Array<{ table: string; from: number; to: number }> = [];
    supabaseMock.from.mockImplementation((table: string) => makeQuery(table, fixtures, ranges));
    supabaseMock.ranges = ranges;
  });

  it("carrega clientes e históricos além de 1.000 linhas sem perder escopo nem visitas", async () => {
    const clients = await fetchClients("tenant-a");
    const first = clients[0];
    const last = clients.at(-1);

    expect(clients).toHaveLength(1_001);
    expect(first).toMatchObject({
      id: "client-0000",
      completedVisits: 600,
      firstVisitAt: "1900-01-10T10:00:00.000Z",
      lastVisitAt: "1949-12-10T10:00:00.000Z",
    });
    expect(last).toMatchObject({ id: "client-1000", completedVisits: 1 });

    const ranges = supabaseMock.ranges;
    expect(ranges.filter((range) => range.table === "clients")).toEqual([
      { table: "clients", from: 0, to: 499 },
      { table: "clients", from: 500, to: 999 },
      { table: "clients", from: 1_000, to: 1_499 },
    ]);
    expect(ranges.filter((range) => range.table === "appointments")).toContainEqual(
      { table: "appointments", from: 500, to: 999 },
    );
  });

  it("pagina agenda acima de 1.000 e hidrata serviços em lotes limitados", async () => {
    const appointments = await fetchAppointments({
      tenantId: "tenant-a",
      start: "2025-01-01T00:00:00.000Z",
      end: "2025-02-01T00:00:00.000Z",
    });

    expect(appointments).toHaveLength(1_001);
    expect(appointments[0]).toMatchObject({ id: "large-appointment-0000", serviceId: "service-0" });
    expect(appointments.at(-1)).toMatchObject({ id: "large-appointment-1000", serviceId: "service-1000" });

    const ranges = supabaseMock.ranges;
    expect(ranges.filter((range) => range.table === "appointments")).toEqual([
      { table: "appointments", from: 0, to: 499 },
      { table: "appointments", from: 500, to: 999 },
      { table: "appointments", from: 1_000, to: 1_499 },
    ]);
    const itemRanges = ranges.filter((range) => range.table === "appointment_items");
    expect(itemRanges).toHaveLength(4);
    expect(itemRanges.every(({ from, to }) => from === 0 && to === 499)).toBe(true);
  });
});
