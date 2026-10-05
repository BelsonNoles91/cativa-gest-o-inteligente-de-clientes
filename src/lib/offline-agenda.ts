import { appointmentStatusLabels } from "@/domain/scheduling";

/**
 * Modo offline da recepção.
 *
 * - Cache: guarda no navegador o último snapshot da agenda carregada (por tenant,
 *   unidade, profissional e período) para consulta quando a conexão cair.
 * - Fila: registra ações feitas offline (mudança de status e observações) e as
 *   sincroniza automaticamente quando a conexão voltar.
 *
 * Tudo fica em localStorage, escopado por tenant. Nenhuma credencial é gravada.
 */

const CACHE_PREFIX = "cativa:agenda-cache:";
const QUEUE_KEY = "cativa:agenda-queue";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const VALID_APPOINTMENT_STATUSES = new Set(Object.keys(appointmentStatusLabels));

export interface AgendaCacheKey {
  tenantId: string;
  unitId: string;
  professionalId: string;
  rangeStart: string;
  rangeEnd: string;
}

export interface AgendaCacheEntry<T> {
  syncedAt: string;
  data: T;
}

export type PendingActionType = "status" | "notes";

export interface PendingAction {
  id: string;
  tenantId: string;
  appointmentId: string;
  type: PendingActionType;
  createdAt: string;
  /** para type = "status" */
  status?: string;
  reason?: string;
  /** para type = "notes" */
  notes?: string;
  internalNotes?: string;
  /** rótulo curto para mostrar ao usuário */
  label: string;
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* quota cheia ou storage bloqueado — modo offline degrada em silêncio */
  }
}

export function agendaCacheKey(key: AgendaCacheKey): string {
  return `${CACHE_PREFIX}${key.tenantId}:${key.unitId}:${key.professionalId}:${key.rangeStart}:${key.rangeEnd}`;
}

export function saveAgendaSnapshot<T>(key: AgendaCacheKey, data: T): void {
  const entry: AgendaCacheEntry<T> = { syncedAt: new Date().toISOString(), data };
  safeSet(agendaCacheKey(key), JSON.stringify(entry));
  pruneExpiredSnapshots();
}

export function readAgendaSnapshot<T>(key: AgendaCacheKey): AgendaCacheEntry<T> | null {
  const raw = safeGet(agendaCacheKey(key));
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as AgendaCacheEntry<T>;
    if (!entry || typeof entry.syncedAt !== "string" || !Array.isArray(entry.data)) return null;
    const syncedAt = Date.parse(entry.syncedAt);
    const age = Date.now() - syncedAt;
    if (!Number.isFinite(syncedAt) || age < 0 || age > CACHE_TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

export function pruneExpiredSnapshots(): void {
  try {
    const now = Date.now();
    for (const storageKey of Object.keys(localStorage)) {
      if (!storageKey.startsWith(CACHE_PREFIX)) continue;
      const raw = localStorage.getItem(storageKey);
      if (!raw) continue;
      try {
        const entry = JSON.parse(raw) as AgendaCacheEntry<unknown>;
        const syncedAt = typeof entry?.syncedAt === "string" ? Date.parse(entry.syncedAt) : Number.NaN;
        const age = now - syncedAt;
        if (
          !Number.isFinite(syncedAt) ||
          age < 0 ||
          age > CACHE_TTL_MS ||
          !Array.isArray(entry.data)
        ) {
          localStorage.removeItem(storageKey);
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    }
  } catch {
    /* noop */
  }
}

export function clearAgendaCache(tenantId?: string): void {
  try {
    for (const storageKey of Object.keys(localStorage)) {
      if (!storageKey.startsWith(CACHE_PREFIX)) continue;
      if (tenantId && !storageKey.startsWith(`${CACHE_PREFIX}${tenantId}:`)) continue;
      localStorage.removeItem(storageKey);
    }
  } catch {
    /* noop */
  }
}

/* ------------------------------ fila de ações ----------------------------- */

export function readQueue(): PendingAction[] {
  const raw = safeGet(QUEUE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPendingAction) : [];
  } catch {
    return [];
  }
}

function isPendingAction(value: unknown): value is PendingAction {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (
    typeof action.id !== "string" || !action.id ||
    typeof action.tenantId !== "string" || !action.tenantId ||
    typeof action.appointmentId !== "string" || !action.appointmentId ||
    typeof action.createdAt !== "string" ||
    typeof action.label !== "string" ||
    (action.reason !== undefined && typeof action.reason !== "string") ||
    (action.notes !== undefined && typeof action.notes !== "string") ||
    (action.internalNotes !== undefined && typeof action.internalNotes !== "string")
  ) return false;

  if (action.type === "status") {
    return typeof action.status === "string" && VALID_APPOINTMENT_STATUSES.has(action.status);
  }
  return action.type === "notes" && action.status === undefined &&
    (action.notes !== undefined || action.internalNotes !== undefined);
}

export const QUEUE_CHANGED_EVENT = "cativa:agenda-queue-changed";

function writeQueue(actions: PendingAction[]): void {
  safeSet(QUEUE_KEY, JSON.stringify(actions));
  try {
    window.dispatchEvent(new CustomEvent(QUEUE_CHANGED_EVENT));
  } catch {
    /* noop */
  }
}

export function queueSize(tenantId?: string): number {
  const all = readQueue();
  return tenantId ? all.filter((action) => action.tenantId === tenantId).length : all.length;
}

export function enqueueAction(action: Omit<PendingAction, "id" | "createdAt">): PendingAction {
  const entry: PendingAction = {
    ...action,
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
  };
  const queue = readQueue();
  // Uma ação do mesmo tipo para o mesmo atendimento e tenant substitui a
  // anterior: vale sempre a última decisão da recepção, sem cruzar escopos.
  const filtered = queue.filter(
    (item) => !(
      item.tenantId === entry.tenantId &&
      item.appointmentId === entry.appointmentId &&
      item.type === entry.type
    ),
  );
  filtered.push(entry);
  writeQueue(filtered);
  return entry;
}

export function removeAction(id: string): void {
  writeQueue(readQueue().filter((action) => action.id !== id));
}

export function clearQueue(tenantId?: string): void {
  if (!tenantId) {
    writeQueue([]);
    return;
  }
  writeQueue(readQueue().filter((action) => action.tenantId !== tenantId));
}

export function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine !== false;
}
