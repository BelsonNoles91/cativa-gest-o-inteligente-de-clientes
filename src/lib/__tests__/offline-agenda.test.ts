import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAgendaCache,
  clearQueue,
  enqueueAction,
  pruneExpiredSnapshots,
  queueSize,
  readAgendaSnapshot,
  readQueue,
  removeAction,
  saveAgendaSnapshot,
} from "@/lib/offline-agenda";

const key = {
  tenantId: "t1",
  unitId: "all",
  professionalId: "all",
  rangeStart: "2026-01-01T00:00:00.000Z",
  rangeEnd: "2026-01-02T00:00:00.000Z",
};

describe("offline-agenda", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("guarda e lê o snapshot da agenda", () => {
    saveAgendaSnapshot(key, [{ id: "a1" }]);
    const entry = readAgendaSnapshot<Array<{ id: string }>>(key);
    expect(entry?.data).toEqual([{ id: "a1" }]);
    expect(entry?.syncedAt).toBeTruthy();
  });

  it("isola snapshots por tenant e período", () => {
    saveAgendaSnapshot(key, [{ id: "a1" }]);
    expect(readAgendaSnapshot({ ...key, tenantId: "t2" })).toBeNull();
    expect(readAgendaSnapshot({ ...key, rangeStart: "2026-02-01T00:00:00.000Z" })).toBeNull();
  });

  it("descarta snapshot expirado", () => {
    saveAgendaSnapshot(key, [{ id: "a1" }]);
    const storageKey = Object.keys(localStorage).find((k) => k.includes("agenda-cache"))!;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ syncedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), data: [] }),
    );
    expect(readAgendaSnapshot(key)).toBeNull();
  });

  it("mantém o snapshot imediatamente antes do TTL de sete dias e rejeita após o limite", () => {
    const storageKey = `cativa:agenda-cache:${key.tenantId}:${key.unitId}:${key.professionalId}:${key.rangeStart}:${key.rangeEnd}`;
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem(storageKey, JSON.stringify({
      syncedAt: new Date(Date.now() - sevenDays + 30_000).toISOString(),
      data: [{ id: "a1" }],
    }));
    expect(readAgendaSnapshot(key)).not.toBeNull();

    localStorage.setItem(storageKey, JSON.stringify({
      syncedAt: new Date(Date.now() - sevenDays - 1_000).toISOString(),
      data: [{ id: "a1" }],
    }));
    expect(readAgendaSnapshot(key)).toBeNull();
  });

  it("recusa e limpa snapshot com data inválida, futura ou payload que não seja lista", () => {
    const storageKey = `cativa:agenda-cache:${key.tenantId}:${key.unitId}:${key.professionalId}:${key.rangeStart}:${key.rangeEnd}`;
    const invalidSnapshots = [
      { syncedAt: "not-a-date", data: [] },
      { syncedAt: new Date(Date.now() + 60_000).toISOString(), data: [] },
      { syncedAt: new Date().toISOString(), data: { id: "not-a-list" } },
    ];

    for (const snapshot of invalidSnapshots) {
      localStorage.setItem(storageKey, JSON.stringify(snapshot));
      expect(readAgendaSnapshot(key)).toBeNull();
      pruneExpiredSnapshots();
      expect(localStorage.getItem(storageKey)).toBeNull();
    }
  });

  it("limpa o cache de um tenant", () => {
    saveAgendaSnapshot(key, [{ id: "a1" }]);
    saveAgendaSnapshot({ ...key, tenantId: "t2" }, [{ id: "b1" }]);
    clearAgendaCache("t1");
    expect(readAgendaSnapshot(key)).toBeNull();
    expect(readAgendaSnapshot({ ...key, tenantId: "t2" })).not.toBeNull();
  });

  it("enfileira ações pendentes", () => {
    enqueueAction({
      tenantId: "t1",
      appointmentId: "ap1",
      type: "status",
      status: "arrived",
      label: "Cliente → Chegou",
    });
    expect(queueSize("t1")).toBe(1);
    expect(queueSize("t2")).toBe(0);
  });

  it("substitui ação do mesmo tipo para o mesmo atendimento", () => {
    enqueueAction({ tenantId: "t1", appointmentId: "ap1", type: "status", status: "arrived", label: "a" });
    enqueueAction({ tenantId: "t1", appointmentId: "ap1", type: "status", status: "completed", label: "b" });
    const queue = readQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].status).toBe("completed");
  });

  it("não substitui ações com o mesmo ID de atendimento em outro tenant", () => {
    enqueueAction({ tenantId: "t1", appointmentId: "shared-id", type: "status", status: "arrived", label: "a" });
    enqueueAction({ tenantId: "t2", appointmentId: "shared-id", type: "status", status: "completed", label: "b" });

    expect(readQueue()).toHaveLength(2);
    expect(queueSize("t1")).toBe(1);
    expect(queueSize("t2")).toBe(1);
  });

  it("ignora registros corrompidos ou com status inválido na fila persistida", () => {
    localStorage.setItem("cativa:agenda-queue", JSON.stringify([
      {
        id: "valid",
        tenantId: "t1",
        appointmentId: "ap1",
        type: "status",
        status: "confirmed",
        createdAt: new Date().toISOString(),
        label: "Confirmar",
      },
      null,
      { id: "invalid-status", tenantId: "t1", appointmentId: "ap2", type: "status", status: "unknown", createdAt: "now", label: "x" },
      { id: "empty-notes", tenantId: "t1", appointmentId: "ap3", type: "notes", createdAt: "now", label: "x" },
    ]));

    expect(readQueue().map((action) => action.id)).toEqual(["valid"]);
    expect(queueSize("t1")).toBe(1);
  });

  it("mantém ações de tipos diferentes no mesmo atendimento", () => {
    enqueueAction({ tenantId: "t1", appointmentId: "ap1", type: "status", status: "arrived", label: "a" });
    enqueueAction({ tenantId: "t1", appointmentId: "ap1", type: "notes", internalNotes: "x", label: "b" });
    expect(readQueue()).toHaveLength(2);
  });

  it("remove uma ação e limpa a fila por tenant", () => {
    const first = enqueueAction({ tenantId: "t1", appointmentId: "ap1", type: "status", status: "arrived", label: "a" });
    enqueueAction({ tenantId: "t2", appointmentId: "ap2", type: "status", status: "arrived", label: "b" });
    removeAction(first.id);
    expect(queueSize()).toBe(1);
    clearQueue("t2");
    expect(queueSize()).toBe(0);
  });

  it("reconcilia uma campanha determinística de mutações da fila com um modelo independente", () => {
    const tenants = ["tenant-a", "tenant-b", "tenant-c"];
    const statuses = [
      "requested", "pending", "confirmed", "reminded", "arrived",
      "in_service", "completed", "canceled", "no_show",
    ] as const;
    const model = new Map<string, ReturnType<typeof enqueueAction>>();
    const modelKey = (action: { tenantId: string; appointmentId: string; type: string }) =>
      JSON.stringify([action.tenantId, action.appointmentId, action.type]);

    for (let step = 0; step < 320; step += 1) {
      const operation = step % 8;
      if (operation < 4) {
        const tenantId = tenants[(step * 7) % tenants.length];
        const appointmentId = `appointment-${(step * 11) % 17}`;
        const entry = operation % 2 === 0
          ? enqueueAction({
              tenantId,
              appointmentId,
              type: "status",
              status: statuses[(step * 5) % statuses.length],
              label: `Status sintético ${step}`,
            })
          : enqueueAction({
              tenantId,
              appointmentId,
              type: "notes",
              internalNotes: `Nota sintética ${step}`,
              label: `Nota ${step}`,
            });

        const key = modelKey(entry);
        model.delete(key);
        model.set(key, entry);
      } else if (operation === 4) {
        const current = [...model.values()];
        if (current.length > 0) {
          const target = current[(step * 3) % current.length];
          removeAction(target.id);
          model.delete(modelKey(target));
        }
      } else if (operation === 5) {
        const tenantId = tenants[(step * 13) % tenants.length];
        clearQueue(tenantId);
        for (const [key, action] of model) {
          if (action.tenantId === tenantId) model.delete(key);
        }
      } else if (operation === 6) {
        const current = JSON.parse(localStorage.getItem("cativa:agenda-queue") ?? "[]") as unknown[];
        localStorage.setItem("cativa:agenda-queue", JSON.stringify([
          ...current,
          null,
          { id: "bad-status", tenantId: "tenant-a", appointmentId: "bad", type: "status", status: "unexpected", createdAt: "now", label: "invalid" },
        ]));
      } else {
        clearQueue();
        model.clear();
      }

      expect(readQueue()).toEqual([...model.values()]);
      expect(queueSize()).toBe(model.size);
      for (const tenantId of tenants) {
        expect(queueSize(tenantId)).toBe(
          [...model.values()].filter((action) => action.tenantId === tenantId).length,
        );
      }
    }
  });
});
