import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { generateQueueForTenant } from "./queueGenerator";

type QueryResult = { data: any; error: { message: string } | null };

function makeQuery(result: QueryResult) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lte", "not", "in", "insert", "order"]) {
    query[method] = vi.fn(() => query);
  }
  query.then = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query as Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
  };
}

const now = new Date("2026-10-04T12:00:00.000Z");
const appointment = {
  id: "appointment-a",
  client_id: "client-a",
  unit_id: "unit-a",
  starts_at: "2026-10-05T00:00:00.000Z",
  status: "pending",
  total_price_cents: 12_000,
  confirmed_at: null,
};
const client = { id: "client-a", is_vip: false, risk_level: "low" };
const rule = {
  id: "rule-a",
  stage: "today",
  hours_before_appointment: 3,
  base_priority: 60,
  applies_to_vip: false,
  applies_to_protocol: false,
  applies_to_high_risk: false,
  min_appointment_value_cents: null,
  skip_if_already_confirmed: true,
  is_active: true,
  unit_id: null,
};

function configureDatabase(input?: {
  rules?: unknown[];
  appointments?: unknown[];
  clients?: unknown[];
  existing?: unknown[];
  appointmentItems?: unknown[];
  protocolSessions?: unknown[];
  appointmentItemsError?: { message: string } | null;
  protocolSessionsError?: { message: string } | null;
  queueInsertError?: { message: string } | null;
  priorityError?: { message: string } | null;
  reactivationError?: { message: string } | null;
}) {
  const queries: Array<{ table: string; query: ReturnType<typeof makeQuery> }> = [];
  const responses: Record<string, QueryResult[]> = {
    confirmation_rules: [{ data: input?.rules ?? [], error: null }],
    appointments: [{ data: input?.appointments ?? [appointment], error: null }],
    clients: [{ data: input?.clients ?? [client], error: null }],
    appointment_items: [{ data: input?.appointmentItems ?? [], error: input?.appointmentItemsError ?? null }],
    protocol_sessions: [{ data: input?.protocolSessions ?? [], error: input?.protocolSessionsError ?? null }],
    confirmation_queue: [
      { data: input?.existing ?? [], error: null },
      { data: [], error: input?.queueInsertError ?? null },
    ],
  };
  supabaseMock.from.mockImplementation((table: string) => {
    const result = responses[table]?.shift() ?? { data: [], error: null };
    const query = makeQuery(result);
    queries.push({ table, query });
    return query;
  });
  supabaseMock.rpc.mockImplementation((name: string) => {
    if (name === "calculate_queue_priority") {
      return Promise.resolve(input?.priorityError
        ? { data: null, error: input.priorityError }
        : { data: 77, error: null });
    }
    return Promise.resolve({ data: 0, error: input?.reactivationError ?? null });
  });
  return queries;
}

