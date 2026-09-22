import type { JevResponse } from "../_shared/jev.ts";

export const RETENTION_ACTIONS = [
  "prioritize_human_contact",
  "offer_rebooking",
  "remind_pending_package",
  "monitor",
  "human_review",
] as const;

export type RetentionAction = (typeof RETENTION_ACTIONS)[number];

export interface RetentionState {
  evaluatedAt: string;
  client: {
    isVip: boolean;
    riskLevel: string;
    needsReactivation: boolean;
    daysSinceLastVisit: number | null;
    daysUntilNextVisit: number | null;
    averageCycleDays: number | null;
    churnRiskScore: number;
    contactAvailable: boolean;
  };
  appointments: {
    completedLastYear: number;
    noShowsLastYear: number;
    cancellationsLastYear: number;
    futureBooked: number;
    futureUnconfirmed: number;
  };
  packages: {
    activeWithRemainingSessions: number;
    remainingSessions: number;
    expiringWithin30Days: number;
  };
  contacts: {
    attemptsLast60Days: number;
    successfulLast60Days: number;
  };
}

export interface RetentionAdvice {
  status: "suggested" | "review";
  action: RetentionAction;
  actionLabel: string;
  description: string;
  urgency: number;
  confidence: number;
  evidenceSufficiency: number;
  model: string;
  evaluatedAt: string;
  automaticAction: false;
}

export interface RetentionPolicy {
  actionConfidenceThreshold: number;
  evidenceSufficiencyThreshold: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  actionConfidenceThreshold: 0.6,
  evidenceSufficiencyThreshold: 0.65,
};

interface ClientRow {
  is_vip?: boolean | null;
  risk_level?: string | null;
  needs_reactivation?: boolean | null;
  last_visit_at?: string | null;
  next_visit_at?: string | null;
  average_cycle_days?: number | null;
  churn_risk_score?: number | null;
  phone?: string | null;
  whatsapp_phone?: string | null;
  email?: string | null;
}

interface AppointmentRow {
  status?: string | null;
  starts_at?: string | null;
  confirmed_at?: string | null;
}

interface PackageRow {
  status?: string | null;
  sessions_total?: number | null;
  sessions_used?: number | null;
  expires_at?: string | null;
}

interface ContactRow {
  attempted_at?: string | null;
  result?: string | null;
}

export const RETENTION_QUESTIONS = {
  action: {
    type: "choice",
    instructions: {
      question: "Qual é a próxima ação humana mais adequada para retenção deste cliente?",
      constraints: [
        "Use apenas os fatos em `state`.",
        "Não presuma preferências, condições clínicas ou intenção do cliente.",
        "A resposta é somente uma sugestão; nenhuma mensagem ou alteração de agenda será executada.",
      ],
    },
    criteria: {
      prioritize_human_contact:
        "Priorizar contato humano quando há risco relevante, atraso de retorno ou futuro agendamento sem confirmação.",
      offer_rebooking:
        "Oferecer manualmente um novo agendamento quando o ciclo de retorno está vencido e não há horário futuro.",
      remind_pending_package:
        "Lembrar manualmente sobre sessões restantes de pacote, especialmente quando há vencimento próximo.",
      monitor:
        "Não agir agora; o cliente tem retorno futuro ou não há sinal concreto que justifique contato.",
      human_review:
        "Os dados são conflitantes, insuficientes ou exigem avaliação humana antes de sugerir outra ação.",
    },
  },
  urgency: {
    type: "score",
    instructions:
      "Avalie a urgência operacional da ação de retenção, sem confundir urgência comercial com risco clínico.",
    criteria: [
      "Sem urgência: acompanhar normalmente.",
      "Baixa: pode entrar na rotina desta semana.",
      "Moderada: merece atenção nas próximas 24 a 48 horas.",
      "Alta: priorizar hoje por risco concreto de perda, vencimento ou compromisso sem confirmação.",
    ],
  },
  evidence_sufficient: {
    type: "noul",
    instructions:
      "Os dados estruturados disponíveis são suficientes para recomendar uma ação específica, em vez de revisão humana?",
    criteria: {
      true: "Há fatos claros e coerentes que sustentam uma ação específica.",
      false: "Faltam fatos, há conflito ou qualquer ação específica seria especulativa.",
    },
  },
} as const;

export function buildRetentionState(
  client: ClientRow,
  appointments: AppointmentRow[],
  packages: PackageRow[],
  contacts: ContactRow[],
  now = new Date(),
): RetentionState {
  const nowMs = now.getTime();
  const in30Days = nowMs + 30 * 86_400_000;
  const cutoff60Days = nowMs - 60 * 86_400_000;

  const activePackages = packages.filter((item) => {
    const remaining = Math.max(0, Number(item.sessions_total ?? 0) - Number(item.sessions_used ?? 0));
    return item.status === "active" && remaining > 0;
  });

  const future = appointments.filter((item) => dateMs(item.starts_at) > nowMs);
  const history = appointments.filter((item) => dateMs(item.starts_at) <= nowMs);
  const recentContacts = contacts.filter((item) => dateMs(item.attempted_at) >= cutoff60Days);

  return {
    evaluatedAt: now.toISOString(),
    client: {
      isVip: Boolean(client.is_vip),
      riskLevel: client.risk_level ?? "unknown",
      needsReactivation: Boolean(client.needs_reactivation),
      daysSinceLastVisit: daysBetween(client.last_visit_at, now, "past"),
      daysUntilNextVisit: daysBetween(client.next_visit_at, now, "future"),
      averageCycleDays: finiteOrNull(client.average_cycle_days),
      churnRiskScore: clamp(Number(client.churn_risk_score ?? 0), 0, 100),
      contactAvailable: Boolean(client.phone || client.whatsapp_phone || client.email),
    },
    appointments: {
      completedLastYear: history.filter((item) => item.status === "completed").length,
      noShowsLastYear: history.filter((item) => item.status === "no_show").length,
      cancellationsLastYear: history.filter((item) => item.status === "canceled").length,
      futureBooked: future.filter((item) => item.status !== "canceled").length,
      futureUnconfirmed: future.filter(
        (item) => item.status !== "canceled" && !item.confirmed_at && item.status !== "confirmed",
      ).length,
    },
    packages: {
      activeWithRemainingSessions: activePackages.length,
      remainingSessions: activePackages.reduce(
        (sum, item) => sum + Math.max(0, Number(item.sessions_total ?? 0) - Number(item.sessions_used ?? 0)),
        0,
      ),
      expiringWithin30Days: activePackages.filter((item) => {
        const expiresAt = dateMs(item.expires_at);
        return expiresAt >= nowMs && expiresAt <= in30Days;
      }).length,
    },
    contacts: {
      attemptsLast60Days: recentContacts.length,
      successfulLast60Days: recentContacts.filter((item) =>
        item.result === "confirmed" || item.result === "call_made"
      ).length,
    },
  };
}

