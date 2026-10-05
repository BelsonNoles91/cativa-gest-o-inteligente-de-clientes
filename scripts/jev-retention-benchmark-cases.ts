import type { RetentionBenchmarkCase } from "../supabase/functions/retention-advisor/benchmark.ts";
import type { RetentionState } from "../supabase/functions/retention-advisor/logic.ts";

interface StateOverrides {
  client?: Partial<RetentionState["client"]>;
  appointments?: Partial<RetentionState["appointments"]>;
  packages?: Partial<RetentionState["packages"]>;
  contacts?: Partial<RetentionState["contacts"]>;
}

function state(overrides: StateOverrides = {}): RetentionState {
  return {
    evaluatedAt: "2026-10-01T12:00:00.000Z",
    client: {
      isVip: false,
      riskLevel: "low",
      needsReactivation: false,
      daysSinceLastVisit: 8,
      daysUntilNextVisit: null,
      averageCycleDays: 30,
      churnRiskScore: 12,
      contactAvailable: true,
      ...overrides.client,
    },
    appointments: {
      completedLastYear: 6,
      noShowsLastYear: 0,
      cancellationsLastYear: 0,
      futureBooked: 0,
      futureUnconfirmed: 0,
      ...overrides.appointments,
    },
    packages: {
      activeWithRemainingSessions: 0,
      remainingSessions: 0,
      expiringWithin30Days: 0,
      ...overrides.packages,
    },
    contacts: {
      attemptsLast60Days: 0,
      successfulLast60Days: 0,
      ...overrides.contacts,
    },
  };
}

function benchmarkCase(
  id: string,
  scenario: string,
  stateOverrides: StateOverrides,
  primaryAction: RetentionBenchmarkCase["gold"]["primaryAction"],
  urgencyRange: readonly [number, number],
  evidenceSufficient: boolean,
  acceptableActions: readonly RetentionBenchmarkCase["gold"]["primaryAction"][] = [primaryAction],
): RetentionBenchmarkCase {
  return {
    id,
    scenario,
    state: state(stateOverrides),
    gold: { primaryAction, acceptableActions, urgencyRange, evidenceSufficient },
  };
}

/**
 * Small, auditable, synthetic no-PII cases. Gold labels are human-authored
 * hypotheses for measurement, not universal production thresholds.
 */
