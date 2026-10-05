import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueAction, readQueue } from "@/lib/offline-agenda";
import { setAppointmentStatus } from "@/repositories/scheduling";
import { useOfflineAgenda } from "./useOfflineAgenda";

vi.mock("@/repositories/scheduling", () => ({
  setAppointmentStatus: vi.fn(),
  updateAppointment: vi.fn(),
}));

describe("useOfflineAgenda", () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "onLine", { value: true, configurable: true, writable: true });
  });

  it("não envia fila sem tenant resolvido nem expõe ações de outros tenants", async () => {
    enqueueAction({ tenantId: "tenant-a", appointmentId: "appointment-a", type: "status", status: "confirmed", label: "A" });
    enqueueAction({ tenantId: "tenant-b", appointmentId: "appointment-b", type: "status", status: "confirmed", label: "B" });

    const { result } = renderHook(() => useOfflineAgenda(null));

    await act(async () => Promise.resolve());
    expect(setAppointmentStatus).not.toHaveBeenCalled();
    expect(result.current.pending).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(readQueue()).toHaveLength(2);
  });

  it("serializa o evento de reconexão, o retry manual e a sincronização ao montar", async () => {
    let finishRequest: (() => void) | undefined;
    vi.mocked(setAppointmentStatus).mockImplementation(
      () => new Promise<void>((resolve) => { finishRequest = resolve; }),
    );
    enqueueAction({ tenantId: "tenant-a", appointmentId: "appointment-a", type: "status", status: "confirmed", label: "Confirmar" });

    const { result } = renderHook(() => useOfflineAgenda("tenant-a"));
    await waitFor(() => expect(setAppointmentStatus).toHaveBeenCalledTimes(1));

    let overlappingRetry = -1;
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      overlappingRetry = await result.current.syncNow();
    });
    expect(overlappingRetry).toBe(0);
    expect(setAppointmentStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      finishRequest?.();
      await Promise.resolve();
    });
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(setAppointmentStatus).toHaveBeenCalledTimes(1);
    expect(readQueue()).toEqual([]);
  });

  it("deduplica a mesma fila quando duas instâncias sincronizam o mesmo tenant", async () => {
    let finishRequest: (() => void) | undefined;
    vi.mocked(setAppointmentStatus).mockImplementation(
      () => new Promise<void>((resolve) => { finishRequest = resolve; }),
    );
    enqueueAction({ tenantId: "tenant-a", appointmentId: "appointment-a", type: "status", status: "confirmed", label: "Confirmar" });

    const { result } = renderHook(() => ({
      first: useOfflineAgenda("tenant-a"),
      second: useOfflineAgenda("tenant-a"),
    }));
    await waitFor(() => expect(setAppointmentStatus).toHaveBeenCalledTimes(1));

    await act(async () => {
      finishRequest?.();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.first.pendingCount).toBe(0);
      expect(result.current.second.pendingCount).toBe(0);
    });
    await act(async () => Promise.resolve());

    expect(setAppointmentStatus).toHaveBeenCalledTimes(1);
    expect(readQueue()).toEqual([]);
  });

  it("tenta novamente se a conexão voltar enquanto a tentativa atual está falhando", async () => {
    let failRequest: ((error: Error) => void) | undefined;
    vi.mocked(setAppointmentStatus)
      .mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { failRequest = reject; }))
      .mockResolvedValueOnce(undefined);
    enqueueAction({ tenantId: "tenant-a", appointmentId: "appointment-a", type: "status", status: "confirmed", label: "Confirmar" });

    const { result } = renderHook(() => useOfflineAgenda("tenant-a"));
    await waitFor(() => expect(setAppointmentStatus).toHaveBeenCalledTimes(1));

    act(() => {
      Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
      window.dispatchEvent(new Event("offline"));
      Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
      window.dispatchEvent(new Event("online"));
    });
    expect(setAppointmentStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      failRequest?.(new Error("Network Error"));
      await Promise.resolve();
    });
    await waitFor(() => expect(setAppointmentStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.pendingCount).toBe(0));
    expect(readQueue()).toEqual([]);
  });

  it("mantém a ordem e todas as ações após falha transitória, e permite retry completo", async () => {
    vi.mocked(setAppointmentStatus)
      .mockRejectedValueOnce(new Error("HTTP 503"))
      .mockResolvedValue(undefined);
    enqueueAction({ tenantId: "tenant-a", appointmentId: "appointment-a", type: "status", status: "confirmed", label: "Confirmar A" });
    enqueueAction({ tenantId: "tenant-a", appointmentId: "appointment-b", type: "status", status: "canceled", label: "Cancelar B" });

    const { result } = renderHook(() => useOfflineAgenda("tenant-a"));
    await waitFor(() => expect(result.current.lastSyncError).toBe("HTTP 503"));
    expect(readQueue().map((action) => action.appointmentId)).toEqual(["appointment-a", "appointment-b"]);
    expect(setAppointmentStatus).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.syncNow();
    });
    expect(setAppointmentStatus).toHaveBeenNthCalledWith(2, "appointment-a", "confirmed", undefined);
    expect(setAppointmentStatus).toHaveBeenNthCalledWith(3, "appointment-b", "canceled", undefined);
    expect(readQueue()).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.lastSyncError).toBeNull();
  });
});
