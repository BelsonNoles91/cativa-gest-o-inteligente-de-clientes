import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAgendaCache,
  clearQueue,
  enqueueAction,
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
});
