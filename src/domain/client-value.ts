/**
 * Valor do cliente e previsão de faturamento.
 *
 * Camada de domínio pura (sem UI e sem acesso a dados): recebe os fatos já
 * carregados pelo repositório de analytics e deriva:
 *  - o valor histórico de cada cliente e o valor projetado para 12 meses;
 *  - a concentração de receita (quanto os 20% maiores representam);
 *  - a previsão de faturamento dos próximos meses.
 */
import type { ApptFact, ClientFact } from "./analytics";

const DAY = 86_400_000;

export type ClientTier = "top" | "fiel" | "ocasional" | "novo";

export interface ClientValueRow {
  clientId: string;
  name: string;
  visits: number;
  revenueCents: number;
  averageTicketCents: number;
  lastVisitAt: string | null;
  daysSinceLastVisit: number | null;
  averageIntervalDays: number | null;
  /** Receita esperada em 12 meses mantendo a frequência atual. */
  projectedAnnualCents: number;
  tier: ClientTier;
}

export interface ClientValueReport {
  rows: ClientValueRow[];
  payingClients: number;
  totalRevenueCents: number;
  averageValueCents: number;
  medianValueCents: number;
  /** Percentual da receita concentrada nos 20% maiores clientes. */
  topSharePct: number;
  /** Soma da projeção anual de todos os clientes ativos. */
  projectedAnnualCents: number;
}

export interface ForecastPoint {
  month: string;
  actualCents: number;
  bookedCents: number;
  forecastCents: number;
  isFuture: boolean;
}

export interface RevenueForecast {
  points: ForecastPoint[];
  baselineMonthlyCents: number;
  next30Cents: number;
  next90Cents: number;
  bookedAheadCents: number;
  trendPct: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
    : sorted[mid];
}

function tierOf(visits: number, revenueCents: number, threshold: number): ClientTier {
  if (visits <= 1) return "novo";
  if (revenueCents >= threshold && visits >= 3) return "top";
  if (visits >= 3) return "fiel";
  return "ocasional";
}

/**
 * Relatório de valor do cliente.
 * Considera apenas atendimentos concluídos (receita realizada).
 */
export function clientValueReport(
  appts: ApptFact[],
  clients: ClientFact[],
  now: number = Date.now(),
): ClientValueReport {
  const names = new Map(clients.map((c) => [c.id, c.fullName]));
  const byClient = new Map<string, { revenue: number; times: number[] }>();

  for (const appt of appts) {
    if (appt.status !== "completed") continue;
    const cur = byClient.get(appt.clientId) ?? { revenue: 0, times: [] };
    cur.revenue += appt.totalPriceCents ?? 0;
    cur.times.push(new Date(appt.startsAt).getTime());
    byClient.set(appt.clientId, cur);
  }

  const revenues = [...byClient.values()].map((v) => v.revenue);
  const totalRevenueCents = revenues.reduce((acc, v) => acc + v, 0);
  const sortedRevenues = [...revenues].sort((a, b) => b - a);
  const topCount = Math.max(1, Math.ceil(sortedRevenues.length * 0.2));
  const topRevenue = sortedRevenues.slice(0, topCount).reduce((acc, v) => acc + v, 0);
  const topThreshold = sortedRevenues[topCount - 1] ?? 0;

  const rows: ClientValueRow[] = [];
  for (const [clientId, data] of byClient) {
    data.times.sort((a, b) => a - b);
    const visits = data.times.length;
    const last = data.times[visits - 1];
    const first = data.times[0];
    const averageIntervalDays =
      visits > 1 ? Math.round((last - first) / (visits - 1) / DAY) : null;
    const averageTicketCents = Math.round(data.revenue / visits);
    const visitsPerYear =
      averageIntervalDays && averageIntervalDays > 0 ? 365 / averageIntervalDays : 1;

    rows.push({
      clientId,
      name: names.get(clientId) ?? "Cliente",
      visits,
      revenueCents: data.revenue,
      averageTicketCents,
      lastVisitAt: new Date(last).toISOString(),
      daysSinceLastVisit: Math.floor((now - last) / DAY),
      averageIntervalDays,
      projectedAnnualCents: Math.round(averageTicketCents * visitsPerYear),
      tier: tierOf(visits, data.revenue, topThreshold),
    });
  }

  rows.sort((a, b) => b.revenueCents - a.revenueCents);

  return {
    rows,
    payingClients: rows.length,
    totalRevenueCents,
    averageValueCents: rows.length > 0 ? Math.round(totalRevenueCents / rows.length) : 0,
    medianValueCents: median(revenues),
    topSharePct:
      totalRevenueCents > 0 ? Math.round((topRevenue / totalRevenueCents) * 1000) / 10 : 0,
    projectedAnnualCents: rows.reduce((acc, r) => acc + r.projectedAnnualCents, 0),
  };
}

