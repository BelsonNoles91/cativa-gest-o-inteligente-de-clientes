/**
 * Domínio: SaaS Billing administrativo (planos, assinaturas, limites, flags).
 *
 * Esta camada fica COMPLETAMENTE separada da operação do salão/clínica.
 * Não contém integração com provider de pagamento — apenas o vocabulário
 * e as regras puras de assinatura, trial, grace period e limites.
 */

import type { TenantSegment } from "./tenant";

// ----------------------------------------------------------------------------
// Tipos básicos
// ----------------------------------------------------------------------------

export type PlanBillingPeriod = "monthly" | "quarterly" | "semiannual" | "annual" | "custom";
export type PlanStatus = "public" | "private" | "archived";
export type SubscriptionStatus = "trialing" | "active" | "overdue" | "suspended" | "canceled";
export type FeatureValueType = "boolean" | "number" | "string" | "json";

export type SubscriptionEventType =
  | "created"
  | "trial_started"
  | "trial_extended"
  | "activated"
  | "renewed"
  | "upgraded"
  | "downgraded"
  | "suspended"
  | "reactivated"
  | "canceled"
  | "overdue"
  | "note";

export interface Plan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billingPeriod: PlanBillingPeriod;
  priceCents: number;
  currency: string;
  trialDays: number;
  gracePeriodDays: number;
  maxUnits: number | null;
  maxProfessionals: number | null;
  maxActiveClients: number | null;
  maxStorageMb: number | null;
  maxAppointmentsMonth: number | null;
  status: PlanStatus;
  isDefault: boolean;
  features: Record<string, boolean>;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlanFeature {
  id: string;
  planId: string;
  featureKey: string;
  label: string;
  valueType: FeatureValueType;
  value: unknown;
  displayOrder: number;
}

export interface TenantSubscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  suspendedAt: string | null;
  overdueSince: string | null;
  discountCents: number;
  discountReason: string | null;
  overrideLimits: Record<string, number | null>;
  notes: string | null;
}

export interface SubscriptionEvent {
  id: string;
  tenantId: string;
  subscriptionId: string | null;
  eventType: SubscriptionEventType;
  fromPlanId: string | null;
  toPlanId: string | null;
  fromStatus: SubscriptionStatus | null;
  toStatus: SubscriptionStatus | null;
  notes: string | null;
  createdAt: string;
}

export interface FeatureFlag {
  id: string;
  tenantId: string | null;
  flagKey: string;
  label: string;
  description: string | null;
  valueType: FeatureValueType;
  value: unknown;
  isGlobal: boolean;
}

export interface UsageSnapshot {
  id: string;
  tenantId: string;
  capturedAt: string;
  unitsCount: number;
  professionalsCount: number;
  activeClientsCount: number;
  storageMb: number;
  appointmentsLast30d: number;
}

export interface SegmentTemplate {
  id: string;
  segment: TenantSegment;
  name: string;
  description: string | null;
  payload: Record<string, unknown>;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

// ----------------------------------------------------------------------------
// Labels
// ----------------------------------------------------------------------------

export const billingPeriodLabels: Record<PlanBillingPeriod, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
  custom: "Customizado",
};

export const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {
  trialing: "Em trial",
  active: "Ativa",
  overdue: "Em atraso",
  suspended: "Suspensa",
  canceled: "Cancelada",
};

export const subscriptionStatusTone: Record<SubscriptionStatus, "brand" | "success" | "warning" | "danger" | "neutral"> = {
  trialing: "brand",
  active: "success",
  overdue: "warning",
  suspended: "danger",
  canceled: "neutral",
};

export const planStatusLabels: Record<PlanStatus, string> = {
  public: "Público",
  private: "Privado",
  archived: "Arquivado",
};

export const eventLabels: Record<SubscriptionEventType, string> = {
  created: "Criada",
  trial_started: "Trial iniciado",
  trial_extended: "Trial estendido",
  activated: "Ativada",
  renewed: "Renovada",
  upgraded: "Upgrade",
  downgraded: "Downgrade",
  suspended: "Suspensa",
  reactivated: "Reativada",
  canceled: "Cancelada",
  overdue: "Em atraso",
  note: "Anotação",
};

