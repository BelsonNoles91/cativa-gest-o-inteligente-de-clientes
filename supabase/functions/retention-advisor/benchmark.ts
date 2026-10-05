import type { JevResponse } from "../_shared/jev.ts";
import {
  hasConflictingRetentionSignals,
  interpretRetentionResponse,
  isActionSupportedByState,
  RETENTION_ACTIONS,
  RETENTION_QUESTIONS,
  type RetentionAction,
  type RetentionAdvice,
  type RetentionState,
} from "./logic.ts";

export const RETENTION_BENCHMARK_VERSION = "cativa-retention-v1";

export type RetentionBenchmarkVariant = "production" | "reversed-action-order";

export interface RetentionBenchmarkCase {
  id: string;
  scenario: string;
  state: RetentionState;
  gold: {
    primaryAction: RetentionAction;
    acceptableActions: readonly RetentionAction[];
    urgencyRange: readonly [number, number];
    evidenceSufficient: boolean;
  };
}

export interface RetentionBenchmarkObservation {
  caseId: string;
  replicate: number;
  variant: RetentionBenchmarkVariant;
  response: JevResponse;
  latencyMs: number;
}

export interface RetentionBenchmarkMetadata {
  runId: string;
  startedAt: string;
  completedAt: string;
  corpusSha256: string;
  questionsSha256: string;
  plannedReplicates: number;
  variants: readonly RetentionBenchmarkVariant[];
  providerFailure?: {
    caseId: string;
    replicate: number;
    variant: RetentionBenchmarkVariant;
    status: number | null;
    error: string;
  };
  responseValidationFailure?: {
    caseId: string;
    replicate: number;
    variant: RetentionBenchmarkVariant;
    error: string;
  };
}

export interface RetentionBenchmarkResult {
  caseId: string;
  replicate: number;
  variant: RetentionBenchmarkVariant;
  model: string;
  expectedAction: RetentionAction;
  acceptableActions: RetentionAction[];
  selectedAction: RetentionAction;
  effectiveAction: RetentionAction;
  actionProbabilities: Record<RetentionAction, number>;
  confidence: number;
  selectedActionCorrect: boolean;
  selectedActionAcceptable: boolean;
  effectiveActionAcceptable: boolean;
  acceptableActionProbability: number;
  normalizedActionBrier: number;
  urgencyScore: number;
  urgencyRange: [number, number];
  urgencyRangeError: number;
  evidenceProbability: number;
  expectedEvidenceSufficient: boolean;
  evidenceBrier: number;
  recommendationStatus: RetentionAdvice["status"];
  automaticAction: false;
  safeAppliedRecommendation: boolean;
  latencyMs: number;
  usage: JevResponse["usage"];
}

export interface RetentionBenchmarkReport {
  schemaVersion: 1;
  benchmarkVersion: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  corpusSha256: string;
  questionsSha256: string;
  modelVersions: string[];
  plannedReplicates: number;
  variants: RetentionBenchmarkVariant[];
  coverage: {
    expectedObservations: number;
    completedObservations: number;
    missingObservations: string[];
    complete: boolean;
  };
  qualityThresholds: "not-calibrated-on-domain-data";
  metrics: {
    primaryActionAccuracy: number | null;
    acceptableActionRate: number | null;
    effectiveActionAcceptableRate: number | null;
    meanProbabilityMassOnAcceptableActions: number | null;
    meanNormalizedActionBrier: number | null;
    urgencyRangeMeanAbsoluteError: number | null;
    evidenceNoulBrier: number | null;
    meanConfidence: number | null;
    humanReviewRate: number | null;
    meanLatencyMs: number | null;
    p95LatencyMs: number | null;
  };
  stability: {
    pairCount: number;
    actionAgreementRate: number | null;
    meanActionProbabilityTotalVariation: number | null;
    meanUrgencyAbsoluteShift: number | null;
    meanEvidenceAbsoluteShift: number | null;
  };
  choiceOrderProbe: {
    status: "measured" | "not-run";
    pairedObservations: number;
    actionFlipRate: number | null;
    meanProbabilityTotalVariation: number | null;
  };
  safety: {
    automaticActionViolations: number;
    unsupportedRecommendations: number;
    passed: boolean;
  };
  usage: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
  };
  privacy: {
    syntheticNoPii: true;
    rawStateIncluded: false;
    apiKeyIncluded: false;
  };
  providerFailure?: RetentionBenchmarkMetadata["providerFailure"];
  responseValidationFailure?: RetentionBenchmarkMetadata["responseValidationFailure"];
  results: RetentionBenchmarkResult[];
}

