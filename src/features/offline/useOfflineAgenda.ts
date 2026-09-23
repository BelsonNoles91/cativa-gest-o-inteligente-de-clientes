import { useCallback, useEffect, useState } from "react";
import {
  QUEUE_CHANGED_EVENT,
  isOnline,
  queueSize,
  readQueue,
  removeAction,
  type PendingAction,
} from "@/lib/offline-agenda";
import { setAppointmentStatus, updateAppointment } from "@/repositories/scheduling";
import type { AppointmentStatus } from "@/domain/scheduling";

export interface OfflineAgendaState {
  online: boolean;
  pending: PendingAction[];
  pendingCount: number;
  syncing: boolean;
  lastSyncError: string | null;
  /** Tenta enviar tudo o que está na fila. Devolve quantas ações foram sincronizadas. */
  syncNow: () => Promise<number>;
  refreshPending: () => void;
}

async function applyAction(action: PendingAction): Promise<void> {
  if (action.type === "status") {
    await setAppointmentStatus(
      action.appointmentId,
      action.status as AppointmentStatus,
      action.reason ? { reason: action.reason } : undefined,
    );
    return;
  }
  await updateAppointment(action.appointmentId, {
    ...(action.notes !== undefined ? { notes: action.notes } : {}),
    ...(action.internalNotes !== undefined ? { internalNotes: action.internalNotes } : {}),
  });
}

/**
 * Observa a conexão, mantém a lista de ações pendentes e as sincroniza
 * automaticamente assim que a internet volta.
 */
export function useOfflineAgenda(tenantId: string | null | undefined, onSynced?: () => void): OfflineAgendaState {
  const [online, setOnline] = useState<boolean>(() => isOnline());
  const [pending, setPending] = useState<PendingAction[]>(() => readQueue());
  const [syncing, setSyncing] = useState(false);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const refreshPending = useCallback(() => {
    setPending(readQueue());
  }, []);

  const syncNow = useCallback(async () => {
    if (!isOnline()) return 0;
    const queue = readQueue().filter((action) => !tenantId || action.tenantId === tenantId);
    if (queue.length === 0) return 0;

    setSyncing(true);
    setLastSyncError(null);
    let synced = 0;
    try {
      for (const action of queue) {
        try {
          await applyAction(action);
          removeAction(action.id);
          synced += 1;
        } catch (error) {
          setLastSyncError(error instanceof Error ? error.message : "Erro inesperado ao sincronizar.");
          break;
        }
      }
    } finally {
      setSyncing(false);
      refreshPending();
    }
    if (synced > 0) onSynced?.();
    return synced;
  }, [onSynced, refreshPending, tenantId]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      void syncNow();
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, refreshPending);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, refreshPending);
    };
  }, [refreshPending, syncNow]);

  // Ao montar já tenta esvaziar a fila (ex.: recepção reabriu o app com internet).
  useEffect(() => {
    if (isOnline() && queueSize(tenantId ?? undefined) > 0) {
      void syncNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  return {
    online,
    pending,
    pendingCount: pending.filter((action) => !tenantId || action.tenantId === tenantId).length,
    syncing,
    lastSyncError,
    syncNow,
    refreshPending,
  };
}