/**
 * Previsão de faturamento.
 * Histórico = receita concluída por mês. Futuro = o maior entre o que já está
 * marcado na agenda e a média dos últimos meses fechados.
 */
export function revenueForecast(
  appts: ApptFact[],
  future: ApptFact[],
  monthsAhead = 3,
  now: number = Date.now(),
): RevenueForecast {
  const today = new Date(now);
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const actual = new Map<string, number>();
  for (const appt of appts) {
    if (appt.status !== "completed") continue;
    const key = monthKey(new Date(appt.startsAt));
    actual.set(key, (actual.get(key) ?? 0) + (appt.totalPriceCents ?? 0));
  }

  const booked = new Map<string, number>();
  for (const appt of future) {
    if (appt.status === "canceled" || appt.status === "no_show") continue;
    const key = monthKey(new Date(appt.startsAt));
    booked.set(key, (booked.get(key) ?? 0) + (appt.totalPriceCents ?? 0));
  }

  const closedMonths = [...actual.entries()]
    .filter(([key]) => key < monthKey(currentMonth))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const lastThree = closedMonths.slice(-3);
  const baselineMonthlyCents =
    lastThree.length > 0
      ? Math.round(lastThree.reduce((acc, [, v]) => acc + v, 0) / lastThree.length)
      : 0;

  const prev = closedMonths[closedMonths.length - 2]?.[1] ?? 0;
  const last = closedMonths[closedMonths.length - 1]?.[1] ?? 0;
  const trendPct = prev > 0 ? Math.round(((last - prev) / prev) * 1000) / 10 : 0;

  const points: ForecastPoint[] = [];
  for (const [month, value] of closedMonths) {
    points.push({
      month,
      actualCents: value,
      bookedCents: booked.get(month) ?? 0,
      forecastCents: value,
      isFuture: false,
    });
  }

  for (let i = 0; i <= monthsAhead; i += 1) {
    const monthDate = addMonths(currentMonth, i);
    const key = monthKey(monthDate);
    const actualCents = actual.get(key) ?? 0;
    const bookedCents = booked.get(key) ?? 0;
    points.push({
      month: key,
      actualCents,
      bookedCents,
      forecastCents: Math.max(actualCents + bookedCents, baselineMonthlyCents),
      isFuture: true,
    });
  }

  const horizon = new Map<string, number>();
  for (const appt of future) {
    if (appt.status === "canceled" || appt.status === "no_show") continue;
    horizon.set(appt.id, appt.totalPriceCents ?? 0);
  }
  const bookedAheadCents = [...horizon.values()].reduce((acc, v) => acc + v, 0);

  const sumAhead = (days: number) =>
    future
      .filter((a) => {
        if (a.status === "canceled" || a.status === "no_show") return false;
        const t = new Date(a.startsAt).getTime();
        return t >= now && t <= now + days * DAY;
      })
      .reduce((acc, a) => acc + (a.totalPriceCents ?? 0), 0);

  const booked30 = sumAhead(30);
  const booked90 = sumAhead(90);

  return {
    points,
    baselineMonthlyCents,
    next30Cents: Math.max(booked30, baselineMonthlyCents),
    next90Cents: Math.max(booked90, baselineMonthlyCents * 3),
    bookedAheadCents,
    trendPct,
  };
}
