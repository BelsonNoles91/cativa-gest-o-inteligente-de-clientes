import { describe, expect, it } from "vitest";
import { parseRetentionAdvice } from "@/domain/retentionIntelligence";
import {
  buildRetentionState,
  DEFAULT_RETENTION_POLICY,
  interpretRetentionResponse,
  parseRetentionPolicy,
  RETENTION_ACTIONS,
  type RetentionState,
} from "../../supabase/functions/retention-advisor/logic";

const evaluatedAt = "2026-09-22T12:00:00.000Z";

function state(overrides: Partial<RetentionState["client"]> = {}): RetentionState {
  return {
    evaluatedAt,
    client: {
      isVip: false,
      riskLevel: "medium",
      needsReactivation: true,
      daysSinceLastVisit: 120,
      daysUntilNextVisit: null,
      averageCycleDays: 30,
      churnRiskScore: 78,
      contactAvailable: true,
      ...overrides,
    },
    appointments: {
      completedLastYear: 3,
      noShowsLastYear: 1,
      cancellationsLastYear: 0,
      futureBooked: 0,
      futureUnconfirmed: 0,
    },
    packages: { activeWithRemainingSessions: 0, remainingSessions: 0, expiringWithin30Days: 0 },
    contacts: { attemptsLast60Days: 0, successfulLast60Days: 0 },
  };
}

function jevResponse(options?: { confidence?: number; evidence?: number; action?: string }) {
  const choice = options?.action ?? "offer_rebooking";
  const configuredConfidence = options?.confidence ?? 0.82;
  const confidenceForDistribution = Number.isFinite(configuredConfidence) &&
      configuredConfidence >= 0 && configuredConfidence <= 1
    ? configuredConfidence
    : 0.82;
  const selectedOption = RETENTION_ACTIONS.includes(choice as (typeof RETENTION_ACTIONS)[number])
    ? choice
    : "offer_rebooking";
  const peak = 1 / RETENTION_ACTIONS.length +
    (1 - 1 / RETENTION_ACTIONS.length) * confidenceForDistribution;
  const otherProbability = (1 - peak) / (RETENTION_ACTIONS.length - 1);
  const probabilities = Object.fromEntries(
    RETENTION_ACTIONS.map((action) => [action, action === selectedOption ? peak : otherProbability]),
  );

  return {
    model: "jev-1.13.0",
    usage: { input_tokens: 12, output_tokens: 8 },
    answers: {
      action: {
        type: "choice",
        choice,
        confidence: configuredConfidence,
        probabilities,
      },
      urgency: {
        type: "score",
        score: 2.05,
        confidence: 0.75,
        probabilities: { 0: 0, 1: 0.1, 2: 0.75, 3: 0.15 },
        legend: { 0: "none", 1: "low", 2: "moderate", 3: "high" },
      },
      evidence_sufficient: { type: "noul", noul: options?.evidence ?? 0.9 },
    },
  };
}