const ACTIONS_REQUIRING_CONTACT = new Set<RetentionAction>([
  "prioritize_human_contact",
  "offer_rebooking",
  "remind_pending_package",
]);

export function retentionQuestionsForVariant(variant: RetentionBenchmarkVariant) {
  if (variant === "production") return RETENTION_QUESTIONS;

  const criteria = Object.fromEntries(Object.entries(RETENTION_QUESTIONS.action.criteria).reverse());
  return {
    ...RETENTION_QUESTIONS,
    action: { ...RETENTION_QUESTIONS.action, criteria },
  };
}

export function validateRetentionBenchmarkCases(cases: readonly RetentionBenchmarkCase[]): void {
  if (cases.length === 0) throw new Error("O benchmark Jev precisa de ao menos um caso");
  const ids = new Set<string>();
  for (const benchmarkCase of cases) {
    if (!/^[a-z0-9-]+$/.test(benchmarkCase.id) || ids.has(benchmarkCase.id)) {
      throw new Error(`ID de caso Jev inválido ou repetido: ${benchmarkCase.id}`);
    }
    ids.add(benchmarkCase.id);
    if (!benchmarkCase.scenario.trim()) throw new Error(`Caso ${benchmarkCase.id} sem cenário`);
    assertNoDirectIdentifiers(benchmarkCase);
    if (!benchmarkCase.gold.acceptableActions.includes(benchmarkCase.gold.primaryAction)) {
      throw new Error(`Caso ${benchmarkCase.id} não aceita sua ação principal`);
    }
    if (
      benchmarkCase.gold.acceptableActions.length === 0 ||
      benchmarkCase.gold.acceptableActions.some((action) => !RETENTION_ACTIONS.includes(action))
    ) {
      throw new Error(`Caso ${benchmarkCase.id} contém ações aceitáveis inválidas`);
    }
    const [minimum, maximum] = benchmarkCase.gold.urgencyRange;
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum < 0 || maximum > 3 || minimum > maximum) {
      throw new Error(`Caso ${benchmarkCase.id} contém faixa de urgência inválida`);
    }
  }
}

function assertNoDirectIdentifiers(benchmarkCase: RetentionBenchmarkCase): void {
  const serialized = JSON.stringify({ scenario: benchmarkCase.scenario, state: benchmarkCase.state });
  const emailLike = /\b[^\s@]+@[^\s@]+\.[A-Za-z]{2,}\b/;
  const phoneLike = /(?:\+?\d[\s().-]*){10,}\d/;
  const forbiddenKeys = /^(?:id|uuid|name|fullName|email|phone|whatsApp|address|cpf|document|birthDate|clientId|tenantId|unitId|professionalId)$/i;
  const visit = (value: unknown): string | null => {
    if (!value || typeof value !== "object") return null;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = visit(entry);
        if (found) return found;
      }
      return null;
    }
    for (const [key, entry] of Object.entries(value)) {
      if (forbiddenKeys.test(key)) return key;
      const found = visit(entry);
      if (found) return found;
    }
    return null;
  };

  const identifierField = visit(benchmarkCase.state);
  if (identifierField) {
    throw new Error(`Caso ${benchmarkCase.id} contém campo identificável (${identifierField})`);
  }
  if (emailLike.test(serialized) || phoneLike.test(serialized)) {
    throw new Error(`Caso ${benchmarkCase.id} parece conter e-mail ou telefone; use somente dados sintéticos`);
  }
}

