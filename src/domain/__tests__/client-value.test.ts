import { describe, expect, it } from "vitest";
import { clientValueReport, revenueForecast } from "../client-value";
import type { ApptFact, ClientFact } from "../analytics";

const NOW = new Date("2026-06-15T12:00:00.000Z").getTime();
const DAY = 86_400_000;

function appt(p: Partial<ApptFact> & { id: string; clientId: string; startsAt: string }): ApptFact {
  return {
    tenantId: "t1",
    unitId: "u1",
    professionalId: "p1",
    serviceId: "s1",
    endsAt: p.startsAt,
    durationMinutes: 60,
    status: "completed",
    source: "frontdesk",
    totalPriceCents: 10_000,
    isOverbooked: false,
    confirmedAt: null,
    remindedAt: null,
    noShowAt: null,
    canceledAt: null,
    completedAt: null,
    createdAt: p.startsAt,
    ...p,
  } as ApptFact;
}

function client(id: string, fullName: string): ClientFact {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    isVip: false,
    fullName,
    email: null,
    phone: null,
    whatsappPhone: null,
    birthDate: null,
    preferences: null,
    preferredProfessionalId: null,
    preferredUnitId: null,
    completedVisits: 0,
    firstVisitAt: null,
    lastVisitAt: null,
  };
}

describe("clientValueReport", () => {
  const clients = [client("c1", "Ana"), client("c2", "Bruno")];
  const appts = [
    appt({ id: "a1", clientId: "c1", startsAt: "2026-01-10T10:00:00.000Z", totalPriceCents: 20_000 }),
    appt({ id: "a2", clientId: "c1", startsAt: "2026-03-11T10:00:00.000Z", totalPriceCents: 20_000 }),
    appt({ id: "a3", clientId: "c1", startsAt: "2026-05-10T10:00:00.000Z", totalPriceCents: 20_000 }),
    appt({ id: "a4", clientId: "c2", startsAt: "2026-05-01T10:00:00.000Z", totalPriceCents: 5_000 }),
    appt({ id: "a5", clientId: "c2", startsAt: "2026-05-02T10:00:00.000Z", status: "canceled" }),
  ];

  it("ordena por receita e ignora cancelados", () => {
    const r = clientValueReport(appts, clients, NOW);
    expect(r.rows.map((x) => x.name)).toEqual(["Ana", "Bruno"]);
    expect(r.rows[0].visits).toBe(3);
    expect(r.rows[0].revenueCents).toBe(60_000);
    expect(r.rows[1].revenueCents).toBe(5_000);
    expect(r.totalRevenueCents).toBe(65_000);
  });

  it("calcula ticket médio, intervalo e projeção anual", () => {
    const ana = clientValueReport(appts, clients, NOW).rows[0];
    expect(ana.averageTicketCents).toBe(20_000);
    expect(ana.averageIntervalDays).toBe(60);
    expect(ana.projectedAnnualCents).toBe(Math.round(20_000 * (365 / 60)));
    expect(ana.tier).toBe("top");
  });

  it("marca cliente com uma visita como novo", () => {
    expect(clientValueReport(appts, clients, NOW).rows[1].tier).toBe("novo");
  });

  it("classifica clientes fiéis e ocasionais abaixo do limite de concentração", () => {
    const rows = [
      appt({ id: "top-1", clientId: "top", startsAt: "2026-01-01T10:00:00.000Z", totalPriceCents: 60_000 }),
      appt({ id: "top-2", clientId: "top", startsAt: "2026-02-01T10:00:00.000Z", totalPriceCents: 60_000 }),
      appt({ id: "top-3", clientId: "top", startsAt: "2026-03-01T10:00:00.000Z", totalPriceCents: 60_000 }),
      appt({ id: "faithful-1", clientId: "faithful", startsAt: "2026-01-01T10:00:00.000Z", totalPriceCents: 10_000 }),
      appt({ id: "faithful-2", clientId: "faithful", startsAt: "2026-02-01T10:00:00.000Z", totalPriceCents: 10_000 }),
      appt({ id: "faithful-3", clientId: "faithful", startsAt: "2026-03-01T10:00:00.000Z", totalPriceCents: 10_000 }),
      appt({ id: "occasional-1", clientId: "occasional", startsAt: "2026-01-01T10:00:00.000Z", totalPriceCents: 5_000 }),
      appt({ id: "occasional-2", clientId: "occasional", startsAt: "2026-02-01T10:00:00.000Z", totalPriceCents: 5_000 }),
    ];
    const report = clientValueReport(rows, [], NOW);
    expect(Object.fromEntries(report.rows.map((row) => [row.clientId, row.tier]))).toEqual({
      top: "top",
      faithful: "fiel",
      occasional: "ocasional",
    });
  });

  it("mede concentração de receita e mediana", () => {
    const r = clientValueReport(appts, clients, NOW);
    expect(r.topSharePct).toBeCloseTo(92.3, 1);
    expect(r.medianValueCents).toBe(Math.round((60_000 + 5_000) / 2));
    expect(r.averageValueCents).toBe(32_500);
  });

  it("retorna zeros sem dados", () => {
    const r = clientValueReport([], [], NOW);
    expect(r).toMatchObject({ rows: [], totalRevenueCents: 0, topSharePct: 0, averageValueCents: 0 });
  });
});

describe("revenueForecast", () => {
  const history = [
    appt({ id: "h1", clientId: "c1", startsAt: "2026-03-10T10:00:00.000Z", totalPriceCents: 100_000 }),
    appt({ id: "h2", clientId: "c1", startsAt: "2026-04-10T10:00:00.000Z", totalPriceCents: 200_000 }),
    appt({ id: "h3", clientId: "c1", startsAt: "2026-05-10T10:00:00.000Z", totalPriceCents: 300_000 }),
  ];
  const future = [
    appt({
      id: "f1",
      clientId: "c1",
      startsAt: new Date(NOW + 5 * DAY).toISOString(),
      status: "pending",
      totalPriceCents: 50_000,
    }),
    appt({
      id: "f2",
      clientId: "c1",
      startsAt: new Date(NOW + 40 * DAY).toISOString(),
      status: "canceled",
      totalPriceCents: 90_000,
    }),
  ];

  it("usa a média dos últimos meses fechados como base", () => {
    const f = revenueForecast(history, future, 3, NOW);
    expect(f.baselineMonthlyCents).toBe(200_000);
    expect(f.trendPct).toBe(50);
  });

  it("ignora cancelados no que está marcado à frente", () => {
    const f = revenueForecast(history, future, 3, NOW);
    expect(f.bookedAheadCents).toBe(50_000);
  });

  it("projeta pelo menos a média mensal", () => {
    const f = revenueForecast(history, future, 3, NOW);
    const futures = f.points.filter((p) => p.isFuture);
    expect(futures).toHaveLength(4);
    expect(futures.every((p) => p.forecastCents >= 200_000)).toBe(true);
    expect(f.next30Cents).toBe(200_000);
    expect(f.next90Cents).toBe(600_000);
  });

  it("sem histórico, previsão acompanha o que está marcado", () => {
    const f = revenueForecast([], future, 1, NOW);
    expect(f.baselineMonthlyCents).toBe(0);
    expect(f.next30Cents).toBe(50_000);
  });
});
