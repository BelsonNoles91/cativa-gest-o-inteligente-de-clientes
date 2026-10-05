import { useCallback, useEffect, useRef, useState } from "react";
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

// A mesma rota pode montar mais de uma instância do hook durante uma troca de
// sessão/restauração PWA. O lock por hook não protege esse caso: ambos poderiam
// ler a mesma fila antes de qualquer um removê-la. Serializa por tenant dentro
// do documento e agenda nova leitura somente se uma instância concorrente pediu
// retry enquanto a primeira ainda estava sincronizando.
const activeTenantSyncs = new Set<string>();
const retryRequestedTenantSyncs = new Set<string>();

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
  const syncingRef = useRef(false);
  const retryAfterSyncRef = useRef(false);

  const refreshPending = useCallback(() => {
    setPending(readQueue());
  }, []);

  const syncNow = useCallback(async () => {
    // Sem tenant resolvido, não se pode inferir que ações de outros tenants
    // pertencem ao contexto atual. Também evita duas chamadas concorrentes
    // vindas do evento `online`, montagem e botão manual.
    if (!tenantId || !isOnline() || syncingRef.current) return 0;
    if (activeTenantSyncs.has(tenantId)) {
      retryRequestedTenantSyncs.add(tenantId);
      return 0;
    }
    const queue = readQueue().filter((action) => action.tenantId === tenantId);
    if (queue.length === 0) return 0;

    syncingRef.current = true;
    activeTenantSyncs.add(tenantId);
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
      syncingRef.current = false;
      activeTenantSyncs.delete(tenantId);
      setSyncing(false);
      refreshPending();
      const retryRequested = retryAfterSyncRef.current || retryRequestedTenantSyncs.delete(tenantId);
      retryAfterSyncRef.current = false;
      if (retryRequested) {
        if (isOnline()) queueMicrotask(() => { void syncNow(); });
      }
    }
    if (synced > 0) onSynced?.();
    return synced;
  }, [onSynced, refreshPending, tenantId]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      if (syncingRef.current) {
        // Se houve nova conexão durante uma tentativa que ainda pode falhar,
        // refaz a leitura da fila assim que a tentativa atual terminar.
        retryAfterSyncRef.current = true;
        return;
      }
      void syncNow();
    }
    function handleOffline() {
      setOnline(false);
    }
    function handleOfflineStatus() {
      setOnline(isOnline());
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(QUEUE_CHANGED_EVENT, refreshPending);
    // Evita manter estado online se a rede caiu enquanto a página recarregava
    // e antes deste efeito registrar os listeners.
    handleOfflineStatus();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(QUEUE_CHANGED_EVENT, refreshPending);
    };
  }, [refreshPending, syncNow]);

  // Ao montar já tenta esvaziar a fila (ex.: recepção reabriu o app com internet).
  useEffect(() => {
    if (tenantId && isOnline() && queueSize(tenantId) > 0) {
      void syncNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const tenantPending = tenantId ? pending.filter((action) => action.tenantId === tenantId) : [];

  return {
    online,
    pending: tenantPending,
    pendingCount: tenantPending.length,
    syncing,
    lastSyncError,
    syncNow,
    refreshPending,
  };
}