export function buildRetentionBenchmarkReport(
  cases: readonly RetentionBenchmarkCase[],
  observations: readonly RetentionBenchmarkObservation[],
  metadata: RetentionBenchmarkMetadata,
): RetentionBenchmarkReport {
  validateRetentionBenchmarkCases(cases);
  if (!Number.isInteger(metadata.plannedReplicates) || metadata.plannedReplicates < 1) {
    throw new Error("plannedReplicates deve ser um inteiro positivo");
  }
  if (metadata.variants.length === 0 || new Set(metadata.variants).size !== metadata.variants.length) {
    throw new Error("O benchmark precisa de variantes únicas");
  }

  const caseById = new Map(cases.map((benchmarkCase) => [benchmarkCase.id, benchmarkCase]));
  const seen = new Set<string>();
  const results = observations.map((observation): RetentionBenchmarkResult => {
    const benchmarkCase = caseById.get(observation.caseId);
    if (!benchmarkCase) throw new Error(`Observação Jev para caso desconhecido: ${observation.caseId}`);
    if (
      !Number.isInteger(observation.replicate) ||
      observation.replicate < 1 ||
      observation.replicate > metadata.plannedReplicates ||
      !metadata.variants.includes(observation.variant) ||
      !Number.isFinite(observation.latencyMs) ||
      observation.latencyMs < 0
    ) {
      throw new Error(`Metadados inválidos na observação ${observation.caseId}`);
    }
    const observationKey = `${observation.caseId}:${observation.replicate}:${observation.variant}`;
    if (seen.has(observationKey)) throw new Error(`Observação Jev duplicada: ${observationKey}`);
    seen.add(observationKey);

    const advice = interpretRetentionResponse(observation.response, benchmarkCase.state);
    const actionAnswer = record(observation.response.answers.action);
    const urgencyAnswer = record(observation.response.answers.urgency);
    const evidenceAnswer = record(observation.response.answers.evidence_sufficient);
    const selectedAction = actionAnswer.choice as RetentionAction;
    const effectiveAction = advice.action;
    const actionProbabilities = Object.fromEntries(
      RETENTION_ACTIONS.map((action) => [action, actionProbability(actionAnswer, action)]),
    ) as Record<RetentionAction, number>;
    const acceptableActionProbability = benchmarkCase.gold.acceptableActions.reduce(
      (total, action) => total + actionProbabilities[action],
      0,
    );
    const normalizedActionBrier = RETENTION_ACTIONS.reduce((total, action) => {
      const target = action === benchmarkCase.gold.primaryAction ? 1 : 0;
      return total + (actionProbabilities[action] - target) ** 2;
    }, 0) / 2;
    const urgencyScore = urgencyAnswer.score as number;
    const [urgencyMinimum, urgencyMaximum] = benchmarkCase.gold.urgencyRange;
    const urgencyRangeError = Math.max(urgencyMinimum - urgencyScore, 0, urgencyScore - urgencyMaximum);
    const evidenceProbability = evidenceAnswer.noul as number;
    const evidenceTarget = benchmarkCase.gold.evidenceSufficient ? 1 : 0;
    const safeAppliedRecommendation =
      effectiveAction === "human_review" || (
        !hasConflictingRetentionSignals(benchmarkCase.state) &&
        isActionSupportedByState(effectiveAction, benchmarkCase.state) &&
        (!ACTIONS_REQUIRING_CONTACT.has(effectiveAction) || benchmarkCase.state.client.contactAvailable)
      );

    return {
      caseId: observation.caseId,
      replicate: observation.replicate,
      variant: observation.variant,
      model: observation.response.model,
      expectedAction: benchmarkCase.gold.primaryAction,
      acceptableActions: [...benchmarkCase.gold.acceptableActions],
      selectedAction,
      effectiveAction,
      actionProbabilities,
      confidence: advice.confidence,
      selectedActionCorrect: selectedAction === benchmarkCase.gold.primaryAction,
      selectedActionAcceptable: benchmarkCase.gold.acceptableActions.includes(selectedAction),
      effectiveActionAcceptable: benchmarkCase.gold.acceptableActions.includes(effectiveAction),
      acceptableActionProbability,
      normalizedActionBrier,
      urgencyScore,
      urgencyRange: [urgencyMinimum, urgencyMaximum],
      urgencyRangeError,
      evidenceProbability,
      expectedEvidenceSufficient: benchmarkCase.gold.evidenceSufficient,
      evidenceBrier: (evidenceProbability - evidenceTarget) ** 2,
      recommendationStatus: advice.status,
      automaticAction: advice.automaticAction,
      safeAppliedRecommendation,
      latencyMs: observation.latencyMs,
      usage: observation.response.usage,
    };
  });

  const expectedKeys = new Set<string>();
  for (const benchmarkCase of cases) {
    for (let replicate = 1; replicate <= metadata.plannedReplicates; replicate += 1) {
      for (const variant of metadata.variants) expectedKeys.add(`${benchmarkCase.id}:${replicate}:${variant}`);
    }
  }
  const missingObservations = [...expectedKeys].filter((key) => !seen.has(key)).sort();
  const stability = calculateStability(results);
  const choiceOrderProbe = calculateChoiceOrderProbe(results);
  const automaticActionViolations = results.filter((result) => result.automaticAction !== false).length;
  const unsupportedRecommendations = results.filter((result) => !result.safeAppliedRecommendation).length;

  return {
    schemaVersion: 1,
    benchmarkVersion: RETENTION_BENCHMARK_VERSION,
    runId: metadata.runId,
    startedAt: metadata.startedAt,
    completedAt: metadata.completedAt,
    corpusSha256: metadata.corpusSha256,
    questionsSha256: metadata.questionsSha256,
    modelVersions: [...new Set(results.map((result) => result.model))].sort(),
    plannedReplicates: metadata.plannedReplicates,
    variants: [...metadata.variants],
    coverage: {
      expectedObservations: expectedKeys.size,
      completedObservations: results.length,
      missingObservations,
      complete:
        missingObservations.length === 0 &&
        metadata.providerFailure === undefined &&
        metadata.responseValidationFailure === undefined,
    },
    qualityThresholds: "not-calibrated-on-domain-data",
    metrics: {
      primaryActionAccuracy: mean(results.map((result) => Number(result.selectedActionCorrect))),
      acceptableActionRate: mean(results.map((result) => Number(result.selectedActionAcceptable))),
      effectiveActionAcceptableRate: mean(results.map((result) => Number(result.effectiveActionAcceptable))),
      meanProbabilityMassOnAcceptableActions: mean(results.map((result) => result.acceptableActionProbability)),
      meanNormalizedActionBrier: mean(results.map((result) => result.normalizedActionBrier)),
      urgencyRangeMeanAbsoluteError: mean(results.map((result) => result.urgencyRangeError)),
      evidenceNoulBrier: mean(results.map((result) => result.evidenceBrier)),
      meanConfidence: mean(results.map((result) => result.confidence)),
      humanReviewRate: mean(results.map((result) => Number(result.recommendationStatus === "review"))),
      meanLatencyMs: mean(results.map((result) => result.latencyMs)),
      p95LatencyMs: percentile(results.map((result) => result.latencyMs), 0.95),
    },
    stability,
    choiceOrderProbe,
    safety: {
      automaticActionViolations,
      unsupportedRecommendations,
      passed: automaticActionViolations === 0 && unsupportedRecommendations === 0,
    },
    usage: {
      requests: results.length,
      inputTokens: results.reduce((total, result) => total + result.usage.input_tokens, 0),
      outputTokens: results.reduce((total, result) => total + result.usage.output_tokens, 0),
    },
    privacy: {
      syntheticNoPii: true,
      rawStateIncluded: false,
      apiKeyIncluded: false,
    },
    ...(metadata.providerFailure ? { providerFailure: metadata.providerFailure } : {}),
    ...(metadata.responseValidationFailure
      ? { responseValidationFailure: metadata.responseValidationFailure }
      : {}),
    results,
  };
}

