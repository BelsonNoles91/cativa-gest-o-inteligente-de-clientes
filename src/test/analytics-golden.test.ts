import { describe, expect, it } from "vitest";
import {
  CATIVA_WEIGHTS,
  attendanceRate,
  cancellationRate,
  cativaIndex,
  confirmationRate,
  futureBookedValue,
  futureRevenueAtRisk,
  occupancyRate,
  noShowRate,
  reactivationRate,
  retentionRate,
  waitlistConversionRate,
  type ApptFact,
} from "@/domain/analytics";

const range = {
  start: new Date("2026-01-01T00:00:00.000Z"),
  end: new Date("2026-12-31T23:59:59.999Z"),
};

function appointment(overrides: Partial<ApptFact> = {}): ApptFact {
  return {
    id: crypto.randomUUID(),
    tenantId: "tenant-a",
    unitId: "unit-a",
    professionalId: "professional-a",
    serviceId: "service-a",
    clientId: "client-a",
    startsAt: "2026-03-01T10:00:00.000Z",
    endsAt: "2026-03-01T11:00:00.000Z",
    durationMinutes: 60,
    status: "pending",
    source: "frontdesk",
    totalPriceCents: 10000,
    isOverbooked: false,
    confirmedAt: null,
    remindedAt: null,
    noShowAt: null,
    canceledAt: null,
    completedAt: null,
    createdAt: "2026-02-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("analytics golden fixtures e invariantes", () => {
  it("mantém pesos do Índice Cativa em 100% e reconcilia o breakdown", () => {
    expect(Object.values(CATIVA_WEIGHTS).reduce((sum, weight) => sum + weight, 0)).toBe(100);

    const result = cativaIndex({
      retentionPct: 72,
      rebookingPct: 58,
      confirmationPct: 91,
      noShowRecoveryPct: 25,
      occupancyPct: 110,
      idealWindowPct: 64,
      crmCompletenessPct: 83,
      futureBookedValueCents: 150_000,
      futureBookedReferenceCents: 100_000,
    });

    expect(result.score).toBe(73);
    expect(result.components.reduce((sum, component) => sum + component.contribution, 0)).toBe(result.score);
    expect(result.components).toHaveLength(8);
    for (const component of result.components) {
      expect(component.valuePct).toBeGreaterThanOrEqual(0);
      expect(component.valuePct).toBeLessThanOrEqual(100);
      expect(component.contribution).toBeGreaterThanOrEqual(0);
      expect(component.contribution).toBeLessThanOrEqual(component.weight);
    }
  });

  it("trata vazios, NaN, negativos e excesso sem produzir taxas inválidas", () => {
    expect(occupancyRate({ availableMinutes: 0, bookedMinutes: 500, completedMinutes: 0 }).rate).toBe(0);
    expect(occupancyRate({ availableMinutes: 60, bookedMinutes: 180, completedMinutes: 0 }).rate).toBe(100);
    expect(reactivationRate({ reactivated: 5, inactives: 0 })).toBe(0);
    expect(reactivationRate({ reactivated: 12, inactives: 10 })).toBe(100);
    expect(waitlistConversionRate({ scheduled: 8, worked: 4 })).toBe(100);

    const result = cativaIndex({
      retentionPct: Number.NaN,
      rebookingPct: -10,
      confirmationPct: 200,
      noShowRecoveryPct: Number.POSITIVE_INFINITY,
      occupancyPct: 50,
      idealWindowPct: 50,
      crmCompletenessPct: 50,
      futureBookedValueCents: 100,
      futureBookedReferenceCents: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.components.reduce((sum, component) => sum + component.contribution, 0)).toBe(result.score);
  });

  it("reconcilia o breakdown em uma amostra determinística de valores extremos", () => {
    const values = [-1_000, -1, 0, 0.1, 12.34, 49.95, 50, 99.95, 100, 1_000, Number.NaN, Number.POSITIVE_INFINITY];
    for (let seed = 0; seed < 64; seed += 1) {
      const pick = (offset: number) => values[(seed * 7 + offset * 11) % values.length];
      const result = cativaIndex({
        retentionPct: pick(0),
        rebookingPct: pick(1),
        confirmationPct: pick(2),
        noShowRecoveryPct: pick(3),
        occupancyPct: pick(4),
        idealWindowPct: pick(5),
        crmCompletenessPct: pick(6),
        futureBookedValueCents: pick(7),
        futureBookedReferenceCents: pick(8),
      });
      expect(result.components.reduce((sum, component) => sum + component.contribution, 0)).toBe(result.score);
    }
  });

  it("reconcilia o score quando o arredondamento das contribuições difere nos dois sentidos", () => {
    const inputs = [
      { retentionPct: 13, rebookingPct: 62.8, confirmationPct: 70.5, noShowRecoveryPct: 92.9, occupancyPct: 22.4, idealWindowPct: 80, crmCompletenessPct: 18.3, futureBookedValueCents: 444, futureBookedReferenceCents: 1_000 },
      { retentionPct: 86.6, rebookingPct: 25, confirmationPct: 69.1, noShowRecoveryPct: 74.7, occupancyPct: 59.3, idealWindowPct: 46.7, crmCompletenessPct: 40.1, futureBookedValueCents: 151, futureBookedReferenceCents: 1_000 },
    ];

    for (const input of inputs) {
      const result = cativaIndex(input);
      expect(result.components.reduce((sum, component) => sum + component.contribution, 0)).toBe(result.score);
      for (const component of result.components) {
        expect(component.contribution).toBeGreaterThanOrEqual(0);
        expect(component.contribution).toBeLessThanOrEqual(component.weight);
      }
    }
  });

  it("mantém receita em risco contida no valor futuro", () => {
    const futures = [
      appointment({ status: "pending", totalPriceCents: 10_000, confirmedAt: null }),
      appointment({ status: "confirmed", totalPriceCents: 20_000, confirmedAt: "2026-02-28T10:00:00.000Z" }),
      appointment({ status: "canceled", totalPriceCents: 90_000 }),
    ];
    expect(futureRevenueAtRisk(futures).value).toBeLessThanOrEqual(futureBookedValue(futures));
    expect(futureRevenueAtRisk(futures)).toEqual({ value: 100, count: 1 });
  });

  it("não conta cancelamentos ou faltas confirmadas fora do denominador da taxa de confirmação", () => {
    const rows = [
      appointment({ status: "pending", confirmedAt: null }),
      appointment({ status: "arrived", confirmedAt: "2026-02-28T10:00:00.000Z" }),
      appointment({ status: "canceled", confirmedAt: "2026-02-27T10:00:00.000Z" }),
      appointment({ status: "no_show", confirmedAt: "2026-02-26T10:00:00.000Z" }),
    ];

    expect(confirmationRate(rows)).toEqual({ rate: 50, confirmed: 1, eligible: 2 });
  });

  it("preserva numeradores dentro dos denominadores para todos os estados da agenda", () => {
    const statuses = [
      "requested", "pending", "confirmed", "reminded", "arrived",
      "in_service", "completed", "canceled", "no_show",
    ] as const;

    for (let seed = 0; seed < 256; seed += 1) {
      const rows = Array.from({ length: seed % 17 }, (_, index) =>
        appointment({
          id: `${seed}-${index}`,
          status: statuses[(seed * 7 + index * 5) % statuses.length],
          confirmedAt: (seed + index) % 3 === 0 ? "2026-02-28T10:00:00.000Z" : null,
        }),
      );
      const attendance = attendanceRate(rows);
      const noShow = noShowRate(rows);
      const cancellations = cancellationRate(rows);
      const confirmations = confirmationRate(rows);
      const measurements = [attendance, noShow, cancellations, confirmations];

      for (const { rate, eligible } of measurements) {
        expect(Number.isFinite(rate)).toBe(true);
        expect(rate).toBeGreaterThanOrEqual(0);
        expect(rate).toBeLessThanOrEqual(100);
        expect(eligible).toBeGreaterThanOrEqual(0);
      }

      expect(attendance.attended).toBeLessThanOrEqual(attendance.eligible);
      expect(noShow.noShows).toBeLessThanOrEqual(noShow.eligible);
      expect(cancellations.canceled).toBeLessThanOrEqual(cancellations.eligible);
      expect(confirmations.confirmed).toBeLessThanOrEqual(confirmations.eligible);

      const expectedRate = (numerator: number, denominator: number) =>
        denominator === 0 ? 0 : Math.round(Math.min(1, numerator / denominator) * 1000) / 10;
      const expectedAttendanceEligible = rows.filter((row) => row.status !== "canceled").length;
      const expectedAttendance = rows.filter((row) =>
        ["arrived", "in_service", "completed"].includes(row.status),
      ).length;
      const expectedNoShows = rows.filter((row) => row.status === "no_show").length;
      const expectedCanceled = rows.filter((row) => row.status === "canceled").length;
      const expectedConfirmationEligible = rows.filter(
        (row) => row.status !== "canceled" && row.status !== "no_show",
      );
      const expectedConfirmed = expectedConfirmationEligible.filter((row) =>
        row.confirmedAt !== null || ["confirmed", "reminded", "arrived", "in_service", "completed"].includes(row.status),
      ).length;

      expect(attendance).toEqual({
        rate: expectedRate(expectedAttendance, expectedAttendanceEligible),
        attended: expectedAttendance,
        eligible: expectedAttendanceEligible,
      });
      expect(noShow).toEqual({
        rate: expectedRate(expectedNoShows, expectedAttendanceEligible),
        noShows: expectedNoShows,
        eligible: expectedAttendanceEligible,
      });
      expect(cancellations).toEqual({
        rate: expectedRate(expectedCanceled, rows.length),
        canceled: expectedCanceled,
        eligible: rows.length,
      });
      expect(confirmations).toEqual({
        rate: expectedRate(expectedConfirmed, expectedConfirmationEligible.length),
        confirmed: expectedConfirmed,
        eligible: expectedConfirmationEligible.length,
      });
    }
  });

  it("calcula uma coorte dourada de retenção sem contar visitas fora da janela", () => {
    const clients = [
      { id: "a", createdAt: "2026-01-01", isVip: false, fullName: "A", email: null, phone: null, whatsappPhone: null, birthDate: null, preferences: null, preferredProfessionalId: null, preferredUnitId: null, completedVisits: 2, firstVisitAt: "2026-01-10", lastVisitAt: "2026-02-05" },
      { id: "b", createdAt: "2026-01-01", isVip: false, fullName: "B", email: null, phone: null, whatsappPhone: null, birthDate: null, preferences: null, preferredProfessionalId: null, preferredUnitId: null, completedVisits: 1, firstVisitAt: "2026-01-10", lastVisitAt: "2026-01-10" },
    ];
    const appts = [
      appointment({ clientId: "a", status: "completed", startsAt: "2026-01-10T10:00:00.000Z" }),
      appointment({ clientId: "a", status: "completed", startsAt: "2026-02-05T10:00:00.000Z" }),
      appointment({ clientId: "b", status: "completed", startsAt: "2026-01-10T10:00:00.000Z" }),
    ];
    expect(retentionRate(clients, appts, 30, { start: new Date("2026-01-01"), end: new Date("2026-02-01") })).toEqual({
      rate: 0,
      eligible: 0,
      retained: 0,
    });
    expect(retentionRate(clients, appts, 30, { start: new Date("2026-01-01"), end: new Date("2026-03-31") })).toEqual({
      rate: 50,
      eligible: 2,
      retained: 1,
    });
  });
});
