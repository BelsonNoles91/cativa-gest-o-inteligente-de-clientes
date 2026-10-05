import { afterEach, describe, expect, it, vi } from "vitest";
import {
  avgHoursToConfirm,
  averageTicket,
  brandLoyalty,
  crmCompleteness,
  estimatedLtv,
  futureBookedValue,
  futureRevenueAtRisk,
  hourlyProfitability,
  idealWindowAdherence,
  indexLabel,
  newVsReturning,
  nextBestActions,
  noShowRecoveryRate,
  packageCompletionRate,
  professionalLoyalty,
  rangeFromPreset,
  sourceBreakdown,
  ticketByGroup,
  visitConversion,
  type ApptFact,
  type ClientFact,
} from "@/domain/analytics";

const period = {
  start: new Date("2026-01-01T00:00:00.000Z"),
  end: new Date("2026-05-02T00:00:00.000Z"),
};

function appointment(overrides: Partial<ApptFact> = {}): ApptFact {
  return {
    id: "appointment",
    tenantId: "tenant-a",
    unitId: "unit-a",
    professionalId: "professional-a",
    serviceId: "service-a",
    clientId: "client-a",
    startsAt: "2026-03-01T10:00:00.000Z",
    endsAt: "2026-03-01T11:00:00.000Z",
    durationMinutes: 60,
    status: "completed",
    source: "frontdesk",
    totalPriceCents: 10_000,
    isOverbooked: false,
    confirmedAt: "2026-02-28T10:00:00.000Z",
    remindedAt: null,
    noShowAt: null,
    canceledAt: null,
    completedAt: "2026-03-01T11:00:00.000Z",
    createdAt: "2026-02-01T10:00:00.000Z",
    ...overrides,
  };
}

function client(overrides: Partial<ClientFact> = {}): ClientFact {
  return {
    id: "client-a",
    createdAt: "2026-01-01T00:00:00.000Z",
    isVip: false,
    fullName: "Cliente de teste",
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
    ...overrides,
  };
}

afterEach(() => vi.useRealTimers());

