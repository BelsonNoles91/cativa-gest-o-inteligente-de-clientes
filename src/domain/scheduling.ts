/**
 * Domínio: Agenda (recursos, disponibilidades, bloqueios, agendamentos,
 * histórico de status e lista de espera). Tipos puros — sem Supabase.
 */

export type AppointmentStatus =
  | "requested"
  | "pending"
  | "confirmed"
  | "reminded"
  | "arrived"
  | "in_service"
  | "completed"
  | "canceled"
  | "no_show";

export type AppointmentSource =
  | "frontdesk"
  | "client_portal"
  | "whatsapp"
  | "phone"
  | "walk_in"
  | "other";

export type BlockScope = "professional" | "unit" | "resource";
export type WaitlistStatus = "waiting" | "offered" | "scheduled" | "expired" | "canceled";

export interface Resource {
  id: string;
  tenantId: string;
  unitId: string | null;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface UnitBusinessHour {
  id: string;
  tenantId: string;
  unitId: string;
  weekday: number;          // 0 = domingo
  opensAt: string;          // "HH:MM:SS"
  closesAt: string;
  isClosed: boolean;
}

export interface ProfessionalAvailability {
  id: string;
  tenantId: string;
  professionalId: string;
  unitId: string | null;
  weekday: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

export interface TimeOffBlock {
  id: string;
  tenantId: string;
  scope: BlockScope;
  professionalId: string | null;
  unitId: string | null;
  resourceId: string | null;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface RecurringBlock {
  id: string;
  tenantId: string;
  professionalId: string | null;
  unitId: string | null;
  weekday: number;
  startsAt: string;         // "HH:MM:SS"
  endsAt: string;
  reason: string | null;
  isActive: boolean;
}

export interface Appointment {
  id: string;
  tenantId: string;
  unitId: string;
  clientId: string;
  professionalId: string;
  resourceId: string | null;
  cancellationPolicyId: string | null;
  status: AppointmentStatus;
  source: AppointmentSource;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  isWalkIn: boolean;
  isOverbooked: boolean;
  totalPriceCents: number;
  notes: string | null;
  internalNotes: string | null;
  confirmedAt: string | null;
  remindedAt: string | null;
  arrivedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  noShowAt: string | null;
  canceledReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentItem {
  id: string;
  appointmentId: string;
  serviceId: string;
  durationMinutes: number;
  priceCents: number;
  position: number;
  notes: string | null;
}

export interface WaitlistEntry {
  id: string;
  tenantId: string;
  unitId: string | null;
  clientId: string;
  serviceId: string | null;
  preferredProfessionalId: string | null;
  desiredFrom: string | null;
  desiredTo: string | null;
  preferredWeekdays: number[];
  notes: string | null;
  priority: number;
  status: WaitlistStatus;
  createdAt: string;
}

// =============================================================================
// Labels & helpers
// =============================================================================

export const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  requested: "Solicitado",
  pending: "Pendente",
  confirmed: "Confirmado",
  reminded: "Lembrado",
  arrived: "Chegou",
  in_service: "Em atendimento",
  completed: "Concluído",
  canceled: "Cancelado",
  no_show: "No-show",
};

export const appointmentSourceLabels: Record<AppointmentSource, string> = {
  frontdesk: "Recepção",
  client_portal: "Portal do cliente",
  whatsapp: "WhatsApp",
  phone: "Telefone",
  walk_in: "Encaixe / sem hora",
  other: "Outro",
};

export const weekdayShortLabels = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const weekdayFullLabels = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

/** Cor semântica do status para uso em badges. */
export function statusTone(status: AppointmentStatus):
  "default" | "success" | "warning" | "destructive" | "info" | "muted" {
  switch (status) {
    case "completed":
    case "in_service":
    case "arrived":
      return "success";
    case "confirmed":
    case "reminded":
      return "info";
    case "pending":
    case "requested":
      return "warning";
    case "canceled":
    case "no_show":
      return "destructive";
    default:
      return "default";
  }
}

/** Transições válidas entre status (regras simples; pode evoluir). */
export const allowedTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
  requested: ["pending", "confirmed", "canceled"],
  pending: ["confirmed", "reminded", "arrived", "canceled", "no_show"],
  confirmed: ["reminded", "arrived", "canceled", "no_show"],
  reminded: ["arrived", "confirmed", "canceled", "no_show"],
  arrived: ["in_service", "canceled"],
  in_service: ["completed"],
  completed: [],
  canceled: [],
  no_show: [],
};

export function canTransition(from: AppointmentStatus, to: AppointmentStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}

/** Formata "HH:MM" a partir de "HH:MM:SS" ou ISO. */
export function formatHourMinute(value: string): string {
  if (!value) return "";
  // ISO datetime
  if (value.includes("T")) {
    const d = new Date(value);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return value.slice(0, 5);
}
