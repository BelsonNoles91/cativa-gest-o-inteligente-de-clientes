/**
 * Domínio: Portal do Cliente.
 * Tipos puros (sem Supabase). Regras de negócio do auto-atendimento.
 *
 * REGRA: o cliente vê apenas o que lhe pertence (RLS garante isso),
 * mas a UI também precisa respeitar essa fronteira.
 */

import type { Appointment, AppointmentStatus } from "./scheduling";

/** Vínculo entre um auth.users e um clients.id de um tenant. */
export interface ClientUserLink {
  id: string;
  tenantId: string;
  clientId: string;
  userId: string;
  status: "active" | "invited" | "blocked";
  linkedAt: string;
}

/** Branding mínimo do tenant exposto ao portal. */
export interface PortalTenantBranding {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  segment: string;
  unitName: string | null;
  unitPhone: string | null;
  unitAddress: string | null;
}

export interface CancellationPolicySnapshot {
  id: string;
  name: string;
  description: string | null;
  hoursBeforeNoCharge: number;
  lateCancelFeePct: number;
  noShowFeePct: number;
}

/** Pode cancelar/reagendar sem multa? */
export function canCancelWithoutFee(
  startsAtIso: string,
  policy: CancellationPolicySnapshot | null,
): { allowed: boolean; hoursLeft: number; willChargeFee: boolean; feePct: number } {
  const startsAt = new Date(startsAtIso).getTime();
  const now = Date.now();
  const hoursLeft = Math.max(0, (startsAt - now) / 36e5);

  if (!policy) {
    return { allowed: true, hoursLeft, willChargeFee: false, feePct: 0 };
  }
  const allowed = hoursLeft >= policy.hoursBeforeNoCharge;
  return {
    allowed,
    hoursLeft,
    willChargeFee: !allowed && policy.lateCancelFeePct > 0,
    feePct: allowed ? 0 : policy.lateCancelFeePct,
  };
}

/** Status que o cliente pode ver (filtramos os internos). */
export const portalVisibleStatuses: AppointmentStatus[] = [
  "requested",
  "pending",
  "confirmed",
  "reminded",
  "arrived",
  "in_service",
  "completed",
  "canceled",
  "no_show",
];

export function isPastAppointment(a: Appointment): boolean {
  const ends = new Date(a.endsAt).getTime();
  return ends < Date.now() || a.status === "completed" || a.status === "canceled" || a.status === "no_show";
}

export function isUpcomingAppointment(a: Appointment): boolean {
  if (a.status === "canceled" || a.status === "no_show" || a.status === "completed") return false;
  return new Date(a.startsAt).getTime() >= Date.now();
}

/** Item simplificado do portal (junção feita no repositório). */
export interface PortalAppointmentView {
  appointment: Appointment;
  serviceName: string | null;
  professionalName: string | null;
  unitName: string | null;
  policy: CancellationPolicySnapshot | null;
}

export interface PortalPackageView {
  id: string;
  packageName: string;
  serviceName: string | null;
  sessionsTotal: number;
  sessionsUsed: number;
  status: string;
  expiresAt: string | null;
  purchasedAt: string;
}

export interface PortalMembershipView {
  id: string;
  membershipName: string;
  status: string;
  startedAt: string;
  currentCycleEnd: string | null;
  benefits: Array<{ serviceName: string | null; sessionsPerCycle: number; discountPct: number }>;
}

export interface PortalReviewInput {
  appointmentId: string;
  rating: number;
  comment?: string | null;
  wouldRecommend?: boolean | null;
}

export interface PortalConsentPending {
  responseId: string;
  templateId: string;
  templateTitle: string;
  templateBody: string;
  templateVersion: number;
  status: "pending" | "viewed";
  createdAt: string;
}

export interface PortalPreferences {
  preferredUnitId: string | null;
  preferredProfessionalId: string | null;
}

/** Retorna “primeiro nome”. */
export function firstName(full: string | null | undefined): string {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

/** Formata moeda em BRL a partir de cents. */
export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
