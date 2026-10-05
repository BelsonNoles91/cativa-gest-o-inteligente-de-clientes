import { ROLES, type Role } from "@/domain/roles";
import type { TenantSegment } from "@/domain/tenant";

const STORAGE_PREFIX = "cativa:offline-tenant-context:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const TENANT_SEGMENTS = new Set<TenantSegment>([
  "salao",
  "clinica_estetica",
  "lash_brow",
  "barbearia",
  "esmalteria",
  "wellness",
]);
const OFFLINE_ROLES = new Set<Role>(["owner", "manager", "frontdesk", "professional"]);

export interface OfflineTenantSummary {
  id: string;
  name: string;
  slug: string;
  segment: TenantSegment;
}

export interface OfflineUnitSummary {
  id: string;
  tenant_id: string;
  name: string;
  is_default: boolean;
}

export interface OfflineTenantContext {
  userId: string;
  savedAt: string;
  tenant: OfflineTenantSummary;
  role: Exclude<Role, "super_admin" | "client">;
  units: OfflineUnitSummary[];
  currentUnitId: string | null;
}

function storageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function saveOfflineTenantContext(context: OfflineTenantContext): void {
  try {
    localStorage.setItem(storageKey(context.userId), JSON.stringify(context));
  } catch {
    // Offline restoration is best-effort when storage is blocked or full.
  }
}

export function readOfflineTenantContext(userId: string): OfflineTenantContext | null {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return null;

    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || value.userId !== userId) return null;
    if (typeof value.savedAt !== "string") return null;
    const savedAt = Date.parse(value.savedAt);
    const age = Date.now() - savedAt;
    if (!Number.isFinite(savedAt) || age < 0 || age > MAX_AGE_MS) return null;

    const tenant = value.tenant;
    if (
      !isRecord(tenant) ||
      typeof tenant.id !== "string" ||
      typeof tenant.name !== "string" ||
      typeof tenant.slug !== "string" ||
      typeof tenant.segment !== "string" ||
      !TENANT_SEGMENTS.has(tenant.segment as TenantSegment)
    ) return null;

    if (typeof value.role !== "string" || !ROLES.includes(value.role as Role) || !OFFLINE_ROLES.has(value.role as Role)) {
      return null;
    }
    if (!Array.isArray(value.units) || value.units.length === 0) return null;

    const units = value.units.filter((unit): unit is OfflineUnitSummary =>
      isRecord(unit) &&
      typeof unit.id === "string" &&
      unit.tenant_id === tenant.id &&
      typeof unit.name === "string" &&
      typeof unit.is_default === "boolean",
    );
    if (units.length !== value.units.length) return null;

    const currentUnitId = value.currentUnitId;
    if (currentUnitId !== null && typeof currentUnitId !== "string") return null;
    if (typeof currentUnitId === "string" && !units.some((unit) => unit.id === currentUnitId)) return null;
    const selectedUnitId: string | null = currentUnitId === null ? null : currentUnitId as string;

    return {
      userId,
      savedAt: value.savedAt,
      tenant: tenant as unknown as OfflineTenantSummary,
      role: value.role as OfflineTenantContext["role"],
      units,
      currentUnitId: selectedUnitId,
    };
  } catch {
    return null;
  }
}
