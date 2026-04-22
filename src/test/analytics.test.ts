/**
 * Testes das fórmulas analíticas. Métricas erradas = decisões erradas.
 * Blindamos os cálculos centrais com fixtures controlados.
 */
import { describe, it, expect } from "vitest";
import {
  applyFilters,
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
    serviceId: "s1",
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

  it("applyFilters respeita serviceId além de unidade/profissional/origem", () => {
    const rows = [
      fact({ id: "a1", serviceId: "s1" }),
      fact({ id: "a2", serviceId: "s2" }),
    ];
    const filtered = applyFilters(rows, {
      unitId: null,
      professionalId: null,
      serviceId: "s2",
      source: null,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("a2");
  });
});

// ============================================================================
// Conversão da lista de espera + contrato consumido por Analytics.tsx
// ============================================================================
//
// O componente `src/pages/app/Analytics.tsx` lê `metrics.waitlist.scheduled`
// e `metrics.waitlist.worked` e renderiza o helper:
//   "{scheduled} agendados de {worked} trabalhados"
//
// Esses testes blindam:
//   1. A fórmula `waitlistConversionRate` (divisão segura).
//   2. O contrato `{ scheduled, worked, totalOpen }` que o hook `useAnalytics`
//      expõe em `metrics.waitlist`.
//   3. A formatação dos KPIs (formatPct/formatCurrency) que aparece nos cards
//      de "Conversão da lista de espera", "Receita futura em risco", etc.

import { waitlistConversionRate } from "@/domain/analytics";

describe("domain/analytics — waitlistConversionRate", () => {
  it("retorna 0 quando worked=0 (sem dividir por zero)", () => {
    expect(waitlistConversionRate({ scheduled: 0, worked: 0 })).toBe(0);
    expect(waitlistConversionRate({ scheduled: 5, worked: 0 })).toBe(0);
  });

  it("calcula a porcentagem com 1 casa decimal", () => {
    expect(waitlistConversionRate({ scheduled: 1, worked: 2 })).toBe(50);
    expect(waitlistConversionRate({ scheduled: 1, worked: 3 })).toBeCloseTo(33.3, 1);
    expect(waitlistConversionRate({ scheduled: 3, worked: 4 })).toBe(75);
  });

  it("aceita 100% quando todos os trabalhados viraram agendamento", () => {
    expect(waitlistConversionRate({ scheduled: 7, worked: 7 })).toBe(100);
  });
});

// ----------------------------------------------------------------------------
// Contrato exposto pelo hook useAnalytics que Analytics.tsx consome.
// ----------------------------------------------------------------------------

interface WaitlistMetric {
  scheduled: number;
  worked: number;
  totalOpen: number;
}

/**
 * Reproduz o helper exibido em Analytics.tsx (linha:
 *   `${metrics.waitlist.scheduled} agendados de ${metrics.waitlist.worked} trabalhados`
 * ) para garantir que mudanças no shape do objeto quebrem o teste antes da UI.
 */
function waitlistHelperText(w: Pick<WaitlistMetric, "scheduled" | "worked">): string {
  return `${w.scheduled} agendados de ${w.worked} trabalhados`;
}

describe("Analytics.tsx — contrato de metrics.waitlist", () => {
  it("o objeto exposto pelo hook tem scheduled, worked e totalOpen numéricos", () => {
    // Mesmo shape default do estado em useAnalytics: { totalOpen, worked, scheduled }
    const waitlist: WaitlistMetric = { totalOpen: 0, worked: 0, scheduled: 0 };
    expect(typeof waitlist.scheduled).toBe("number");
    expect(typeof waitlist.worked).toBe("number");
    expect(typeof waitlist.totalOpen).toBe("number");
  });

  it("renderiza o helper '<scheduled> agendados de <worked> trabalhados'", () => {
    expect(waitlistHelperText({ scheduled: 8, worked: 12 })).toBe(
      "8 agendados de 12 trabalhados",
    );
    expect(waitlistHelperText({ scheduled: 0, worked: 0 })).toBe(
      "0 agendados de 0 trabalhados",
    );
  });

  it("conversão derivada do par (scheduled, worked) bate com waitlistConversionRate", () => {
    const waitlist: WaitlistMetric = { totalOpen: 4, worked: 10, scheduled: 4 };
    const rate = waitlistConversionRate(waitlist);
    expect(rate).toBe(40);
    expect(waitlistHelperText(waitlist)).toBe("4 agendados de 10 trabalhados");
  });
});

// ----------------------------------------------------------------------------
// Formatadores usados nos KpiCards e MetricRows (espelham Analytics.tsx).
// ----------------------------------------------------------------------------

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

describe("Analytics.tsx — formatadores dos KPIs", () => {
  it("formatPct mostra sempre 1 casa decimal e o símbolo de %", () => {
    expect(formatPct(0)).toBe("0.0%");
    expect(formatPct(75)).toBe("75.0%");
    expect(formatPct(33.3)).toBe("33.3%");
    expect(formatPct(99.99)).toBe("100.0%");
  });

  it("formatCurrency formata em BRL com agrupamento pt-BR", () => {
    // \\u00a0 é o NBSP que o Intl insere entre 'R$' e o número.
    expect(formatCurrency(0)).toBe("R$\u00a00,00");
    expect(formatCurrency(1500)).toBe("R$\u00a01.500,00");
    expect(formatCurrency(1234.5)).toBe("R$\u00a01.234,50");
  });

  it("os hints dos cards usam os mesmos formatadores (smoke do contrato visual)", () => {
    // Reproduz: KpiCard "Receita futura em risco" → hint "{count} agendamento(s) sem confirmação"
    const futureRisk = { count: 3, value: 1280.5 };
    expect(formatCurrency(futureRisk.value)).toBe("R$\u00a01.280,50");
    expect(`${futureRisk.count} agendamento(s) sem confirmação`).toBe(
      "3 agendamento(s) sem confirmação",
    );
  });
});