// ----------------------------------------------------------------------------
// Regras puras
// ----------------------------------------------------------------------------

/** Retorna os limites EFETIVOS aplicando override do tenant sobre o plano. */
export function effectiveLimits(plan: Plan, override: Record<string, number | null>) {
  return {
    maxUnits: pickLimit(override.max_units, plan.maxUnits),
    maxProfessionals: pickLimit(override.max_professionals, plan.maxProfessionals),
    maxActiveClients: pickLimit(override.max_active_clients, plan.maxActiveClients),
    maxStorageMb: pickLimit(override.max_storage_mb, plan.maxStorageMb),
    maxAppointmentsMonth: pickLimit(override.max_appointments_month, plan.maxAppointmentsMonth),
  };
}

function pickLimit(override: number | null | undefined, planValue: number | null): number | null {
  if (override === null || override === undefined) return planValue;
  return override;
}

/** Dias restantes de trial. Negativo = trial expirou. */
export function trialDaysLeft(sub: TenantSubscription): number | null {
  if (!sub.trialEndsAt) return null;
  const ms = new Date(sub.trialEndsAt).getTime() - Date.now();
  const days = Math.ceil(ms / 86_400_000);
  // Math.ceil produces negative zero for an expiry less than 24 hours ago;
  // normalize it so expired trials are distinguishable from zero days left.
  return ms < 0 && days === 0 ? -1 : days;
}

/** Indica se a assinatura está em grace period (após current_period_end e antes de suspensão). */
export function isInGracePeriod(
  sub: TenantSubscription,
  plan: Plan,
  now = Date.now(),
): boolean {
  if (sub.status !== "overdue") return false;
  if (!sub.overdueSince) return false;
  const limit = new Date(sub.overdueSince).getTime() + plan.gracePeriodDays * 86_400_000;
  return now < limit;
}

/**
 * Indica se o tenant pode operar com a assinatura atual.
 * Assinaturas suspensas/canceladas e trials expirados não liberam o produto;
 * inadimplência só mantém acesso durante a carência configurada no plano.
 */
export function hasSubscriptionAccess(
  sub: TenantSubscription | null,
  plan: Plan | null,
  now = Date.now(),
): boolean {
  if (!sub || !plan) return false;

  switch (sub.status) {
    case "active":
      return true;
    case "trialing": {
      if (!sub.trialEndsAt) return false;
      const trialEnd = new Date(sub.trialEndsAt).getTime();
      return Number.isFinite(trialEnd) && now < trialEnd;
    }
    case "overdue":
      return isInGracePeriod(sub, plan, now);
    case "suspended":
    case "canceled":
      return false;
  }
}

/** Percentual de uso vs limite. Retorna 0..1, ou null se sem limite. */
export function usagePct(used: number, limit: number | null): number | null {
  if (limit === null || limit === undefined || !Number.isFinite(limit) || limit <= 0) return null;
  const ratio = used / limit;
  if (Number.isNaN(ratio)) return 0;
  return Math.max(0, Math.min(1, ratio));
}

/** Usuário deve ver alerta quando consumo passa de 80%. */
export function isUsageWarning(used: number, limit: number | null): boolean {
  const p = usagePct(used, limit);
  return p !== null && p >= 0.8;
}

/** Usuário está bloqueado quando atingiu/passou o limite. */
export function isUsageBlocked(used: number, limit: number | null): boolean {
  const p = usagePct(used, limit);
  return p !== null && p >= 1;
}

/** Formata centavos como BRL. */
export function formatPrice(priceCents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(priceCents / 100);
}

export function isBooleanFeatureEnabled(value: unknown): boolean {
  if (value === true || value === "true" || value === 1) return true;
  if (typeof value === "number") return value > 0;
  return false;
}
