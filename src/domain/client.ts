/**
 * Domínio: Cliente.
 * Tipos puros (sem dependência do Supabase). Usados em UI, services e
 * repositórios para manter o app portável.
 */

export type ClientStatus = "active" | "inactive" | "blocked";
export type ClientRiskLevel = "low" | "medium" | "high";
export type ClientPhotoType = "before" | "after" | "general";
export type TimelineEventType =
  | "note"
  | "file"
  | "photo"
  | "consent"
  | "manual"
  | "status_change"
  | "appointment"
  | "system";
export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "boolean"
  | "select"
  | "multiselect"
  | "textarea";
export type ConsentResponseStatus = "pending" | "signed" | "declined";

export interface Client {
  id: string;
  tenantId: string;
  preferredUnitId: string | null;
  preferredProfessionalId: string | null;
  referredByClientId: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  birthDate: string | null;
  origin: string | null;
  notes: string | null;
  allergies: string | null;
  contraindications: string | null;
  preferences: string | null;
  status: ClientStatus;
  isVip: boolean;
  riskLevel: ClientRiskLevel;
  needsReactivation: boolean;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  city: string | null;
  state: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientTag {
  id: string;
  tenantId: string;
  name: string;
  color: string | null;
}

export interface ClientNote {
  id: string;
  clientId: string;
  authorId: string | null;
  body: string;
  isPinned: boolean;
  createdAt: string;
}

export interface ClientFile {
  id: string;
  clientId: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  description: string | null;
  createdAt: string;
}

export interface ClientPhoto {
  id: string;
  clientId: string;
  storagePath: string;
  photoType: ClientPhotoType;
  pairId: string | null;
  caption: string | null;
  takenAt: string | null;
  createdAt: string;
}

export interface TimelineEvent {
  id: string;
  clientId: string;
  actorId: string | null;
  eventType: TimelineEventType;
  title: string;
  description: string | null;
  referenceId: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

export interface CustomFieldDefinition {
  id: string;
  tenantId: string;
  entity: string;
  key: string;
  label: string;
  fieldType: CustomFieldType;
  options: string[];
  isRequired: boolean;
  position: number;
}

export interface ClientCustomFieldValue {
  id: string;
  clientId: string;
  definitionId: string;
  value: unknown;
}

export interface ConsentTemplate {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  isActive: boolean;
  version: number;
  createdAt: string;
}

export interface ConsentResponse {
  id: string;
  clientId: string;
  templateId: string;
  templateVersion: number;
  status: ConsentResponseStatus;
  signedName: string | null;
  signedAt: string | null;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Helpers de negócio
// -----------------------------------------------------------------------------

export const clientStatusLabels: Record<ClientStatus, string> = {
  active: "Ativo",
  inactive: "Inativo",
  blocked: "Bloqueado",
};

export const riskLevelLabels: Record<ClientRiskLevel, string> = {
  low: "Risco baixo",
  medium: "Risco médio",
  high: "Risco alto",
};

export const photoTypeLabels: Record<ClientPhotoType, string> = {
  before: "Antes",
  after: "Depois",
  general: "Geral",
};

/**
 * Calcula um score (0–100) de completude do cadastro.
 * Pesos: campos essenciais para retenção e contato.
 */
export function computeCompleteness(c: Pick<
  Client,
  | "fullName"
  | "phone"
  | "email"
  | "birthDate"
  | "origin"
  | "preferences"
  | "allergies"
  | "contraindications"
  | "preferredUnitId"
  | "preferredProfessionalId"
>): number {
  const checks: Array<[boolean, number]> = [
    [Boolean(c.fullName?.trim()), 15],
    [Boolean(c.phone?.trim()), 20],
    [Boolean(c.email?.trim()), 10],
    [Boolean(c.birthDate), 10],
    [Boolean(c.origin?.trim()), 10],
    [Boolean(c.preferences?.trim()), 10],
    [Boolean(c.allergies?.trim() || c.contraindications?.trim()), 10],
    [Boolean(c.preferredUnitId), 7],
    [Boolean(c.preferredProfessionalId), 8],
  ];
  return checks.reduce((sum, [ok, w]) => sum + (ok ? w : 0), 0);
}

/**
 * Próximo aniversário do cliente em dias (negativo = passou).
 * null se sem birth_date.
 */
export function daysUntilBirthday(birthDate: string | null, ref: Date = new Date()): number | null {
  if (!birthDate) return null;
  const d = new Date(birthDate);
  if (Number.isNaN(d.getTime())) return null;
  const next = new Date(ref.getFullYear(), d.getMonth(), d.getDate());
  if (next < new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return Math.round((next.getTime() - new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime()) / 86400000);
}