export function compareRetentionBenchmarkReports(
  current: RetentionBenchmarkReport,
  baseline: RetentionBenchmarkReport,
) {
  if (
    current.schemaVersion !== 1 ||
    baseline.schemaVersion !== 1 ||
    current.benchmarkVersion !== baseline.benchmarkVersion ||
    current.corpusSha256 !== baseline.corpusSha256 ||
    current.questionsSha256 !== baseline.questionsSha256
  ) {
    throw new Error("Não é possível comparar benchmarks Jev com schema, corpus ou perguntas diferentes");
  }
  const baselineByKey = indexCompleteReport(baseline);
  const currentByKey = indexCompleteReport(current);
  if (
    baseline.plannedReplicates !== current.plannedReplicates ||
    JSON.stringify([...baseline.variants].sort()) !== JSON.stringify([...current.variants].sort()) ||
    baseline.coverage.expectedObservations !== current.coverage.expectedObservations
  ) {
    throw new Error("As execuções Jev têm planos ou cobertura diferentes");
  }
  if (
    baselineByKey.size !== currentByKey.size ||
    [...baselineByKey.keys()].some((key) => !currentByKey.has(key))
  ) {
    throw new Error("As execuções Jev não têm as mesmas observações pareadas");
  }

  const paired = [...currentByKey.entries()].map(([key, currentResult]) => {
    const baselineResult = baselineByKey.get(key)!;
    return {
      key,
      actionChanged: currentResult.selectedAction !== baselineResult.selectedAction,
      actionProbabilityTotalVariation: totalVariation(
        currentResult.actionProbabilities,
        baselineResult.actionProbabilities,
      ),
      urgencyAbsoluteShift: Math.abs(currentResult.urgencyScore - baselineResult.urgencyScore),
      evidenceAbsoluteShift: Math.abs(currentResult.evidenceProbability - baselineResult.evidenceProbability),
    };
  });
  const currentModels = [...current.modelVersions].sort();
  const baselineModels = [...baseline.modelVersions].sort();

  return {
    status: "informational-no-calibrated-drift-threshold" as const,
    pairedObservations: paired.length,
    modelVersionChanged: JSON.stringify(currentModels) !== JSON.stringify(baselineModels),
    actionFlipRate: mean(paired.map((entry) => Number(entry.actionChanged))),
    meanActionProbabilityTotalVariation: mean(paired.map((entry) => entry.actionProbabilityTotalVariation)),
    meanUrgencyAbsoluteShift: mean(paired.map((entry) => entry.urgencyAbsoluteShift)),
    meanEvidenceAbsoluteShift: mean(paired.map((entry) => entry.evidenceAbsoluteShift)),
    pairs: paired,
  };
}

