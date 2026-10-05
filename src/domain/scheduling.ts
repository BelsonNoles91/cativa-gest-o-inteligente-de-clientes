/**
 * Domínio: Agenda. Tipos puros (sem Supabase).
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
  | "professional"
  | "client_portal"
  | "walk_in"
  | "phone"
  | "whatsapp"
  | "recurring"
  | "system";

export type BlockScope = "professional" | "unit";
export type ResourceType = "room" | "equipment" | "chair" | "station" | "other";
export type WaitlistStatus = "open" | "contacted" | "scheduled" | "expired" | "canceled";

export interface Resource {
  id: string;
  tenantId: string;
  unitId: string | null;
  name: string;
  resourceType: ResourceType;
  color: string | null;
  notes: string | null;
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
  startsAt: string;         // "HH:MM:SS"
  endsAt: string;
  isActive: boolean;
}

export interface TimeOffBlock {
  id: string;
  tenantId: string;
  scope: BlockScope;
  professionalId: string | null;
  unitId: string | null;
  startsAt: string;         // ISO
  endsAt: string;           // ISO
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
  clientRescheduleCount?: number;
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
  preferredUnitId: string | null;
  clientId: string;
  serviceId: string | null;
  preferredProfessionalId: string | null;
  desiredWindowStart: string | null;
  desiredWindowEnd: string | null;
  notes: string | null;
  priority: number;
  status: WaitlistStatus;
  contactedAt: string | null;
  scheduledAppointmentId: string | null;
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
  professional: "Profissional",
  client_portal: "Portal do cliente",
  walk_in: "Encaixe",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  recurring: "Recorrência",
  system: "Sistema",
};

export const waitlistStatusLabels: Record<WaitlistStatus, string> = {
  open: "Aguardando",
  contacted: "Contatado",
  scheduled: "Agendado",
  expired: "Expirado",
  canceled: "Cancelado",
};

export const resourceTypeLabels: Record<ResourceType, string> = {
  room: "Sala",
  equipment: "Equipamento",
  chair: "Cadeira",
  station: "Estação",
  other: "Outro",
};

export const weekdayShortLabels = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
export const weekdayFullLabels = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

export type StatusTone = "default" | "success" | "warning" | "destructive" | "info" | "muted";

export function statusTone(status: AppointmentStatus): StatusTone {
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

/** Transições válidas entre status. */
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

/** "HH:MM" a partir de "HH:MM:SS" ou ISO. */
export function formatHourMinute(value: string): string {
  if (!value) return "";
  if (value.includes("T")) {
    const d = new Date(value);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return value.slice(0, 5);
}