describe("retention intelligence", () => {
  it("reduces operational records to privacy-minimized state", () => {
    const output = buildRetentionState(
      {
        is_vip: true,
        risk_level: "high",
        needs_reactivation: true,
        last_visit_at: "2026-06-01T12:00:00.000Z",
        next_visit_at: null,
        average_cycle_days: 30,
        churn_risk_score: 91,
        phone: "+5511999999999",
        email: "pessoa@example.com",
      },
      [
        { status: "completed", starts_at: "2026-06-01T12:00:00.000Z" },
        { status: "no_show", starts_at: "2026-07-01T12:00:00.000Z" },
        { status: "scheduled", starts_at: "2026-10-01T12:00:00.000Z", confirmed_at: null },
      ],
      [{ status: "active", sessions_total: 5, sessions_used: 3, expires_at: "2026-10-01T00:00:00.000Z" }],
      [{ attempted_at: "2026-09-20T12:00:00.000Z", result: "confirmed" }],
      new Date(evaluatedAt),
    );

    expect(output.client.isVip).toBe(true);
    expect(output.client.contactAvailable).toBe(true);
    expect(output.appointments.futureUnconfirmed).toBe(1);
    expect(output.packages.remainingSessions).toBe(2);
    expect(output.packages.expiringWithin30Days).toBe(1);
    expect(output.contacts.successfulLast60Days).toBe(1);
    expect(JSON.stringify(output)).not.toContain("5511999999999");
    expect(JSON.stringify(output)).not.toContain("pessoa@example.com");
  });

  it("accepts a confident, sufficiently supported recommendation", () => {
    const result = interpretRetentionResponse(jevResponse(), state());
    expect(result).toMatchObject({
      status: "suggested",
      action: "offer_rebooking",
      urgencyLevel: "moderate",
      confidence: 0.82,
      automaticAction: false,
    });
    expect(parseRetentionAdvice(result)).toEqual(result);
  });

  it("accepts TypeSafe Score and probabilities rounded independently to two decimals", () => {
    const response = jevResponse();
    response.answers.urgency = {
      type: "score",
      score: 2.83,
      confidence: 0.83,
      probabilities: { 0: 0, 1: 0.01, 2: 0.16, 3: 0.83 },
      legend: { 0: "none", 1: "low", 2: "moderate", 3: "high" },
    };

    expect(interpretRetentionResponse(response, state()).urgencyLevel).toBe("high");
  });

  it("accepts Score confidence derived from either tied most-likely level", () => {
    const response = jevResponse();
    response.answers.urgency = {
      type: "score",
      score: 1.35,
      confidence: 0.25,
      probabilities: { 0: 0.15, 1: 0.4, 2: 0.4, 3: 0.05 },
      legend: { 0: "none", 1: "low", 2: "moderate", 3: "high" },
    };

    expect(interpretRetentionResponse(response, state())).toMatchObject({
      status: "review",
      action: "human_review",
      urgencyLevel: "uncertain",
    });
  });

  it("routes a low-confidence urgency distribution to human review", () => {
    const response = jevResponse();
    response.answers.urgency = {
      type: "score",
      score: 2.1,
      confidence: 0.4,
      probabilities: { 0: 0, 1: 0.25, 2: 0.4, 3: 0.35 },
      legend: { 0: "none", 1: "low", 2: "moderate", 3: "high" },
    };

    expect(interpretRetentionResponse(response, state())).toMatchObject({
      status: "review",
      action: "human_review",
      urgencyLevel: "uncertain",
    });
  });

  it.each([undefined, "", "   "])("rejects a missing or blank Jev model (%s)", (model) => {
    const response = jevResponse() as unknown as { model?: string; answers: unknown };
    response.model = model;
    expect(() => interpretRetentionResponse(response as never, state())).toThrow("sem modelo válido");
  });

  it.each([null, [], "invalid"])("rejects an invalid Jev answers container (%s)", (answers) => {
    expect(() =>
      interpretRetentionResponse({ model: "jev-1.13.0", answers } as never, state()),
    ).toThrow("Resposta do Jev incompleta");
  });

  it.each([
    ["low confidence", { confidence: 0.59 }],
    ["insufficient evidence", { evidence: 0.64 }],
  ])("routes %s to human review", (_label, options) => {
    const result = interpretRetentionResponse(jevResponse(options), state());
    expect(result.status).toBe("review");
    expect(result.action).toBe("human_review");
  });

  it("accepts calibrated thresholds from configuration and rejects invalid values", () => {
    expect(parseRetentionPolicy("0.75", "0.8")).toEqual({
      actionConfidenceThreshold: 0.75,
      evidenceSufficiencyThreshold: 0.8,
      urgencyConfidenceThreshold: DEFAULT_RETENTION_POLICY.urgencyConfidenceThreshold,
    });
    expect(parseRetentionPolicy("0.75", "0.8", "0.7")).toEqual({
      actionConfidenceThreshold: 0.75,
      evidenceSufficiencyThreshold: 0.8,
      urgencyConfidenceThreshold: 0.7,
    });
    expect(parseRetentionPolicy("2", "not-a-number")).toEqual(DEFAULT_RETENTION_POLICY);

    expect(
      interpretRetentionResponse(
        jevResponse({ confidence: 0.74, evidence: 0.9 }),
        state(),
        {
          actionConfidenceThreshold: 0.75,
          evidenceSufficiencyThreshold: 0.8,
          urgencyConfidenceThreshold: 0.6,
        },
    ).action,
    ).toBe("human_review");

    expect(parseRetentionPolicy("0.75", "invalid")).toEqual({
      actionConfidenceThreshold: 0.75,
      evidenceSufficiencyThreshold: DEFAULT_RETENTION_POLICY.evidenceSufficiencyThreshold,
      urgencyConfidenceThreshold: DEFAULT_RETENTION_POLICY.urgencyConfidenceThreshold,
    });
    expect(parseRetentionPolicy("   ", "")).toEqual(DEFAULT_RETENTION_POLICY);
  });

  it("routes contact recommendations to review when no contact channel exists", () => {
    const result = interpretRetentionResponse(jevResponse(), state({ contactAvailable: false }));
    expect(result.action).toBe("human_review");
  });

  it("rejects malformed or unknown model answers", () => {
    expect(() => interpretRetentionResponse(jevResponse({ action: "delete_client" }), state())).toThrow(
      "ação válida",
    );
    expect(() => parseRetentionAdvice({ automaticAction: true })).toThrow();
  });

  it.each([
    ["action", "text"],
    ["urgency", "choice"],
    ["evidence_sufficient", "score"],
  ])("rejects an incompatible answer type for %s", (key, type) => {
    const response = jevResponse();
    (response.answers[key as keyof typeof response.answers] as { type: string }).type = type;
    expect(() => interpretRetentionResponse(response, state())).toThrow("Tipos de resposta do Jev incompatíveis");
  });

  it.each([
    ["missing option", (answer: Record<string, unknown>) => {
      answer.probabilities = { offer_rebooking: 1 };
    }, "incompleta"],
    ["probabilities that do not sum to one", (answer: Record<string, unknown>) => {
      const probabilities = answer.probabilities as Record<string, number>;
      probabilities.monitor += 0.1;
    }, "totalizam 1"],
    ["negative probability", (answer: Record<string, unknown>) => {
      const probabilities = answer.probabilities as Record<string, number>;
      probabilities.monitor = -0.1;
    }, "probabilidade"],
    ["selected option that is not most likely", (answer: Record<string, unknown>) => {
      answer.choice = "monitor";
    }, "incompatível"],
  ])("rejects malformed Choice distributions: %s", (_label, mutate, message) => {
    const response = jevResponse();
    mutate(response.answers.action as unknown as Record<string, unknown>);
    expect(() => interpretRetentionResponse(response, state())).toThrow(message);
  });

  it("rejects Choice confidence inconsistent with its probability distribution", () => {
    const response = jevResponse();
    response.answers.action.confidence = 0.99;

    expect(() => interpretRetentionResponse(response, state())).toThrow(
      "confiança da ação incompatível com as probabilidades",
    );
  });

  it.each([
    ["score not equal to its probability-weighted position", (answer: Record<string, unknown>) => {
      answer.score = 1.5;
    }, "incompatível"],
    ["missing Score confidence", (answer: Record<string, unknown>) => {
      delete answer.confidence;
    }, "confiança da urgência"],
    ["out-of-range Score confidence", (answer: Record<string, unknown>) => {
      answer.confidence = 1.1;
    }, "confiança da urgência"],
    ["Score confidence inconsistent with its distribution", (answer: Record<string, unknown>) => {
      answer.confidence = 0.99;
    }, "confiança da urgência incompatível com as probabilidades"],
    ["missing level in the distribution", (answer: Record<string, unknown>) => {
      answer.probabilities = { 0: 0.1, 1: 0.2, 2: 0.7 };
    }, "incompleta"],
    ["missing level description", (answer: Record<string, unknown>) => {
      answer.legend = { 0: "none", 1: "low", 2: "moderate" };
    }, "legenda"],
  ])("rejects malformed Score answers: %s", (_label, mutate, message) => {
    const response = jevResponse();
    mutate(response.answers.urgency as unknown as Record<string, unknown>);
    expect(() => interpretRetentionResponse(response, state())).toThrow(message);
  });

  it("keeps counters, package sessions and date boundaries deterministic", () => {
    const now = new Date(evaluatedAt);
    const output = buildRetentionState(
      {
        last_visit_at: "not-a-date",
        next_visit_at: "2026-09-23T12:00:00.000Z",
        average_cycle_days: "not-a-number" as unknown as number,
        churn_risk_score: 999,
        phone: null,
        whatsapp_phone: null,
        email: null,
      },
      [
        { status: "completed", starts_at: "2026-09-22T12:00:00.000Z" },
        { status: "canceled", starts_at: "2026-09-23T12:00:00.000Z", confirmed_at: null },
        { status: "scheduled", starts_at: "2026-09-24T12:00:00.000Z", confirmed_at: "2026-09-22T12:00:00.000Z" },
        { status: "confirmed", starts_at: "2026-09-25T12:00:00.000Z", confirmed_at: null },
      ],
      [
        { status: "active", sessions_total: 2, sessions_used: 5, expires_at: "2026-10-22T12:00:00.000Z" },
        { status: "active", sessions_total: 4, sessions_used: 1, expires_at: "2026-10-22T12:00:00.000Z" },
        { status: "active", sessions_total: 3, sessions_used: 1, expires_at: "2026-10-23T12:00:00.000Z" },
        { status: "expired", sessions_total: 10, sessions_used: 0, expires_at: "2026-09-23T12:00:00.000Z" },
      ],
      [
        { attempted_at: "2026-07-24T12:00:00.000Z", result: "call_made" },
        { attempted_at: "2026-09-23T12:00:00.000Z", result: "confirmed" },
      ],
      now,
    );

    expect(output.client).toMatchObject({
      daysSinceLastVisit: null,
      daysUntilNextVisit: 1,
      averageCycleDays: null,
      churnRiskScore: 100,
      contactAvailable: false,
    });
    expect(output.appointments).toMatchObject({
      completedLastYear: 1,
      futureBooked: 2,
      futureUnconfirmed: 0,
    });
    expect(output.packages).toEqual({
      activeWithRemainingSessions: 2,
      remainingSessions: 5,
      expiringWithin30Days: 1,
    });
    expect(output.contacts).toEqual({ attemptsLast60Days: 1, successfulLast60Days: 1 });
  });

  it("treats missing package counts and non-finite churn values safely", () => {
    const output = buildRetentionState(
      { churn_risk_score: "not-a-number" as unknown as number },
      [],
      [
        { status: "active", sessions_total: null, sessions_used: null },
        { status: "active", sessions_total: 6, sessions_used: null, expires_at: null },
      ],
      [],
      new Date(evaluatedAt),
    );

    expect(output.client.churnRiskScore).toBe(0);
    expect(output.packages).toEqual({
      activeWithRemainingSessions: 1,
      remainingSessions: 6,
      expiringWithin30Days: 0,
    });
  });

  it.each([null, undefined, "", "   "])(
    "preserves missing average-cycle values as null (%s)",
    (averageCycleDays) => {
      const output = buildRetentionState(
        { average_cycle_days: averageCycleDays as unknown as number | null | undefined },
        [],
        [],
        [],
        new Date(evaluatedAt),
      );
      expect(output.client.averageCycleDays).toBeNull();
    },
  );

  it("treats non-scalar average-cycle data from a malformed record as missing", () => {
    const output = buildRetentionState(
      { average_cycle_days: { days: 30 } as unknown as number },
      [],
      [],
      [],
      new Date(evaluatedAt),
    );
    expect(output.client.averageCycleDays).toBeNull();
  });

  it.each([
    ["confidence", { confidence: -0.01 }, "confiança"],
    ["evidence", { evidence: 1.01 }, "suficiência"],
    ["urgency", { confidence: 0.8, evidence: 0.9 }, "urgência"],
  ])("rejects out-of-range Jev %s values", (_label, options, expectedLabel) => {
    const response = jevResponse(options);
    if (_label === "urgency") response.answers.urgency.score = 4;
    expect(() => interpretRetentionResponse(response, state())).toThrow(expectedLabel);
  });

  it("does not require a contact channel when Jev recommends monitoring", () => {
    const result = interpretRetentionResponse(
      jevResponse({ action: "monitor" }),
      state({ contactAvailable: false }),
    );
    expect(result).toMatchObject({ status: "suggested", action: "monitor", automaticAction: false });
  });

  it("does not allow rebooking suggestions without an overdue cycle and no future booking", () => {
    const notOverdue = state({ needsReactivation: false, daysSinceLastVisit: 20, averageCycleDays: 30 });
    expect(interpretRetentionResponse(jevResponse(), notOverdue).action).toBe("human_review");

    const futureBooking = state();
    futureBooking.appointments.futureBooked = 1;
    expect(interpretRetentionResponse(jevResponse(), futureBooking).action).toBe("human_review");
  });

  it("requires a real active package balance before recommending a package reminder", () => {
    expect(interpretRetentionResponse(jevResponse({ action: "remind_pending_package" }), state()).action)
      .toBe("human_review");

    const withPackage = state();
    withPackage.packages.activeWithRemainingSessions = 1;
    withPackage.packages.remainingSessions = 2;
    expect(interpretRetentionResponse(jevResponse({ action: "remind_pending_package" }), withPackage).action)
      .toBe("remind_pending_package");
  });

  it("requires an observable retention signal before prioritizing contact", () => {
    const noSignal = state({
      riskLevel: "low",
      needsReactivation: false,
      churnRiskScore: 10,
      daysSinceLastVisit: 10,
      averageCycleDays: 30,
    });
    expect(
      interpretRetentionResponse(jevResponse({ action: "prioritize_human_contact" }), noSignal).action,
    ).toBe("human_review");

    const unconfirmed = state({
      riskLevel: "low",
      needsReactivation: false,
      churnRiskScore: 10,
      daysSinceLastVisit: 10,
      averageCycleDays: 30,
    });
    unconfirmed.appointments.futureUnconfirmed = 1;
    expect(
      interpretRetentionResponse(jevResponse({ action: "prioritize_human_contact" }), unconfirmed).action,
    ).toBe("prioritize_human_contact");

    const overdue = interpretRetentionResponse(
      jevResponse({ action: "prioritize_human_contact" }),
      state(),
    );
    expect(overdue).toMatchObject({ action: "prioritize_human_contact" });
    expect(overdue.description).toContain("sinais de retenção");
  });

  it("does not treat VIP status by itself as evidence for prioritized contact", () => {
    const vipWithoutRisk = state({
      isVip: true,
      riskLevel: "low",
      needsReactivation: false,
      churnRiskScore: 10,
      daysSinceLastVisit: 10,
      averageCycleDays: 30,
    });

    expect(
      interpretRetentionResponse(jevResponse({ action: "prioritize_human_contact" }), vipWithoutRisk),
    ).toMatchObject({ status: "review", action: "human_review", automaticAction: false });
  });

  it("prioritizes repeated no-shows but does not treat one no-show as a recurring pattern", () => {
    const neutralClient = {
      riskLevel: "low",
      needsReactivation: false,
      churnRiskScore: 10,
      daysSinceLastVisit: 10,
      averageCycleDays: 30,
    };
    const isolatedNoShow = state(neutralClient);
    isolatedNoShow.appointments.noShowsLastYear = 1;
    const recurringNoShows = state(neutralClient);
    recurringNoShows.appointments.noShowsLastYear = 2;

    expect(
      interpretRetentionResponse(
        jevResponse({ action: "prioritize_human_contact" }),
        isolatedNoShow,
      ).action,
    ).toBe("human_review");
    expect(
      interpretRetentionResponse(
        jevResponse({ action: "prioritize_human_contact" }),
        recurringNoShows,
      ).action,
    ).toBe("prioritize_human_contact");
  });
});