function indexCompleteReport(report: RetentionBenchmarkReport): Map<string, RetentionBenchmarkResult> {
  if (
    report.coverage.complete !== true ||
    !Number.isInteger(report.plannedReplicates) ||
    report.plannedReplicates < 1 ||
    report.variants.length === 0 ||
    new Set(report.variants).size !== report.variants.length ||
    report.coverage.expectedObservations !== report.coverage.completedObservations ||
    report.coverage.completedObservations !== report.results.length ||
    report.coverage.missingObservations.length !== 0
  ) {
    throw new Error("Comparação de drift exige duas execuções completas e consistentes");
  }

  const byKey = new Map<string, RetentionBenchmarkResult>();
  for (const result of report.results) {
    if (
      !Number.isInteger(result.replicate) ||
      result.replicate < 1 ||
      result.replicate > report.plannedReplicates ||
      !report.variants.includes(result.variant)
    ) {
      throw new Error("Relatório Jev contém observação fora do plano declarado");
    }
    const key = resultKey(result);
    if (byKey.has(key)) throw new Error("Relatório Jev contém observações duplicadas");
    byKey.set(key, result);
  }

  const caseIds = new Set(report.results.map((result) => result.caseId));
  const expectedKeys = new Set<string>();
  for (const caseId of caseIds) {
    for (let replicate = 1; replicate <= report.plannedReplicates; replicate += 1) {
      for (const variant of report.variants) expectedKeys.add(`${caseId}:${replicate}:${variant}`);
    }
  }
  if (
    expectedKeys.size !== report.coverage.expectedObservations ||
    [...expectedKeys].some((key) => !byKey.has(key))
  ) {
    throw new Error("Relatório Jev declara cobertura completa, mas falta observação planejada");
  }
  return byKey;
}

