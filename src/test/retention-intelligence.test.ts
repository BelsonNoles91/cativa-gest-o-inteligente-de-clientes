import { describe, expect, it } from "vitest";
import { parseRetentionAdvice } from "@/domain/retentionIntelligence";
import {
  buildRetentionState,
  DEFAULT_RETENTION_POLICY,
  interpretRetentionResponse,
  parseRetentionPolicy,
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
  return {
    model: "jev-1.13.0",
    answers: {
      action: {
        type: "choice",
        choice: options?.action ?? "offer_rebooking",
        confidence: options?.confidence ?? 0.82,
        probabilities: { offer_rebooking: 0.82, human_review: 0.18 },
      },
      urgency: {
        type: "score",
        score: 2.25,
        confidence: 0.7,
        probabilities: { 0: 0, 1: 0.1, 2: 0.55, 3: 0.35 },
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
      urgency: 75,
      confidence: 0.82,
      automaticAction: false,
    });
    expect(parseRetentionAdvice(result)).toEqual(result);
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
    });
    expect(parseRetentionPolicy("2", "not-a-number")).toEqual(DEFAULT_RETENTION_POLICY);

    expect(
      interpretRetentionResponse(
        jevResponse({ confidence: 0.74, evidence: 0.9 }),
        state(),
        { actionConfidenceThreshold: 0.75, evidenceSufficiencyThreshold: 0.8 },
      ).action,
    ).toBe("human_review");
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
});