describe("generateQueueForTenant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => vi.useRealTimers());

  it("creates a default queue item immediately when the stage has no custom rule", async () => {
    const queries = configureDatabase();

    await expect(generateQueueForTenant("tenant-a")).resolves.toEqual({
      created: 1,
      skipped: 0,
      total: 1,
    });

    const insert = queries.find(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    );
    expect(insert?.query.insert).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: "tenant-a",
      appointment_id: "appointment-a",
      stage: "today",
      rule_id: null,
      priority: 77,
      scheduled_for: now.toISOString(),
    }));
  });

  it("deduplicates an already-open appointment stage", async () => {
    const queries = configureDatabase({
      existing: [{ appointment_id: appointment.id, stage: "today", status: "pending" }],
    });

    await expect(generateQueueForTenant("tenant-a")).resolves.toEqual({
      created: 0,
      skipped: 1,
      total: 1,
    });
    expect(queries.filter(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    )).toHaveLength(0);
  });

  it("applies selected VIP, high-risk and minimum-value filters as AND criteria", async () => {
    const queries = configureDatabase({
      rules: [{
        ...rule,
        applies_to_vip: true,
        applies_to_high_risk: true,
        min_appointment_value_cents: 12_001,
      }],
    });

    await expect(generateQueueForTenant("tenant-a")).resolves.toEqual({
      created: 0,
      skipped: 1,
      total: 1,
    });
    expect(queries.filter(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    )).toHaveLength(0);
  });

  it("uses protocol-session service links and schedules the task by configured lead time", async () => {
    const queries = configureDatabase({
      rules: [{ ...rule, applies_to_protocol: true }],
      appointmentItems: [{ appointment_id: appointment.id, service_id: "service-protocol" }],
      protocolSessions: [{ service_id: "service-protocol" }],
    });

    await expect(generateQueueForTenant("tenant-a")).resolves.toMatchObject({ created: 1, skipped: 0 });

    const insert = queries.find(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    );
    expect(insert?.query.insert).toHaveBeenCalledWith(expect.objectContaining({
      rule_id: "rule-a",
      scheduled_for: "2026-10-04T21:00:00.000Z",
    }));
    expect(supabaseMock.from).toHaveBeenCalledWith("appointment_items");
    expect(supabaseMock.from).toHaveBeenCalledWith("protocol_sessions");
  });

  it("prefers a unit-specific rule over the tenant-wide rule", async () => {
    const queries = configureDatabase({
      rules: [
        { ...rule, id: "rule-general", base_priority: 35, hours_before_appointment: 2 },
        { ...rule, id: "rule-unit", unit_id: "unit-a", base_priority: 65, hours_before_appointment: 4 },
      ],
    });

    await generateQueueForTenant("tenant-a");

    const insert = queries.find(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    );
    expect(insert?.query.insert).toHaveBeenCalledWith(expect.objectContaining({
      rule_id: "rule-unit",
      scheduled_for: "2026-10-04T20:00:00.000Z",
      priority: 77,
    }));
  });

  it("does not schedule non-protocol appointments for a protocol-only rule", async () => {
    const queries = configureDatabase({
      rules: [{ ...rule, applies_to_protocol: true }],
      appointmentItems: [{ appointment_id: appointment.id, service_id: "ordinary-service" }],
      protocolSessions: [{ service_id: "protocol-service" }],
    });

    await expect(generateQueueForTenant("tenant-a")).resolves.toEqual({
      created: 0,
      skipped: 1,
      total: 1,
    });
    expect(queries.filter(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    )).toHaveLength(0);
  });

  it("does not re-contact confirmed appointments, including without a custom rule", async () => {
    const queries = configureDatabase({
      appointments: [{ ...appointment, status: "confirmed", confirmed_at: null }],
      rules: [],
    });

    await expect(generateQueueForTenant("tenant-a")).resolves.toEqual({
      created: 0,
      skipped: 1,
      total: 1,
    });
    expect(queries.filter(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    )).toHaveLength(0);
  });

  it("honors the explicit option to include an already-confirmed appointment", async () => {
    const queries = configureDatabase({
      appointments: [{ ...appointment, status: "confirmed" }],
      rules: [{ ...rule, skip_if_already_confirmed: false }],
    });

    await expect(generateQueueForTenant("tenant-a")).resolves.toMatchObject({ created: 1, skipped: 0 });
    const insert = queries.find(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    );
    expect(insert?.query.insert).toHaveBeenCalledWith(expect.objectContaining({ rule_id: "rule-a" }));
  });

  it("uses the configured base priority if priority calculation fails", async () => {
    const queries = configureDatabase({
      rules: [{ ...rule, base_priority: 42 }],
      priorityError: { message: "RPC unavailable" },
    });

    await generateQueueForTenant("tenant-a");

    const insert = queries.find(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    );
    expect(insert?.query.insert).toHaveBeenCalledWith(expect.objectContaining({ priority: 42 }));
  });

  it("counts a queue insert conflict as skipped without claiming creation", async () => {
    configureDatabase({ queueInsertError: { message: "duplicate queue item" } });

    await expect(generateQueueForTenant("tenant-a")).resolves.toEqual({
      created: 0,
      skipped: 1,
      total: 1,
    });
  });

  it("aborts queue writes when protocol eligibility cannot be determined", async () => {
    const queries = configureDatabase({
      rules: [{ ...rule, applies_to_protocol: true }],
      appointmentItemsError: { message: "appointment items unavailable" },
    });

    await expect(generateQueueForTenant("tenant-a")).rejects.toThrow("appointment items unavailable");
    expect(queries.filter(({ table, query }) =>
      table === "confirmation_queue" && query.insert.mock.calls.length > 0,
    )).toHaveLength(0);
  });

  it("runs recovery generation even when the tenant has no upcoming appointments", async () => {
    configureDatabase({ appointments: [], rules: [] });

    await expect(generateQueueForTenant("tenant-a")).resolves.toEqual({
      created: 0,
      skipped: 0,
      total: 0,
    });
    expect(supabaseMock.rpc).toHaveBeenCalledWith("generate_reactivation_tasks", {
      _tenant_id: "tenant-a",
    });
  });

  it("reports recovery RPC errors instead of falsely claiming a full sync", async () => {
    configureDatabase({ appointments: [], reactivationError: { message: "quota exceeded" } });

    await expect(generateQueueForTenant("tenant-a")).resolves.toEqual({
      created: 0,
      skipped: 0,
      total: 0,
      warning: "Falha ao sincronizar tarefas de recuperação: quota exceeded",
    });
  });

  it("fails before queue writes when a rule contains a negative lead time", async () => {
    const queries = configureDatabase({ rules: [{ ...rule, hours_before_appointment: -2 }] });

    await expect(generateQueueForTenant("tenant-a")).rejects.toThrow("antecedência inválida");
    expect(queries.some(({ table }) => table === "confirmation_queue")).toBe(false);
  });
});
