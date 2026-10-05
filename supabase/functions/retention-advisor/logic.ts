import type { JevResponse } from "../_shared/jev.ts";

export const RETENTION_ACTIONS = [
  "prioritize_human_contact",
  "offer_rebooking",
  "remind_pending_package",
  "monitor",
  "human_review",
] as const;

export type RetentionAction = (typeof RETENTION_ACTIONS)[number];
export type RetentionUrgencyLevel = "none" | "low" | "moderate" | "high" | "uncertain";

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
  urgencyLevel: RetentionUrgencyLevel;
  confidence: number;
  evidenceSufficiency: number;
  model: string;
  evaluatedAt: string;
  automaticAction: false;
}

export interface RetentionPolicy {
  actionConfidenceThreshold: number;
  evidenceSufficiencyThreshold: number;
  urgencyConfidenceThreshold: number;
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  actionConfidenceThreshold: 0.6,
  evidenceSufficiencyThreshold: 0.65,
  urgencyConfidenceThreshold: 0.6,
};

const PROBABILITY_SUM_TOLERANCE = 0.01;
const CHOICE_PROBABILITY_TOLERANCE = 0.01;
// Jev rounds Score and each probability independently to two decimals.
const SCORE_ROUNDING_TOLERANCE = 0.020001;
// Confidence and probabilities are also rounded independently by the API.
const CHOICE_CONFIDENCE_TOLERANCE = 0.020001;
const SCORE_CONFIDENCE_TOLERANCE = 0.030001;

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
  const recentContacts = contacts.filter((item) => {
    const attemptedAt = dateMs(item.attempted_at);
    return attemptedAt >= cutoff60Days && attemptedAt <= nowMs;
  });

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
  if (typeof response?.model !== "string" || response.model.trim() === "") {
    throw new Error("Resposta do Jev sem modelo válido");
  }
  const answers = asRecord(response.answers);
  const actionAnswer = asRecord(answers.action);
  const urgencyAnswer = asRecord(answers.urgency);
  const evidenceAnswer = asRecord(answers.evidence_sufficient);

  const rawAction = actionAnswer.choice;
  if (!isRetentionAction(rawAction)) {
    throw new Error("Resposta do Jev sem ação válida");
  }
  if (actionAnswer.type !== "choice" || urgencyAnswer.type !== "score" || evidenceAnswer.type !== "noul") {
    throw new Error("Tipos de resposta do Jev incompatíveis");
  }

  const confidence = unitInterval(actionAnswer.confidence, "confiança");
  const evidenceSufficiency = unitInterval(evidenceAnswer.noul, "suficiência");
  const urgencyScore = numericRange(urgencyAnswer.score, 0, 3, "urgência");
  const urgencyConfidence = unitInterval(urgencyAnswer.confidence, "confiança da urgência");

  const actionProbabilities = probabilityDistribution(
    actionAnswer.probabilities,
    RETENTION_ACTIONS,
    "ação",
  );
  const selectedActionProbability = actionProbabilities[rawAction];
  if (
    selectedActionProbability <
    Math.max(...Object.values(actionProbabilities)) - CHOICE_PROBABILITY_TOLERANCE
  ) {
    throw new Error("Resposta do Jev com ação incompatível com as probabilidades");
  }
  if (
    Math.abs(confidence - choiceConfidence(Object.values(actionProbabilities))) >
    CHOICE_CONFIDENCE_TOLERANCE
  ) {
    throw new Error("Resposta do Jev com confiança da ação incompatível com as probabilidades");
  }

  const urgencyLevels = ["0", "1", "2", "3"] as const;
  const urgencyProbabilities = probabilityDistribution(
    urgencyAnswer.probabilities,
    urgencyLevels,
    "urgência",
  );
  const legend = asRecord(urgencyAnswer.legend);
  if (
    Object.keys(legend).length !== urgencyLevels.length ||
    urgencyLevels.some((level) => typeof legend[level] !== "string" || !legend[level].trim())
  ) {
    throw new Error("Resposta do Jev com legenda de urgência inválida");
  }
  const urgencyProbabilityTotal = urgencyLevels.reduce(
    (total, level) => total + urgencyProbabilities[level],
    0,
  );
  const expectedUrgency = urgencyLevels.reduce(
    (total, level) => total + Number(level) * urgencyProbabilities[level],
    0,
  ) / urgencyProbabilityTotal;
  if (Math.abs(urgencyScore - expectedUrgency) > SCORE_ROUNDING_TOLERANCE) {
    throw new Error("Resposta do Jev com score de urgência incompatível com as probabilidades");
  }
  if (
    !scoreConfidenceCandidates(urgencyLevels.map((level) => urgencyProbabilities[level])).some(
      (expectedConfidence) => Math.abs(urgencyConfidence - expectedConfidence) <= SCORE_CONFIDENCE_TOLERANCE,
    )
  ) {
    throw new Error("Resposta do Jev com confiança da urgência incompatível com as probabilidades");
  }

  const highestUrgencyProbability = Math.max(...Object.values(urgencyProbabilities));
  const mostLikelyUrgencyLevels = urgencyLevels.filter(
    (level) => highestUrgencyProbability - urgencyProbabilities[level] <= CHOICE_PROBABILITY_TOLERANCE,
  );
  const urgencyUncertain =
    urgencyConfidence < policy.urgencyConfidenceThreshold || mostLikelyUrgencyLevels.length !== 1;
  const urgencyLevel: RetentionUrgencyLevel = urgencyUncertain
    ? "uncertain"
    : (["none", "low", "moderate", "high"] as const)[Number(mostLikelyUrgencyLevels[0])];

  const needsContact = rawAction !== "monitor" && rawAction !== "human_review";
  const shouldReview =
    confidence < policy.actionConfidenceThreshold ||
    urgencyUncertain ||
    evidenceSufficiency < policy.evidenceSufficiencyThreshold ||
    (needsContact && !state.client.contactAvailable) ||
    hasConflictingRetentionSignals(state) ||
    !isActionSupportedByState(rawAction, state);
  const action: RetentionAction = shouldReview ? "human_review" : rawAction;

  return {
    status: action === "human_review" ? "review" : "suggested",
    action,
    actionLabel: ACTION_LABELS[action],
    description: descriptionForAction(action, state),
    urgencyLevel,
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
  urgencyConfidence?: string,
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
    urgencyConfidenceThreshold: thresholdOrDefault(
      urgencyConfidence,
      DEFAULT_RETENTION_POLICY.urgencyConfidenceThreshold,
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

export function hasConflictingRetentionSignals(state: RetentionState): boolean {
  const { appointments, packages, client } = state;
  return (
    appointments.futureUnconfirmed > appointments.futureBooked ||
    (client.needsReactivation && appointments.futureBooked > 0 && appointments.futureUnconfirmed === 0) ||
    (packages.activeWithRemainingSessions === 0 &&
      (packages.remainingSessions > 0 || packages.expiringWithin30Days > 0)) ||
    packages.expiringWithin30Days > packages.activeWithRemainingSessions
  );
}

export function isActionSupportedByState(action: RetentionAction, state: RetentionState): boolean {
  switch (action) {
    case "prioritize_human_contact":
      return state.client.needsReactivation ||
        state.client.riskLevel.toLowerCase() === "high" ||
        state.client.churnRiskScore >= 70 ||
        state.appointments.futureUnconfirmed > 0 ||
        state.appointments.noShowsLastYear >= 2;
    case "offer_rebooking":
      return state.client.daysSinceLastVisit !== null &&
        state.client.averageCycleDays !== null &&
        state.client.daysSinceLastVisit > state.client.averageCycleDays &&
        state.appointments.futureBooked === 0;
    case "remind_pending_package":
      return state.packages.activeWithRemainingSessions > 0 && state.packages.remainingSessions > 0;
    case "monitor":
    case "human_review":
      return true;
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
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
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

function isRetentionAction(value: unknown): value is RetentionAction {
  return typeof value === "string" && RETENTION_ACTIONS.some((action) => action === value);
}

function probabilityDistribution<K extends string>(
  value: unknown,
  expectedKeys: readonly K[],
  label: string,
): Record<K, number> {
  const probabilities = asRecord(value);
  const keys = Object.keys(probabilities);
  if (
    keys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(probabilities, key))
  ) {
    throw new Error(`Resposta do Jev com distribuição de probabilidade de ${label} incompleta`);
  }

  const validated = {} as Record<K, number>;
  let total = 0;
  for (const key of expectedKeys) {
    const probability = numericRange(probabilities[key], 0, 1, `probabilidade de ${label}`);
    validated[key] = probability;
    total += probability;
  }
  if (Math.abs(total - 1) > PROBABILITY_SUM_TOLERANCE) {
    throw new Error(`Resposta do Jev com probabilidades de ${label} que não totalizam 1`);
  }
  return validated;
}

function choiceConfidence(probabilities: readonly number[]): number {
  const optionCount = probabilities.length;
  if (optionCount < 2) return 1;
  return (Math.max(...probabilities) - 1 / optionCount) / (1 - 1 / optionCount);
}

function scoreConfidenceCandidates(probabilities: readonly number[]): number[] {
  const levelCount = probabilities.length;
  const mostLikelyProbability = Math.max(...probabilities);
  const uniformMeanAbsoluteDeviation = probabilities.reduce(
    (total, _probability, index) => total + Math.abs(index - (levelCount - 1) / 2),
    0,
  ) / levelCount;
  if (uniformMeanAbsoluteDeviation === 0) return [1];

  return probabilities.flatMap((probability, mode) => {
    if (probability !== mostLikelyProbability) return [];
    const expectedDistance = probabilities.reduce(
      (total, candidateProbability, index) =>
        total + candidateProbability * Math.abs(index - mode),
      0,
    );
    return [Math.max(0, 1 - expectedDistance / uniformMeanAbsoluteDeviation)];
  });
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
