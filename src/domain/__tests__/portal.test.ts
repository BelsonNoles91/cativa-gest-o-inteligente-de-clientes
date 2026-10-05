import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Appointment, AppointmentStatus } from "../scheduling";
import {
  canCancelWithoutFee,
  firstName,
  formatBRL,
  isPastAppointment,
  isUpcomingAppointment,
  portalVisibleStatuses,
  type CancellationPolicySnapshot,
} from "../portal";

const NOW = new Date("2026-10-04T12:00:00.000Z");
const HOURS = 60 * 60 * 1000;

function appointment(
  patch: Partial<Appointment> = {},
): Appointment {
  return {
    id: "appointment-1",
    tenantId: "tenant-a",
    unitId: "unit-a",
    clientId: "client-a",
    professionalId: "professional-a",
    resourceId: null,
    cancellationPolicyId: null,
    status: "confirmed",
    source: "client_portal",
    startsAt: new Date(NOW.getTime() + HOURS).toISOString(),
    endsAt: new Date(NOW.getTime() + 2 * HOURS).toISOString(),
    durationMinutes: 60,
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    isWalkIn: false,
    isOverbooked: false,
    totalPriceCents: 10_000,
    notes: null,
    internalNotes: null,
    confirmedAt: null,
    remindedAt: null,
    arrivedAt: null,
    startedAt: null,
    completedAt: null,
    canceledAt: null,
    noShowAt: null,
    canceledReason: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...patch,
  };
}

const policy: CancellationPolicySnapshot = {
  id: "policy-1",
  name: "Cancelamento",
  description: null,
  hoursBeforeNoCharge: 24,
  lateCancelFeePct: 50,
  noShowFeePct: 100,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("portal appointment time rules", () => {
  it("allows cancellation without a fee when no policy is configured", () => {
    expect(canCancelWithoutFee(new Date(NOW.getTime() + 2 * HOURS).toISOString(), null)).toEqual({
      allowed: true,
      hoursLeft: 2,
      willChargeFee: false,
      feePct: 0,
    });
  });

  it("allows cancellation exactly at the no-fee boundary", () => {
    expect(canCancelWithoutFee(new Date(NOW.getTime() + 24 * HOURS).toISOString(), policy)).toEqual({
      allowed: true,
      hoursLeft: 24,
      willChargeFee: false,
      feePct: 0,
    });
  });

  it("applies the configured fee just inside the late-cancellation window", () => {
    const result = canCancelWithoutFee(new Date(NOW.getTime() + 23.5 * HOURS).toISOString(), policy);

    expect(result.allowed).toBe(false);
    expect(result.hoursLeft).toBeCloseTo(23.5);
    expect(result.willChargeFee).toBe(true);
    expect(result.feePct).toBe(50);
  });

  it("does not claim a fee when the policy fee is zero", () => {
    const result = canCancelWithoutFee(
      new Date(NOW.getTime() + 1 * HOURS).toISOString(),
      { ...policy, lateCancelFeePct: 0 },
    );

    expect(result.allowed).toBe(false);
    expect(result.willChargeFee).toBe(false);
    expect(result.feePct).toBe(0);
  });

  it("clamps past appointments to zero hours remaining", () => {
    const result = canCancelWithoutFee(new Date(NOW.getTime() - 3 * HOURS).toISOString(), null);

    expect(result.hoursLeft).toBe(0);
    expect(result.allowed).toBe(true);
  });

  it.each([null, policy])("fails closed for an invalid start time without displaying a fee", (snapshot) => {
    expect(canCancelWithoutFee("not-an-ISO-date", snapshot)).toEqual({
      allowed: false,
      hoursLeft: 0,
      willChargeFee: false,
      feePct: 0,
    });
  });

  it("marks appointments as past only after their end or at a terminal status", () => {
    const nowIso = NOW.toISOString();
    expect(isPastAppointment(appointment({ endsAt: new Date(NOW.getTime() - 1).toISOString() }))).toBe(true);
    expect(isPastAppointment(appointment({ endsAt: nowIso }))).toBe(false);
    expect(isPastAppointment(appointment({ endsAt: new Date(NOW.getTime() + HOURS).toISOString() }))).toBe(false);

    for (const status of ["completed", "canceled", "no_show"] as const) {
      expect(isPastAppointment(appointment({ status, endsAt: new Date(NOW.getTime() + HOURS).toISOString() }))).toBe(true);
    }
  });

  it.each(["requested", "pending", "confirmed", "reminded", "arrived", "in_service"] as const)(
    "treats future %s appointments as upcoming and past ones as not upcoming",
    (status) => {
      expect(isUpcomingAppointment(appointment({ status }))).toBe(true);
      expect(isUpcomingAppointment(appointment({
        status,
        startsAt: new Date(NOW.getTime() - 1).toISOString(),
      }))).toBe(false);
    },
  );

  it.each(["completed", "canceled", "no_show"] as const)(
    "never treats a future %s appointment as upcoming",
    (status) => {
      expect(isUpcomingAppointment(appointment({ status }))).toBe(false);
    },
  );

  it("keeps the portal status allowlist complete and excludes unknown states", () => {
    expect(portalVisibleStatuses).toEqual([
      "requested",
      "pending",
      "confirmed",
      "reminded",
      "arrived",
      "in_service",
      "completed",
      "canceled",
      "no_show",
    ] satisfies AppointmentStatus[]);
  });
});

describe("portal display formatting", () => {
  it("extracts the first name after trimming arbitrary whitespace", () => {
    expect(firstName("  Maria   da Silva ")).toBe("Maria");
    expect(firstName("Ana\nPaula")).toBe("Ana");
    expect(firstName(" \n\t ")).toBe("");
  });

  it.each([null, undefined, ""])('returns an empty first name for %j', (value) => {
    expect(firstName(value)).toBe("");
  });

  it("formats BRL from integer cents, including zero and negative adjustments", () => {
    const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

    expect(formatBRL(123_456)).toBe(currency.format(1234.56));
    expect(formatBRL(0)).toContain("0,00");
    expect(formatBRL(-1_234)).toBe(currency.format(-12.34));
  });
});
