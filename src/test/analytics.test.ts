/**
 * Testes das fórmulas analíticas. Métricas erradas = decisões erradas.
 * Blindamos os cálculos centrais com fixtures controlados.
 */
import { describe, it, expect } from "vitest";
import {
  attendanceRate,
  noShowRate,
  cancellationRate,
  confirmationRate,
  occupancyRate,
  averageTicket,
  futureBookedValue,
  futureRevenueAtRisk,
  rebookingRate,
  type ApptFact,
} from "@/domain/analytics";

function fact(over: Partial<ApptFact>): ApptFact {
  return {
    id: crypto.randomUUID(),
    tenantId: "t1",
    unitId: "u1",
    professionalId: "p1",
    clientId: "c1",
    startsAt: "2026-04-21T10:00:00Z",
    endsAt: "2026-04-21T11:00:00Z",
    durationMinutes: 60,
    status: "completed",
    source: "frontdesk",
    totalPriceCents: 10000,
    isOverbooked: false,
    confirmedAt: "2026-04-20T10:00:00Z",
    remindedAt: null,
    noShowAt: null,
    canceledAt: null,
    completedAt: "2026-04-21T11:00:00Z",
    createdAt: "2026-04-01T10:00:00Z",
    ...over,
  };
}

describe("domain/analytics — métricas operacionais", () => {
  it("attendanceRate: 2 atendidos em 3 elegíveis = 66.7%", () => {
    const rows = [
      fact({ status: "completed" }),
      fact({ status: "arrived" }),
      fact({ status: "no_show", confirmedAt: null }),
      fact({ status: "canceled" }), // ignorado
    ];
    const r = attendanceRate(rows);
    expect(r.eligible).toBe(3);
    expect(r.attended).toBe(2);
    expect(r.rate).toBeCloseTo(66.7, 1);
  });

  it("noShowRate: ignora cancelados na denominação", () => {
    const rows = [
      fact({ status: "no_show" }),
      fact({ status: "completed" }),
      fact({ status: "canceled" }),
    ];
    const r = noShowRate(rows);
    expect(r.noShows).toBe(1);
    expect(r.eligible).toBe(2);
    expect(r.rate).toBe(50);
  });

  it("cancellationRate considera o total de marcados como denominador", () => {
    const rows = [
      fact({ status: "canceled" }),
      fact({ status: "canceled" }),
      fact({ status: "completed" }),
      fact({ status: "completed" }),
    ];
    expect(cancellationRate(rows).rate).toBe(50);
  });

  it("confirmationRate: confirmedAt OU status confirmado conta", () => {
    const rows = [
      fact({ status: "pending", confirmedAt: null }),
      fact({ status: "confirmed", confirmedAt: null }),
      fact({ status: "pending", confirmedAt: "2026-04-20T10:00:00Z" }),
      fact({ status: "canceled", confirmedAt: null }), // excluído
    ];
    const r = confirmationRate(rows);
    expect(r.eligible).toBe(3);
    expect(r.confirmed).toBe(2);
    expect(r.rate).toBeCloseTo(66.7, 1);
  });

  it("occupancyRate: divide reservados por disponíveis", () => {
    expect(
      occupancyRate({ availableMinutes: 480, bookedMinutes: 360, completedMinutes: 360 }).rate,
    ).toBe(75);
    expect(
      occupancyRate({ availableMinutes: 0, bookedMinutes: 100, completedMinutes: 0 }).rate,
    ).toBe(0);
  });

  it("averageTicket: média em reais (cents/100) só dos concluídos", () => {
    const rows = [
      fact({ status: "completed", totalPriceCents: 10000 }),
      fact({ status: "completed", totalPriceCents: 20000 }),
      fact({ status: "no_show", totalPriceCents: 30000 }), // ignorado
    ];
    expect(averageTicket(rows)).toBe(150); // (100 + 200) / 2
  });

  it("futureBookedValue ignora cancelados/no-show", () => {
    const futures: ApptFact[] = [
      fact({ status: "confirmed", totalPriceCents: 10000 }),
      fact({ status: "canceled", totalPriceCents: 20000 }),
      fact({ status: "pending", totalPriceCents: 5000 }),
    ];
    expect(futureBookedValue(futures)).toBe(150);
  });

  it("futureRevenueAtRisk soma apenas futuros sem confirmação", () => {
    const futures: ApptFact[] = [
      fact({ status: "pending", confirmedAt: null, totalPriceCents: 10000 }),
      fact({ status: "confirmed", confirmedAt: "2026-04-20T10:00:00Z", totalPriceCents: 20000 }),
      fact({ status: "pending", confirmedAt: null, totalPriceCents: 5000 }),
    ];
    const r = futureRevenueAtRisk(futures);
    expect(r.count).toBe(2);
    expect(r.value).toBe(150);
  });

  it("rebookingRate: cliente concluiu + tem futuro dentro da janela", () => {
    const completed = fact({
      clientId: "c1",
      status: "completed",
      startsAt: "2026-04-01T10:00:00Z",
    });
    const future = fact({
      clientId: "c1",
      status: "confirmed",
      startsAt: "2026-04-25T10:00:00Z",
    });
    const otherClient = fact({
      clientId: "c2",
      status: "completed",
      startsAt: "2026-04-01T10:00:00Z",
    });
    const r = rebookingRate([completed, future, otherClient], 30);
    // c1: rebooked. c2: completed sem next. eligible = 2, rebooked = 1.
    expect(r.eligible).toBe(2);
    expect(r.rebooked).toBe(1);
    expect(r.rate).toBe(50);
  });
});
