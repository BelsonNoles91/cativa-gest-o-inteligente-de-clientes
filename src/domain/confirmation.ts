/**
 * Domínio: Central de Confirmação. Tipos puros (sem Supabase).
 *
 * REGRA INEGOCIÁVEL: o Cativa NUNCA usa API de WhatsApp (oficial ou não).
 * Aqui apenas geramos texto, link wa.me e registramos tentativas. O envio
 * é sempre humano.
 */

export type ConfirmationStage =
  | "today"
  | "tomorrow"
  | "upcoming"
  | "high_risk"
  | "premium"
  | "reschedule"
  | "recovery";

export type ConfirmationQueueStatus =
  | "pending"
  | "in_progress"
  | "confirmed"
  | "reschedule_requested"
  | "canceled"
  | "no_response"
  | "follow_up_scheduled"
  | "closed";

export type ContactAttemptResult =
  | "pending"
  | "sent"
  | "confirmed"
  | "reschedule_requested"
  | "canceled"
  | "no_response"
  | "call_made"
  | "follow_up_scheduled";

export type MessageChannel = "whatsapp" | "phone" | "email" | "sms" | "in_person";

export type MessageTemplateStage =
  | "confirmation"
  | "reminder"
  | "reschedule"
  | "cancellation"
  | "recovery"
  | "reactivation"
  | "thanks"
  | "custom";

export type CallOutcome =
  | "answered"
  | "no_answer"
  | "voicemail"
  | "wrong_number"
  | "busy"
  | "callback_requested";

// =============================================================================
// Entidades
// =============================================================================