function calculateStability(results: readonly RetentionBenchmarkResult[]) {
  const groups = new Map<string, RetentionBenchmarkResult[]>();
  for (const result of results) {
    const key = `${result.caseId}:${result.variant}`;
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }
  const pairs: Array<{
    actionAgrees: boolean;
    probabilityVariation: number;
    urgencyShift: number;
    evidenceShift: number;
  }> = [];
  for (const group of groups.values()) {
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        pairs.push({
          actionAgrees: group[left].selectedAction === group[right].selectedAction,
          probabilityVariation: totalVariation(group[left].actionProbabilities, group[right].actionProbabilities),
          urgencyShift: Math.abs(group[left].urgencyScore - group[right].urgencyScore),
          evidenceShift: Math.abs(group[left].evidenceProbability - group[right].evidenceProbability),
        });
      }
    }
  }
  return {
    pairCount: pairs.length,
    actionAgreementRate: mean(pairs.map((pair) => Number(pair.actionAgrees))),
    meanActionProbabilityTotalVariation: mean(pairs.map((pair) => pair.probabilityVariation)),
    meanUrgencyAbsoluteShift: mean(pairs.map((pair) => pair.urgencyShift)),
    meanEvidenceAbsoluteShift: mean(pairs.map((pair) => pair.evidenceShift)),
  };
}

function calculateChoiceOrderProbe(results: readonly RetentionBenchmarkResult[]) {
  const production = new Map(
    results.filter((result) => result.variant === "production").map((result) => [replicateKey(result), result]),
  );
  const reversed = new Map(
    results.filter((result) => result.variant === "reversed-action-order")
      .map((result) => [replicateKey(result), result]),
  );
  const paired = [...production.entries()]
    .filter(([key]) => reversed.has(key))
    .map(([key, left]) => ({ left, right: reversed.get(key)! }));
  return {
    status: paired.length > 0 ? "measured" as const : "not-run" as const,
    pairedObservations: paired.length,
    actionFlipRate: mean(paired.map(({ left, right }) => Number(left.selectedAction !== right.selectedAction))),
    meanProbabilityTotalVariation: mean(
      paired.map(({ left, right }) => totalVariation(left.actionProbabilities, right.actionProbabilities)),
    ),
  };
}

function actionProbability(answer: Record<string, unknown>, action: RetentionAction): number {
  const probabilities = record(answer.probabilities);
  const value = probabilities[action];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Distribuição Jev sem probabilidade numérica para ${action}`);
  }
  return value;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Resposta Jev inválida durante a avaliação do benchmark");
  }
  return value as Record<string, unknown>;
}

function totalVariation(
  left: Record<RetentionAction, number>,
  right: Record<RetentionAction, number>,
): number {
  return RETENTION_ACTIONS.reduce((sum, action) => sum + Math.abs(left[action] - right[action]), 0) / 2;
}

function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: readonly number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.max(0, Math.ceil(quantile * ordered.length) - 1)];
}

function resultKey(result: RetentionBenchmarkResult): string {
  return `${result.caseId}:${result.replicate}:${result.variant}`;
}

function replicateKey(result: RetentionBenchmarkResult): string {
  return `${result.caseId}:${result.replicate}`;
}