describe("domain/analytics — métricas e limites de calendário", () => {
  it("calcula todos os presets incluindo virada de mês, ano e ontem", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 31, 15, 45, 30, 123));

    const expectedRanges = [
      ["today", new Date(2026, 2, 31, 0, 0, 0, 0), new Date(2026, 2, 31, 23, 59, 59, 999)],
      ["yesterday", new Date(2026, 2, 30, 0, 0, 0, 0), new Date(2026, 2, 30, 23, 59, 59, 999)],
      ["last_7d", new Date(2026, 2, 25, 0, 0, 0, 0), new Date(2026, 2, 31, 23, 59, 59, 999)],
      ["last_30d", new Date(2026, 2, 2, 0, 0, 0, 0), new Date(2026, 2, 31, 23, 59, 59, 999)],
      ["last_90d", new Date(2026, 0, 1, 0, 0, 0, 0), new Date(2026, 2, 31, 23, 59, 59, 999)],
      ["this_month", new Date(2026, 2, 1, 0, 0, 0, 0), new Date(2026, 2, 31, 23, 59, 59, 999)],
      ["last_month", new Date(2026, 1, 1, 0, 0, 0, 0), new Date(2026, 1, 28, 23, 59, 59, 999)],
      ["ytd", new Date(2026, 0, 1, 0, 0, 0, 0), new Date(2026, 2, 31, 23, 59, 59, 999)],
    ] as const;

    for (const [preset, start, end] of expectedRanges) {
      expect(rangeFromPreset(preset)).toEqual({ start, end });
    }
  });

  it("agrega tickets concluídos por grupo, omite outros estados e ordena por receita", () => {
    const rows = [
      appointment({ id: "a-1", professionalId: "a", totalPriceCents: 10_001 }),
      appointment({ id: "a-2", professionalId: "a", totalPriceCents: 19_999 }),
      appointment({ id: "b-1", professionalId: "b", totalPriceCents: 20_000 }),
      appointment({ id: "a-pending", professionalId: "a", status: "pending", totalPriceCents: 900_000 }),
    ];

    expect(ticketByGroup(rows, (row) => row.professionalId, (key) => `Profissional ${key}`)).toEqual([
      { key: "a", label: "Profissional a", ticket: 150, visits: 2, revenue: 300 },
      { key: "b", label: "Profissional b", ticket: 200, visits: 1, revenue: 200 },
    ]);
  });

  it("preserva centavos nas métricas monetárias e ordena receita com precisão", () => {
    const rows = [
      appointment({ id: "group-b", professionalId: "b", totalPriceCents: 20_000 }),
      appointment({ id: "group-a-1", professionalId: "a", totalPriceCents: 10_001 }),
      appointment({ id: "group-a-2", professionalId: "a", totalPriceCents: 10_002 }),
    ];

    expect(averageTicket([
      appointment({ id: "half-cent-a", totalPriceCents: 10_005 }),
      appointment({ id: "half-cent-b", totalPriceCents: 10_006 }),
    ])).toBe(100.06);
    expect(ticketByGroup(rows, (row) => row.professionalId, (key) => key)).toEqual([
      { key: "a", label: "a", ticket: 100.02, visits: 2, revenue: 200.03 },
      { key: "b", label: "b", ticket: 200, visits: 1, revenue: 200 },
    ]);
    expect(futureBookedValue([
      appointment({ status: "pending", totalPriceCents: 10_123 }),
      appointment({ status: "confirmed", totalPriceCents: 10_001 }),
      appointment({ status: "canceled", totalPriceCents: 90_000 }),
    ])).toBe(201.24);
    expect(futureRevenueAtRisk([
      appointment({ status: "pending", confirmedAt: null, totalPriceCents: 10_123 }),
      appointment({ status: "confirmed", confirmedAt: "2026-02-28T10:00:00Z", totalPriceCents: 10_001 }),
    ])).toEqual({ value: 101.23, count: 1 });
    expect(hourlyProfitability(
      [appointment({ totalPriceCents: 10_001, durationMinutes: 60 })],
      (row) => row.professionalId,
      (key) => key,
    )).toEqual([{ label: "professional-a", hourlyRate: 100.01 }]);
    expect(estimatedLtv([appointment({ totalPriceCents: 10_001 })], [])).toBe(1200.12);
  });

  it("mede conversão de N para N+1 dentro da janela inclusiva e ignora outras situações", () => {
    const rows = [
      appointment({ id: "a1", clientId: "a", startsAt: "2026-03-01T10:00:00Z" }),
      appointment({ id: "a2", clientId: "a", startsAt: "2026-03-31T10:00:00Z" }),
      appointment({ id: "b1", clientId: "b", startsAt: "2026-04-02T00:00:00Z" }),
      appointment({ id: "b2", clientId: "b", startsAt: "2026-05-02T10:00:00Z" }),
      appointment({ id: "c1", clientId: "c", status: "canceled", startsAt: "2026-03-01T10:00:00Z" }),
    ];

    expect(visitConversion(rows, 1, 30, period)).toEqual({ rate: 50, eligible: 2, converted: 1 });
  });

  it("recupera no-show pela remarcação até o limite, usando o no-show mais recente", () => {
    const rows = [
      appointment({ id: "a-old", clientId: "a", status: "no_show", startsAt: "2026-01-01T10:00:00Z" }),
      appointment({ id: "a-latest", clientId: "a", status: "no_show", startsAt: "2026-01-10T10:00:00Z" }),
      appointment({ id: "a-return", clientId: "a", status: "confirmed", startsAt: "2026-01-24T10:00:00Z" }),
      appointment({ id: "b-no-show", clientId: "b", status: "no_show", startsAt: "2026-01-02T10:00:00Z" }),
      appointment({ id: "b-canceled", clientId: "b", status: "canceled", startsAt: "2026-01-03T10:00:00Z" }),
    ];

    expect(noShowRecoveryRate(rows, 14)).toEqual({ rate: 50, eligible: 2, recovered: 1 });
  });

  it("limita tempos de confirmação negativos e arredonda horas em uma casa", () => {
    const rows = [
      appointment({ id: "early", createdAt: "2026-02-01T12:00:00Z", confirmedAt: "2026-02-01T11:00:00Z" }),
      appointment({ id: "normal", createdAt: "2026-02-01T10:00:00Z", confirmedAt: "2026-02-01T14:30:00Z" }),
      appointment({ id: "open", confirmedAt: null }),
    ];
    expect(avgHoursToConfirm(rows)).toBe(2.3);
    expect(avgHoursToConfirm([])).toBe(0);
  });

  it("classifica clientes novos uma única vez no período e trata histórico ausente como recorrente", () => {
    const rows = [
      appointment({ id: "new-1", clientId: "new", startsAt: "2026-01-03T10:00:00Z" }),
      appointment({ id: "new-2", clientId: "new", startsAt: "2026-01-20T10:00:00Z" }),
      appointment({ id: "returning", clientId: "returning", startsAt: "2026-01-10T10:00:00Z" }),
      appointment({ id: "unknown", clientId: "unknown", startsAt: "2026-01-15T10:00:00Z" }),
      appointment({ id: "outside", clientId: "outside", startsAt: "2025-12-31T23:59:59Z" }),
    ];
    const clients = [
      client({ id: "new", firstVisitAt: "2026-01-03T10:00:00Z" }),
      client({ id: "returning", firstVisitAt: "2025-12-01T10:00:00Z" }),
    ];

    expect(newVsReturning(rows, clients, period)).toEqual({ news: 1, returning: 2, total: 3 });
  });

  it("conta apenas clientes com visita atendida, não reservas futuras, faltas ou cancelamentos", () => {
    const rows = [
      appointment({ id: "new-completed-1", clientId: "new", startsAt: "2026-01-03T10:00:00Z" }),
      appointment({ id: "new-completed-2", clientId: "new", startsAt: "2026-01-20T10:00:00Z" }),
      appointment({ id: "returning-arrived", clientId: "returning", status: "arrived" }),
      appointment({ id: "new-in-service", clientId: "in-service" , status: "in_service" }),
      appointment({ id: "unknown-completed", clientId: "unknown" }),
      appointment({ id: "cancelled-only", clientId: "cancelled", status: "canceled" }),
      appointment({ id: "no-show-only", clientId: "no-show", status: "no_show" }),
      appointment({ id: "pending-only", clientId: "pending", status: "pending" }),
    ];
    const clients = [
      client({ id: "new", firstVisitAt: "2026-01-03T10:00:00Z" }),
      client({ id: "returning", firstVisitAt: "2025-12-01T10:00:00Z" }),
      client({ id: "in-service", firstVisitAt: "2026-01-20T10:00:00Z" }),
      client({ id: "cancelled", firstVisitAt: "2026-01-20T10:00:00Z" }),
      client({ id: "no-show", firstVisitAt: "2026-01-20T10:00:00Z" }),
      client({ id: "pending", firstVisitAt: "2026-01-20T10:00:00Z" }),
    ];

    expect(newVsReturning(rows, clients, period)).toEqual({ news: 2, returning: 2, total: 4 });
  });

  it("reconcilia a distribuição por origem e mantém a ordem por volume", () => {
    const result = sourceBreakdown([
      appointment({ source: "phone" }),
      appointment({ source: "client_portal" }),
      appointment({ source: "phone" }),
    ]);
    expect(result).toEqual([
      { source: "phone", count: 2, pct: 66.7 },
      { source: "client_portal", count: 1, pct: 33.3 },
    ]);
    expect(result.reduce((sum, item) => sum + item.pct, 0)).toBe(100);
    expect(sourceBreakdown([])).toEqual([]);
  });

  it("reconcilia contagens e percentuais por origem em 256 distribuições determinísticas", () => {
    const sources = ["phone", "client_portal", "walk_in", "whatsapp"] as const;
    for (let seed = 0; seed < 256; seed += 1) {
      const rows = Array.from({ length: 1 + seed % 71 }, (_, index) =>
        appointment({
          id: `${seed}-${index}`,
          source: sources[(seed * 13 + index * 7 + Math.floor(index / 3)) % sources.length],
        }),
      );
      const expectedCounts = new Map<string, number>();
      for (const row of rows) expectedCounts.set(row.source, (expectedCounts.get(row.source) ?? 0) + 1);

      const breakdown = sourceBreakdown(rows);
      expect(breakdown.reduce((sum, row) => sum + row.count, 0)).toBe(rows.length);
      expect(Math.round(breakdown.reduce((sum, row) => sum + row.pct, 0) * 10) / 10).toBe(100);
      expect(breakdown.map(({ source, count }) => [source, count])).toEqual(
        [...expectedCounts.entries()].sort((a, b) => b[1] - a[1]),
      );
    }
  });

  it("mede lealdade profissional e de marca apenas com visitas concluídas", () => {
    const rows = [
      appointment({ clientId: "loyal", professionalId: "p1" }),
      appointment({ clientId: "loyal", professionalId: "p1" }),
      appointment({ clientId: "loyal", professionalId: "p1" }),
      appointment({ clientId: "loyal", professionalId: "p1" }),
      appointment({ clientId: "loyal", professionalId: "p2" }),
      appointment({ clientId: "split", professionalId: "p1" }),
      appointment({ clientId: "split", professionalId: "p1" }),
      appointment({ clientId: "split", professionalId: "p2" }),
      appointment({ clientId: "single" }),
      appointment({ clientId: "loyal", status: "canceled" }),
    ];
    expect(professionalLoyalty(rows)).toEqual({ rate: 50, loyal: 1, recurring: 2 });
    expect(brandLoyalty(rows)).toEqual({ rate: 66.7, recurring: 2, total: 3 });
    expect(professionalLoyalty([])).toEqual({ rate: 0, loyal: 0, recurring: 0 });
  });

  it("calcula completude do CRM sobre os oito campos e cobre base vazia", () => {
    const complete = client({
      email: "cliente@example.test",
      phone: "11999999999",
      whatsappPhone: "11999999999",
      birthDate: "1990-01-01",
      preferences: "Sem fragrância",
      preferredProfessionalId: "professional-a",
      preferredUnitId: "unit-a",
    });
    expect(crmCompleteness([complete, client({ id: "partial" })])).toBe(56.3);
    expect(crmCompleteness([])).toBe(0);
  });

  it("conta retornos dentro da janela ideal incluindo seus extremos", () => {
    const rows = [
      appointment({ id: "a1", clientId: "a", startsAt: "2026-01-01T10:00:00Z" }),
      appointment({ id: "a2", clientId: "a", startsAt: "2026-01-31T10:00:00Z" }),
      appointment({ id: "b1", clientId: "b", startsAt: "2026-01-01T10:00:00Z" }),
      appointment({ id: "b2", clientId: "b", startsAt: "2026-03-03T10:00:00Z" }),
      appointment({ id: "c1", clientId: "c", startsAt: "2026-01-01T10:00:00Z" }),
      appointment({ id: "not-completed", clientId: "c", status: "no_show", startsAt: "2026-01-10T10:00:00Z" }),
    ];
    expect(idealWindowAdherence(rows, { min: 30, max: 60 })).toEqual({ rate: 50, eligible: 2, in_window: 1 });
  });

  it("calcula conclusão de pacotes somente por pacote concluído", () => {
    expect(packageCompletionRate([{ used: 1, total: 1 }, { used: 4, total: 3 }, { used: 2, total: 5 }])).toBe(66.7);
    expect(packageCompletionRate([])).toBe(0);
  });

  it("rotula o índice em todos os limites definidos", () => {
    expect(indexLabel(39)).toEqual({ label: "Crítico", tone: "danger" });
    expect(indexLabel(40)).toEqual({ label: "Atenção", tone: "warning" });
    expect(indexLabel(60)).toEqual({ label: "Bom", tone: "info" });
    expect(indexLabel(80)).toEqual({ label: "Excelente", tone: "success" });
  });

  it("gera ações prioritárias pelas faixas de risco e não gera ação nos limites saudáveis", () => {
    const actions = nextBestActions({
      confirmationPct: 69.9,
      conv1to2Pct: 49.9,
      occupancyPct: 59.9,
      idealWindowPct: 49.9,
      pendingPackages: 2,
      highValueUnconfirmed: 3,
      reactivableClients: 4,
    });
    expect(actions.map(({ id }) => id)).toEqual([
      "low_confirmation",
      "low_first_to_second",
      "high_value",
      "low_occupancy",
      "out_of_window",
      "pending_packages",
      "reactivate",
    ]);
    expect(nextBestActions({
      confirmationPct: 70,
      conv1to2Pct: 50,
      occupancyPct: 60,
      idealWindowPct: 50,
      pendingPackages: 0,
      highValueUnconfirmed: 0,
      reactivableClients: 0,
    })).toEqual([]);
  });

  it("compara rentabilidade por hora e estima LTV apenas sobre atendimentos concluídos", () => {
    const rows = [
      appointment({ id: "p1-a", clientId: "client-a", professionalId: "p1", totalPriceCents: 10_000, durationMinutes: 60 }),
      appointment({ id: "p1-b", clientId: "client-a", professionalId: "p1", totalPriceCents: 20_000, durationMinutes: 120 }),
      appointment({ id: "p2-a", clientId: "client-b", professionalId: "p2", totalPriceCents: 30_000, durationMinutes: 30 }),
      appointment({ id: "ignored", professionalId: "p3", status: "no_show", totalPriceCents: 900_000 }),
    ];
    expect(hourlyProfitability(rows, (row) => row.professionalId, (key) => key)).toEqual([
      { label: "p2", hourlyRate: 600 },
      { label: "p1", hourlyRate: 100 },
    ]);
    expect(estimatedLtv(rows, [])).toBe(3600);
    expect(estimatedLtv([], [])).toBe(0);
  });
});
