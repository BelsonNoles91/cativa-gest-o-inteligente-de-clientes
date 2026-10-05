import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { bumpQueueAttempt, listQueue, updateQueueStatus } from "../confirmation";

type Result = { data: unknown; error: unknown | null; count?: number | null };

function makeQuery(result: Result) {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "eq", "not", "order", "range", "update"]) {
    query[method] = vi.fn(() => query);
  }
  query.single = vi.fn(async () => result);
  query.then = (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return query as Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: Result) => unknown, reject?: (reason: unknown) => unknown) => Promise<unknown>;
  };
}

const queueRow = {
  id: "queue-a",
  tenant_id: "tenant-a",
  appointment_id: "appointment-a",
  client_id: "client-a",
  rule_id: null,
  stage: "tomorrow",
  status: "pending",
  priority: 70,
  scheduled_for: "2026-10-03T09:00:00.000Z",
  appointment_starts_at: "2026-10-04T10:00:00.000Z",
  assigned_to: null,
  last_attempt_at: null,
  attempts_count: 1,
  follow_up_at: null,
  closed_at: null,
  notes: null,
  created_at: "2026-10-03T08:00:00.000Z",
  updated_at: "2026-10-03T08:00:00.000Z",
};

describe("confirmation repository — fila", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pagina, filtra e escopa a fila pelo tenant, reportando total e hasMore", async () => {
    const query = makeQuery({ data: [queueRow], error: null, count: 60 });
    supabaseMock.from.mockReturnValue(query);

    const page = await listQueue({
      tenantId: "tenant-a",
      stage: "tomorrow",
      status: "pending",
      excludeClosed: true,
      offset: 50,
      limit: 25,
    });

    expect(page).toMatchObject({
      total: 60,
      hasMore: true,
      items: [{ id: "queue-a", tenantId: "tenant-a", attemptsCount: 1 }],
    });
    expect(supabaseMock.from).toHaveBeenCalledWith("confirmation_queue");
    expect(query.eq).toHaveBeenCalledWith("tenant_id", "tenant-a");
    expect(query.eq).toHaveBeenCalledWith("stage", "tomorrow");
    expect(query.eq).toHaveBeenCalledWith("status", "pending");
    expect(query.not).toHaveBeenCalledWith("status", "in", "(closed,confirmed,canceled)");
    expect(query.range).toHaveBeenCalledWith(50, 74);
  });

  it("propaga falha da fila e não converte erro em resultado vazio", async () => {
    const databaseError = { code: "PGRST301", message: "JWT expired" };
    supabaseMock.from.mockReturnValue(makeQuery({ data: null, error: databaseError }));

    await expect(listQueue({ tenantId: "tenant-a" })).rejects.toBe(databaseError);
  });

  it("marca fechamento em status terminal e persiste notas e follow-up opcionais", async () => {
    const query = makeQuery({ data: null, error: null });
    supabaseMock.from.mockReturnValue(query);

    await updateQueueStatus("queue-a", "confirmed", {
      notes: "Confirmado por telefone",
      followUpAt: null,
    });

    const patch = query.update.mock.calls[0][0];
    expect(patch).toMatchObject({
      status: "confirmed",
      notes: "Confirmado por telefone",
      follow_up_at: null,
    });
    expect(patch.closed_at).toEqual(expect.any(String));
    expect(query.eq).toHaveBeenCalledWith("id", "queue-a");
  });

  it("incrementa tentativa e interrompe sem mutação quando a leitura falha", async () => {
    const databaseError = { code: "42501", message: "permission denied" };
    const readQuery = makeQuery({ data: null, error: databaseError });
    supabaseMock.from.mockReturnValue(readQuery);

    await expect(bumpQueueAttempt("queue-a")).rejects.toBe(databaseError);

    expect(supabaseMock.from).toHaveBeenCalledTimes(1);
    expect(readQuery.update).not.toHaveBeenCalled();
  });
});
