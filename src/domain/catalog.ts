/**
 * Domínio: Catálogo (categorias, serviços, preços, pacotes, assinaturas,
 * protocolos, saldos e políticas de cancelamento).
 * Tipos puros — sem Supabase. Usados em UI, services e repositórios.
 */

export type PackageKind = "package" | "combo";
export type MembershipBillingCycle = "monthly" | "quarterly" | "yearly";
export type ClientSubscriptionStatus = "active" | "paused" | "canceled" | "expired";
export type ClientPackageStatus = "active" | "completed" | "expired" | "canceled";

export interface ServiceCategory {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  isActive: boolean;
}

export interface Service {
  id: string;
  tenantId: string;
  categoryId: string | null;
  cancellationPolicyId: string | null;
  name: string;
  description: string | null;
  internalCode: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  processingMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  idealReturnWindowDays: number | null;
  requiresResource: boolean;
  resourceLabel: string | null;
  eligibleForPackage: boolean;
  eligibleForMembership: boolean;
  preAppointmentInstructions: string | null;
  postAppointmentInstructions: string | null;
  isActive: boolean;
  isFeatured: boolean;
  position: number;
}

export interface ServicePrice {
  id: string;
  serviceId: string;
  currency: string;
  amountCents: number;
  isDefault: boolean;
}

export interface Package {
  id: string;
  tenantId: string;
  kind: PackageKind;
  name: string;
  description: string | null;
  priceCents: number;
  validityDays: number | null;
  recommendedIntervalDays: number | null;
  usageRules: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface PackageItem {
  id: string;
  packageId: string;
  serviceId: string;
  sessions: number;
  position: number;
}

export interface Membership {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  priceCents: number;
  billingCycle: MembershipBillingCycle;
  isActive: boolean;
  notes: string | null;
}

export interface MembershipBenefit {
  id: string;
  membershipId: string;
  serviceId: string;
  sessionsPerCycle: number;
  discountPct: number;
}

export interface Protocol {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  totalSessions: number;
  recommendedIntervalDays: number | null;
  totalPriceCents: number | null;
  preInstructions: string | null;
  postInstructions: string | null;
  isActive: boolean;
}

export interface ProtocolSession {
  id: string;
  protocolId: string;
  serviceId: string;
  step: number;
  intervalDays: number | null;
  notes: string | null;
}

export interface CancellationPolicy {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  hoursBeforeNoCharge: number;
  lateCancelFeePct: number;
  noShowFeePct: number;
  isDefault: boolean;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export const packageKindLabels: Record<PackageKind, string> = {
  package: "Pacote",
  combo: "Combo",
};

export const billingCycleLabels: Record<MembershipBillingCycle, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  yearly: "Anual",
};

/**
 * Tempo total de bloqueio na agenda (duração + buffers + processamento).
 */
export function totalBlockedMinutes(s: Pick<Service, "durationMinutes" | "bufferBeforeMinutes" | "bufferAfterMinutes" | "processingMinutes">): number {
  return s.durationMinutes + s.bufferBeforeMinutes + s.bufferAfterMinutes + s.processingMinutes;
}

/** Formata centavos como BRL (default) ou outra moeda. */
export function formatPrice(amountCents: number | null | undefined, currency = "BRL"): string {
  const value = (amountCents ?? 0) / 100;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

/** Formata duração em "1h 20min". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
}