export function interpretRetentionResponse(
  response: JevResponse,
  state: RetentionState,
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): RetentionAdvice {
  const actionAnswer = asRecord(response.answers.action);
  const urgencyAnswer = asRecord(response.answers.urgency);
  const evidenceAnswer = asRecord(response.answers.evidence_sufficient);

  const rawAction = actionAnswer.choice;
  if (typeof rawAction !== "string" || !RETENTION_ACTIONS.includes(rawAction as RetentionAction)) {
    throw new Error("Resposta do Jev sem ação válida");
  }
  if (actionAnswer.type !== "choice" || urgencyAnswer.type !== "score" || evidenceAnswer.type !== "noul") {
    throw new Error("Tipos de resposta do Jev incompatíveis");
  }

  const confidence = unitInterval(actionAnswer.confidence, "confiança");
  const evidenceSufficiency = unitInterval(evidenceAnswer.noul, "suficiência");
  const urgencyScore = numericRange(urgencyAnswer.score, 0, 3, "urgência");

  const needsContact = rawAction !== "monitor" && rawAction !== "human_review";
  const shouldReview =
    confidence < policy.actionConfidenceThreshold ||
    evidenceSufficiency < policy.evidenceSufficiencyThreshold ||
    (needsContact && !state.client.contactAvailable);
  const action: RetentionAction = shouldReview ? "human_review" : (rawAction as RetentionAction);

  return {
    status: action === "human_review" ? "review" : "suggested",
    action,
    actionLabel: ACTION_LABELS[action],
    description: descriptionForAction(action, state),
    urgency: Math.round((urgencyScore / 3) * 100),
    confidence,
    evidenceSufficiency,
    model: response.model,
    evaluatedAt: state.evaluatedAt,
    automaticAction: false,
  };
}

export function parseRetentionPolicy(
  actionConfidence: string | undefined,
  evidenceSufficiency: string | undefined,
): RetentionPolicy {
  return {
    actionConfidenceThreshold: thresholdOrDefault(
      actionConfidence,
      DEFAULT_RETENTION_POLICY.actionConfidenceThreshold,
    ),
    evidenceSufficiencyThreshold: thresholdOrDefault(
      evidenceSufficiency,
      DEFAULT_RETENTION_POLICY.evidenceSufficiencyThreshold,
    ),
  };
}

const ACTION_LABELS: Record<RetentionAction, string> = {
  prioritize_human_contact: "Priorizar contato humano",
  offer_rebooking: "Oferecer novo agendamento",
  remind_pending_package: "Lembrar sessões do pacote",
  monitor: "Acompanhar sem contato agora",
  human_review: "Revisar o caso manualmente",
};

function descriptionForAction(action: RetentionAction, state: RetentionState): string {
  switch (action) {
    case "prioritize_human_contact":
      return state.appointments.futureUnconfirmed > 0
        ? "Há agendamento futuro sem confirmação. Revise o histórico e faça contato manual."
        : "Os sinais de retenção justificam contato humano prioritário, sempre após revisar a ficha."
    case "offer_rebooking":
      return "O ciclo de retorno e a ausência de agenda futura indicam oportunidade de oferecer um novo horário manualmente."
    case "remind_pending_package":
      return `Há ${state.packages.remainingSessions} sessão(ões) restante(s). Confirme a situação antes do contato manual.`;
    case "monitor":
      return "Não há evidência suficiente de urgência para contato agora. Continue acompanhando as métricas."
    case "human_review":
      return "A confiança, a suficiência dos dados ou a disponibilidade de contato exige revisão humana antes de agir."
  }
}

function daysBetween(value: string | null | undefined, now: Date, direction: "past" | "future"): number | null {
  const timestamp = dateMs(value);
  if (!Number.isFinite(timestamp)) return null;
  const delta = direction === "past" ? now.getTime() - timestamp : timestamp - now.getTime();
  return Math.max(0, Math.floor(delta / 86_400_000));
}

function dateMs(value: string | null | undefined): number {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function finiteOrNull(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Resposta do Jev incompleta");
  }
  return value as Record<string, unknown>;
}

function unitInterval(value: unknown, label: string): number {
  return numericRange(value, 0, 1, label);
}

function numericRange(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Resposta do Jev com ${label} inválida`);
  }
  return value;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function thresholdOrDefault(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return fallback;
  return parsed;
}