export interface ConfirmationQueueItem {
  id: string;
  tenantId: string;
  appointmentId: string;
  clientId: string;
  ruleId: string | null;
  stage: ConfirmationStage;
  status: ConfirmationQueueStatus;
  priority: number;
  scheduledFor: string;
  appointmentStartsAt: string;
  assignedTo: string | null;
  lastAttemptAt: string | null;
  attemptsCount: number;
  followUpAt: string | null;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  tenantId: string;
  unitId: string | null;
  serviceId: string | null;
  stage: MessageTemplateStage;
  channel: MessageChannel;
  name: string;
  body: string;
  variables: string[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ConfirmationRule {
  id: string;
  tenantId: string;
  unitId: string | null;
  name: string;
  stage: ConfirmationStage;
  hoursBeforeAppointment: number;
  basePriority: number;
  appliesToVip: boolean;
  appliesToProtocol: boolean;
  appliesToHighRisk: boolean;
  minAppointmentValueCents: number | null;
  skipIfAlreadyConfirmed: boolean;
  isActive: boolean;
}

export interface ContactAttempt {
  id: string;
  tenantId: string;
  queueId: string | null;
  appointmentId: string | null;
  clientId: string;
  templateId: string | null;
  channel: MessageChannel;
  result: ContactAttemptResult;
  messagePreview: string | null;
  notes: string | null;
  attemptedBy: string | null;
  attemptedAt: string;
  followUpAt: string | null;
}

export interface CallLog {
  id: string;
  tenantId: string;
  clientId: string;
  appointmentId: string | null;
  queueId: string | null;
  outcome: CallOutcome;
  durationSeconds: number | null;
  notes: string | null;
  calledBy: string | null;
  calledAt: string;
}

export interface ChannelPreference {
  id: string;
  tenantId: string;
  clientId: string;
  preferredChannel: MessageChannel;
  fallbackChannel: MessageChannel | null;
  preferredWindowStart: string | null;
  preferredWindowEnd: string | null;
  doNotDisturb: boolean;
  notes: string | null;
}

// =============================================================================
// Labels
// =============================================================================

export const stageLabels: Record<ConfirmationStage, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
  upcoming: "Próximos dias",
  high_risk: "Alto risco",
  premium: "Premium / VIP",
  reschedule: "Reagendamento",
  recovery: "Recuperação",
};

export const stageDescriptions: Record<ConfirmationStage, string> = {
  today: "Confirme atendimentos do dia.",
  tomorrow: "Garanta a agenda de amanhã.",
  upcoming: "Próximos 7 dias para preparação.",
  high_risk: "Clientes com histórico de no-show.",
  premium: "VIPs e atendimentos de alto valor.",
  reschedule: "Solicitações de remarcação.",
  recovery: "Recuperar cancelamentos recentes.",
};

export const queueStatusLabels: Record<ConfirmationQueueStatus, string> = {
  pending: "Pendente",
  in_progress: "Em andamento",
  confirmed: "Confirmado",
  reschedule_requested: "Pediu reagendar",
  canceled: "Cancelou",
  no_response: "Sem resposta",
  follow_up_scheduled: "Retorno agendado",
  closed: "Encerrado",
};

export const attemptResultLabels: Record<ContactAttemptResult, string> = {
  pending: "Pendente",
  sent: "Enviado",
  confirmed: "Confirmado",
  reschedule_requested: "Pediu reagendar",
  canceled: "Cancelou",
  no_response: "Sem resposta",
  call_made: "Ligação feita",
  follow_up_scheduled: "Retorno agendado",
};

export const channelLabels: Record<MessageChannel, string> = {
  whatsapp: "WhatsApp (manual)",
  phone: "Ligação",
  email: "E-mail",
  sms: "SMS",
  in_person: "Presencial",
};

export const templateStageLabels: Record<MessageTemplateStage, string> = {
  confirmation: "Confirmação",
  reminder: "Lembrete",
  reschedule: "Reagendamento",
  cancellation: "Cancelamento",
  recovery: "Recuperação",
  reactivation: "Reativação",
  thanks: "Agradecimento",
  custom: "Personalizado",
};

export const callOutcomeLabels: Record<CallOutcome, string> = {
  answered: "Atendeu",
  no_answer: "Não atendeu",
  voicemail: "Caixa postal",
  wrong_number: "Número errado",
  busy: "Ocupado",
  callback_requested: "Pediu retorno",
};

export type Tone = "default" | "success" | "warning" | "destructive" | "info" | "muted";

export function queueStatusTone(s: ConfirmationQueueStatus): Tone {
  switch (s) {
    case "confirmed": return "success";
    case "in_progress":
    case "follow_up_scheduled": return "info";
    case "pending": return "warning";
    case "canceled":
    case "no_response": return "destructive";
    case "reschedule_requested": return "warning";
    default: return "muted";
  }
}

export function attemptResultTone(r: ContactAttemptResult): Tone {
  switch (r) {
    case "confirmed":
    case "sent": return "success";
    case "call_made":
    case "follow_up_scheduled": return "info";
    case "pending": return "warning";
    case "canceled":
    case "no_response":
    case "reschedule_requested": return "destructive";
    default: return "muted";
  }
}

// =============================================================================
// Helpers de Template
// =============================================================================

/** Variáveis padrão suportadas em qualquer template. */
export const DEFAULT_TEMPLATE_VARIABLES = [
  "cliente_nome",
  "cliente_primeiro_nome",
  "negocio_nome",
  "unidade_nome",
  "profissional_nome",
  "servico_nome",
  "data",
  "hora",
  "data_hora",
  "endereco",
] as const;

export type TemplateVar = (typeof DEFAULT_TEMPLATE_VARIABLES)[number];

/**
 * Renderiza um template trocando {{variavel}} pelos valores do contexto.
 * Variáveis sem valor são substituídas por string vazia.
 */
export function renderTemplate(body: string, context: Record<string, string | undefined | null>): string {
  return body.replace(/\{\{\s*([\w_]+)\s*\}\}/g, (_match, key: string) => {
    const v = context[key];
    return v == null ? "" : String(v);
  });
}

/** Retorna apenas dígitos do telefone (para wa.me). */
export function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}
