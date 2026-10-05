import { describe, expect, it } from "vitest";
import {
  getQueueScheduledFor,
  isQueueItemDue,
  matchesConfirmationRule,
  type ConfirmationRuleAppointment,
  type ConfirmationRuleClient,
  type ConfirmationRuleFilters,
} from "./queueRules";

const noFilters: ConfirmationRuleFilters = {
  appliesToVip: false,
  appliesToHighRisk: false,
  appliesToProtocol: false,
  minAppointmentValueCents: null,
  skipIfAlreadyConfirmed: true,
};
const pendingAppointment: ConfirmationRuleAppointment = {
  status: "pending",
  confirmedAt: null,
  totalPriceCents: 5000,
};
const regularClient: ConfirmationRuleClient = { isVip: false, riskLevel: "low" };

describe("confirmation queue rule semantics", () => {
  it("combines enabled audience filters with AND and accepts an exact threshold match", () => {
    const rule = {
      ...noFilters,
      appliesToVip: true,
      appliesToHighRisk: true,
      appliesToProtocol: true,
      minAppointmentValueCents: 5000,
    };

    expect(matchesConfirmationRule(
      rule,
      pendingAppointment,
      { isVip: true, riskLevel: "high" },
      true,
    )).toBe(true);
    expect(matchesConfirmationRule(
      rule,
      pendingAppointment,
      { isVip: false, riskLevel: "high" },
      true,
    )).toBe(false);
    expect(matchesConfirmationRule(
      rule,
      pendingAppointment,
      { isVip: true, riskLevel: "medium" },
      true,
    )).toBe(false);
    expect(matchesConfirmationRule(
      rule,
      { ...pendingAppointment, totalPriceCents: 4999 },
      { isVip: true, riskLevel: "high" },
      true,
    )).toBe(false);
  });

  it("does not exclude non-target clients when optional filters are off", () => {
    expect(matchesConfirmationRule(noFilters, pendingAppointment, null, false)).toBe(true);
    expect(matchesConfirmationRule(noFilters, pendingAppointment, regularClient, false)).toBe(true);
  });

  it("skips already confirmed appointments by status or confirmed timestamp when enabled", () => {
    expect(matchesConfirmationRule(
      noFilters,
      { ...pendingAppointment, status: "confirmed" },
      regularClient,
      false,
    )).toBe(false);
    expect(matchesConfirmationRule(
      noFilters,
      { ...pendingAppointment, confirmedAt: "2026-10-04T10:00:00.000Z" },
      regularClient,
      false,
    )).toBe(false);
    expect(matchesConfirmationRule(
      { ...noFilters, skipIfAlreadyConfirmed: false },
      { ...pendingAppointment, status: "confirmed" },
      regularClient,
      false,
    )).toBe(true);
  });

  it("schedules human contact by the configured lead time, including zero", () => {
    expect(getQueueScheduledFor("2026-10-10T12:00:00.000Z", 24)).toBe("2026-10-09T12:00:00.000Z");
    expect(getQueueScheduledFor("2026-10-10T12:00:00.000Z", 0)).toBe("2026-10-10T12:00:00.000Z");
  });

  it("rejects invalid appointments and invalid lead times instead of scheduling unsafe values", () => {
    expect(() => getQueueScheduledFor("invalid", 24)).toThrow(RangeError);
    expect(() => getQueueScheduledFor("2026-10-10T12:00:00.000Z", -1)).toThrow(RangeError);
    expect(() => getQueueScheduledFor("2026-10-10T12:00:00.000Z", 1.5)).toThrow(RangeError);
  });

  it("considers a task due at its exact scheduled instant and fails closed for invalid timestamps", () => {
    const now = new Date("2026-10-09T12:00:00.000Z");
    expect(isQueueItemDue("2026-10-09T12:00:00.000Z", now)).toBe(true);
    expect(isQueueItemDue("2026-10-09T12:00:01.000Z", now)).toBe(false);
    expect(isQueueItemDue("invalid", now)).toBe(false);
  });
});