export const RETENTION_BENCHMARK_CASES: readonly RetentionBenchmarkCase[] = [
  benchmarkCase(
    "monitor-confirmed-future-visit",
    "Baixo risco com próximo horário futuro já confirmado",
    {
      client: { daysSinceLastVisit: 10, daysUntilNextVisit: 7, averageCycleDays: 30, churnRiskScore: 8 },
      appointments: { futureBooked: 1, futureUnconfirmed: 0 },
    },
    "monitor",
    [0, 0],
    true,
  ),
  benchmarkCase(
    "monitor-recent-low-risk",
    "Retorno recente, sem sinal de perda ou pendência operacional",
    {
      client: { daysSinceLastVisit: 4, averageCycleDays: 30, churnRiskScore: 5 },
      appointments: { completedLastYear: 4 },
    },
    "monitor",
    [0, 1],
    true,
  ),
  benchmarkCase(
    "rebooking-cycle-overdue",
    "Ciclo habitual vencido, sem atendimento futuro ou outro alerta",
    {
      client: { daysSinceLastVisit: 42, averageCycleDays: 30, churnRiskScore: 35 },
      appointments: { completedLastYear: 5, cancellationsLastYear: 1 },
    },
    "offer_rebooking",
    [1, 2],
    true,
  ),
  benchmarkCase(
    "rebooking-long-overdue",
    "Retorno muito atrasado, sem horário futuro e com canal disponível",
    {
      client: { daysSinceLastVisit: 95, averageCycleDays: 35, churnRiskScore: 54 },
      appointments: { completedLastYear: 7, futureBooked: 0 },
    },
    "offer_rebooking",
    [2, 3],
    true,
  ),
  benchmarkCase(
    "priority-unconfirmed-appointment",
    "Horário futuro ainda não confirmado",
    {
      client: { daysSinceLastVisit: 5, daysUntilNextVisit: 1, averageCycleDays: 30, churnRiskScore: 15 },
      appointments: { futureBooked: 1, futureUnconfirmed: 1 },
    },
    "prioritize_human_contact",
    [2, 3],
    true,
  ),
  benchmarkCase(
    "priority-recurrent-no-shows",
    "Histórico de faltas recorrentes sem horário futuro",
    {
      client: { daysSinceLastVisit: 60, averageCycleDays: 30, churnRiskScore: 45 },
      appointments: { noShowsLastYear: 2, futureBooked: 0 },
    },
    "prioritize_human_contact",
    [2, 3],
    true,
  ),
  benchmarkCase(
    "priority-high-churn-score",
    "Indicador de risco elevado com histórico coerente",
    {
      client: { daysSinceLastVisit: 38, averageCycleDays: 30, churnRiskScore: 84 },
      appointments: { completedLastYear: 5, futureBooked: 0 },
    },
    "prioritize_human_contact",
    [2, 3],
    true,
  ),
  benchmarkCase(
    "priority-high-risk-level",
    "Faixa de risco alta sem agendamento futuro",
    {
      client: { riskLevel: "high", daysSinceLastVisit: 31, averageCycleDays: 30, churnRiskScore: 65 },
      appointments: { completedLastYear: 4, futureBooked: 0 },
    },
    "prioritize_human_contact",
    [1, 3],
    true,
  ),
  benchmarkCase(
    "remind-package-expiring",
    "Pacote ativo com sessões restantes e vencimento próximo",
    {
      client: { daysSinceLastVisit: 12, churnRiskScore: 10 },
      packages: { activeWithRemainingSessions: 1, remainingSessions: 2, expiringWithin30Days: 1 },
    },
    "remind_pending_package",
    [1, 2],
    true,
  ),
  benchmarkCase(
    "remind-package-multiple-sessions",
    "Mais de um pacote ativo com sessões disponíveis",
    {
      packages: { activeWithRemainingSessions: 2, remainingSessions: 5, expiringWithin30Days: 1 },
    },
    "remind_pending_package",
    [1, 2],
    true,
  ),
  benchmarkCase(
    "review-no-contact-channel",
    "Retorno vencido sem canal disponível para contato",
    {
      client: {
        daysSinceLastVisit: 51,
        averageCycleDays: 30,
        churnRiskScore: 25,
        contactAvailable: false,
      },
    },
    "human_review",
    [1, 2],
    false,
    ["human_review", "monitor"],
  ),
  benchmarkCase(
    "review-reactivation-conflicts-with-confirmed-booking",
    "Sinal de reativação ativo apesar de horário futuro confirmado",
    {
      client: { needsReactivation: true, daysUntilNextVisit: 6, churnRiskScore: 20 },
      appointments: { futureBooked: 1, futureUnconfirmed: 0 },
    },
    "human_review",
    [0, 1],
    false,
    ["human_review", "monitor"],
  ),
  benchmarkCase(
    "review-impossible-package-counters",
    "Resumo de pacote contraditório exige revisão antes de agir",
    {
      packages: { activeWithRemainingSessions: 0, remainingSessions: 3, expiringWithin30Days: 1 },
    },
    "human_review",
    [0, 1],
    false,
    ["human_review", "monitor"],
  ),
  benchmarkCase(
    "review-unconfirmed-without-contact",
    "Horário sem confirmação, porém sem canal de contato disponível",
    {
      client: { daysUntilNextVisit: 1, contactAvailable: false, churnRiskScore: 10 },
      appointments: { futureBooked: 1, futureUnconfirmed: 1 },
    },
    "human_review",
    [1, 3],
    false,
    ["human_review", "monitor"],
  ),
];
