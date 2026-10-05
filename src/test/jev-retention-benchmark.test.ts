import { describe, expect, it } from "vitest";
import type { JevResponse } from "../../supabase/functions/_shared/jev";
import {
  buildRetentionBenchmarkReport,
  compareRetentionBenchmarkReports,
  retentionQuestionsForVariant,
  RETENTION_BENCHMARK_VERSION,
  type RetentionBenchmarkCase,
  type RetentionBenchmarkObservation,
  type RetentionBenchmarkReport,
  validateRetentionBenchmarkCases,
} from "../../supabase/functions/retention-advisor/benchmark";
import { RETENTION_ACTIONS } from "../../supabase/functions/retention-advisor/logic";
import { RETENTION_BENCHMARK_CASES } from "../../scripts/jev-retention-benchmark-cases";

const metadata = {
  runId: "synthetic-run",
  startedAt: "2026-10-01T12:00:00.000Z",
  completedAt: "2026-10-01T12:00:01.000Z",
  corpusSha256: "a".repeat(64),
  questionsSha256: "b".repeat(64),
  plannedReplicates: 1,
  variants: ["production"] as const,
};

function responseFor(
  benchmarkCase: RetentionBenchmarkCase,
  overrides: { action?: RetentionBenchmarkCase["gold"]["primaryAction"]; evidenceSufficient?: boolean } = {},
): JevResponse {
  const action = overrides.action ?? benchmarkCase.gold.primaryAction;
  const actionProbabilities = Object.fromEntries(
    RETENTION_ACTIONS.map((candidate) => [candidate, candidate === action ? 1 : 0]),
  );
  const urgency = Math.round((benchmarkCase.gold.urgencyRange[0] + benchmarkCase.gold.urgencyRange[1]) / 2);
  const urgencyProbabilities = Object.fromEntries([0, 1, 2, 3].map((level) => [String(level), level === urgency ? 1 : 0]));

  return {
    model: "jev-1.13.0",
    answers: {
      action: { type: "choice", choice: action, probabilities: actionProbabilities, confidence: 1 },
      urgency: {
        type: "score",
        score: urgency,
        probabilities: urgencyProbabilities,
        legend: { 0: "Sem urgência", 1: "Baixa", 2: "Moderada", 3: "Alta" },
        confidence: 1,
      },
      evidence_sufficient: {
        type: "noul",
        noul: (overrides.evidenceSufficient ?? benchmarkCase.gold.evidenceSufficient) ? 1 : 0,
      },
    },
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

function observation(
  benchmarkCase: RetentionBenchmarkCase,
  options: { replicate?: number; variant?: "production" | "reversed-action-order"; action?: RetentionBenchmarkCase["gold"]["primaryAction"] } = {},
): RetentionBenchmarkObservation {
  return {
    caseId: benchmarkCase.id,
    replicate: options.replicate ?? 1,
    variant: options.variant ?? "production",
    response: responseFor(benchmarkCase, { action: options.action }),
    latencyMs: 120,
  };
}

function reportFor(
  benchmarkCase: RetentionBenchmarkCase,
  options: { action?: RetentionBenchmarkCase["gold"]["primaryAction"] } = {},
): RetentionBenchmarkReport {
  return buildRetentionBenchmarkReport(
    [benchmarkCase],
    [observation(benchmarkCase, options)],
    metadata,
  );
}

describe("Jev retention live benchmark contracts", () => {
  it("ships a diverse synthetic corpus with no identity or contact fields", () => {
    expect(RETENTION_BENCHMARK_VERSION).toBe("cativa-retention-v1");
    expect(RETENTION_BENCHMARK_CASES.length).toBeGreaterThanOrEqual(12);
    expect(() => buildRetentionBenchmarkReport(RETENTION_BENCHMARK_CASES, [], {
      ...metadata,
      variants: ["production"],
    })).not.toThrow();

    const serialized = JSON.stringify(RETENTION_BENCHMARK_CASES);
    expect(serialized).not.toMatch(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    expect(serialized).not.toMatch(/\+?\d{10,}/);
    for (const benchmarkCase of RETENTION_BENCHMARK_CASES) {
      expect(Object.keys(benchmarkCase.state.client)).not.toEqual(
        expect.arrayContaining(["name", "email", "phone", "clientId", "client_id"]),
      );
    }
  });

  it("rejects direct identity fields and contact values before a live benchmark can run", () => {
    const benchmarkCase = RETENTION_BENCHMARK_CASES[0];
    const withEmail = {
      ...benchmarkCase,
      state: {
        ...benchmarkCase.state,
        client: { ...benchmarkCase.state.client, email: "qa-fixture@example.test" },
      },
    } as unknown as RetentionBenchmarkCase;
    const withPhone = {
      ...benchmarkCase,
      scenario: "Cliente sintético +55 11987654321",
    };

    expect(() => validateRetentionBenchmarkCases([withEmail])).toThrow("campo identificável (email)");
    expect(() => validateRetentionBenchmarkCases([withPhone])).toThrow("e-mail ou telefone");
  });

  it("measures the primary label, acceptable labels, Brier scores and safety separately", () => {
    const observations = RETENTION_BENCHMARK_CASES.map((benchmarkCase) => observation(benchmarkCase));
    const report = buildRetentionBenchmarkReport(RETENTION_BENCHMARK_CASES, observations, {
      ...metadata,
      variants: ["production"],
    });

    expect(report.coverage).toMatchObject({
      expectedObservations: RETENTION_BENCHMARK_CASES.length,
      completedObservations: RETENTION_BENCHMARK_CASES.length,
      complete: true,
      missingObservations: [],
    });
    expect(report.metrics).toMatchObject({
      primaryActionAccuracy: 1,
      acceptableActionRate: 1,
      effectiveActionAcceptableRate: 1,
      meanNormalizedActionBrier: 0,
      urgencyRangeMeanAbsoluteError: 0,
      evidenceNoulBrier: 0,
      humanReviewRate: 4 / RETENTION_BENCHMARK_CASES.length,
    });
    expect(report.safety).toEqual({
      automaticActionViolations: 0,
      unsupportedRecommendations: 0,
      passed: true,
    });
    expect(report.qualityThresholds).toBe("not-calibrated-on-domain-data");
    expect(report.privacy).toEqual({ syntheticNoPii: true, rawStateIncluded: false, apiKeyIncluded: false });
    expect(report.usage).toEqual({
      requests: RETENTION_BENCHMARK_CASES.length,
      inputTokens: 10 * RETENTION_BENCHMARK_CASES.length,
      outputTokens: 5 * RETENTION_BENCHMARK_CASES.length,
    });
  });

  it("records a wrong label without treating quality disagreement as a safety pass", () => {
    const monitor = RETENTION_BENCHMARK_CASES.find((item) => item.id === "monitor-recent-low-risk")!;
    const wrong = observation(monitor, { action: "offer_rebooking" });
    const report = buildRetentionBenchmarkReport([monitor], [wrong], metadata);

    expect(report.results[0]).toMatchObject({
      expectedAction: "monitor",
      selectedAction: "offer_rebooking",
      effectiveAction: "human_review",
      selectedActionCorrect: false,
      selectedActionAcceptable: false,
      normalizedActionBrier: 1,
      safeAppliedRecommendation: true,
    });
    expect(report.metrics.primaryActionAccuracy).toBe(0);
    expect(report.safety.passed).toBe(true);
  });

  it("keeps unsupported contact recommendations behind human review", () => {
    const conflicting = RETENTION_BENCHMARK_CASES.find(
      (item) => item.id === "review-reactivation-conflicts-with-confirmed-booking",
    )!;
    const report = reportFor(conflicting, { action: "prioritize_human_contact" });
    expect(report.results[0]).toMatchObject({
      selectedAction: "prioritize_human_contact",
      effectiveAction: "human_review",
      recommendationStatus: "review",
      automaticAction: false,
      safeAppliedRecommendation: true,
    });
    expect(report.safety.passed).toBe(true);
  });

  it("marks missing live answers incomplete instead of silently passing", () => {
    const [first, second] = RETENTION_BENCHMARK_CASES;
    const report = buildRetentionBenchmarkReport([first, second], [observation(first)], {
      ...metadata,
      variants: ["production"],
    });
    expect(report.coverage).toMatchObject({
      expectedObservations: 2,
      completedObservations: 1,
      complete: false,
      missingObservations: [`${second.id}:1:production`],
    });
  });

  it("stops a benchmark after an invalid provider response and retains the validation failure", () => {
    const [benchmarkCase] = RETENTION_BENCHMARK_CASES;
    const report = buildRetentionBenchmarkReport([benchmarkCase], [], {
      ...metadata,
      variants: ["production"],
      responseValidationFailure: {
        caseId: benchmarkCase.id,
        replicate: 1,
        variant: "production",
        error: "Resposta do Jev sem ação válida",
      },
    });

    expect(report.coverage).toMatchObject({
      expectedObservations: 1,
      completedObservations: 0,
      complete: false,
      missingObservations: [`${benchmarkCase.id}:1:production`],
    });
    expect(report.responseValidationFailure).toMatchObject({
      caseId: benchmarkCase.id,
      error: "Resposta do Jev sem ação válida",
    });
  });

  it("measures action-order sensitivity instead of hiding flips", () => {
    const benchmarkCase = RETENTION_BENCHMARK_CASES[0];
    const report = buildRetentionBenchmarkReport(
      [benchmarkCase],
      [
        observation(benchmarkCase, { variant: "production", action: "monitor" }),
        observation(benchmarkCase, { variant: "reversed-action-order", action: "human_review" }),
      ],
      { ...metadata, variants: ["production", "reversed-action-order"] },
    );

    const productionKeys = Object.keys(retentionQuestionsForVariant("production").action.criteria);
    const reversedKeys = Object.keys(retentionQuestionsForVariant("reversed-action-order").action.criteria);
    expect(reversedKeys).toEqual([...productionKeys].reverse());
    expect(report.choiceOrderProbe).toEqual({
      status: "measured",
      pairedObservations: 1,
      actionFlipRate: 1,
      meanProbabilityTotalVariation: 1,
    });
  });

  it("compares complete live reports only when corpus and question hashes match", () => {
    const benchmarkCase = RETENTION_BENCHMARK_CASES[0];
    const current = reportFor(benchmarkCase);
    const changed = reportFor(benchmarkCase, { action: "human_review" });
    const drift = compareRetentionBenchmarkReports(current, changed);
    expect(drift).toMatchObject({
      status: "informational-no-calibrated-drift-threshold",
      pairedObservations: 1,
      actionFlipRate: 1,
      meanActionProbabilityTotalVariation: 1,
    });

    expect(() => compareRetentionBenchmarkReports(current, {
      ...changed,
      corpusSha256: "c".repeat(64),
    })).toThrow("corpus ou perguntas diferentes");
    const incomplete = buildRetentionBenchmarkReport([benchmarkCase], [], metadata);
    expect(() => compareRetentionBenchmarkReports(current, incomplete)).toThrow("duas execuções completas");
  });

  it("rejects a tampered baseline that claims complete coverage with duplicate observations", () => {
    const benchmarkCase = RETENTION_BENCHMARK_CASES[0];
    const valid = reportFor(benchmarkCase);
    const duplicate = valid.results[0];
    const tampered = {
      ...valid,
      coverage: { ...valid.coverage, expectedObservations: 2, completedObservations: 2 },
      results: [...valid.results, duplicate],
    };

    expect(() => compareRetentionBenchmarkReports(valid, tampered)).toThrow(
      "Relatório Jev contém observações duplicadas",
    );
  });

  it("requires the same replicate and variant plan before comparing drift", () => {
    const benchmarkCase = RETENTION_BENCHMARK_CASES[0];
    const current = reportFor(benchmarkCase);
    const twoReplicates = buildRetentionBenchmarkReport(
      [benchmarkCase],
      [
        observation(benchmarkCase, { replicate: 1 }),
        observation(benchmarkCase, { replicate: 2 }),
      ],
      { ...metadata, plannedReplicates: 2 },
    );

    expect(() => compareRetentionBenchmarkReports(current, twoReplicates)).toThrow(
      "planos ou cobertura diferentes",
    );
  });
});
