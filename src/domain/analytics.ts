/**
 * Domínio: Analytics, métricas e Índice Cativa.
 *
 * - Tipos puros (sem Supabase).
 * - Fórmulas claras e documentadas (cada métrica é uma função pura).
 * - Cada componente do Índice Cativa é normalizado em 0..100 e ponderado.
 *
 * Filtros aplicáveis a TODAS as métricas:
 *   - period (start..end)
 *   - unitId | null (todas)
 *   - professionalId | null (todos)
 *   - serviceId | null (todos)
 *   - source | null (todas)
 */

import type { AppointmentSource, AppointmentStatus } from "./scheduling";

// ----------------------------------------------------------------------------
// Filtros
// ----------------------------------------------------------------------------

export interface AnalyticsFilters {
  start: string; // ISO
  end: string;   // ISO (exclusivo)
  unitId: string | null;
  professionalId: string | null;
  serviceId: string | null;
  source: AppointmentSource | null;
}

export type AnalyticsPreset =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_30d"
  | "last_90d"
  | "this_month"
  | "last_month"
  | "ytd";

export function rangeFromPreset(preset: AnalyticsPreset): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (preset) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "yesterday":
      start.setDate(start.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(end.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case "last_7d":
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_30d":
      start.setDate(start.getDate() - 29);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_90d":
      start.setDate(start.getDate() - 89);
      start.setHours(0, 0, 0, 0);
      break;
    case "this_month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_month":
      start.setMonth(start.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0); // último dia do mês anterior
      end.setHours(23, 59, 59, 999);
      break;
    case "ytd":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }
  return { start, end };
}

export const presetLabels: Record<AnalyticsPreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  last_7d: "Últimos 7 dias",
  last_30d: "Últimos 30 dias",
  last_90d: "Últimos 90 dias",
  this_month: "Este mês",
  last_month: "Mês passado",
  ytd: "Ano até hoje",
};

// ----------------------------------------------------------------------------
// Modelos crus que vêm do repositório (visão analítica)
// ----------------------------------------------------------------------------

export interface ApptFact {
  id: string;
  tenantId: string;
  unitId: string;
  professionalId: string;
  serviceId: string | null;
  clientId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
  source: AppointmentSource;
  totalPriceCents: number;
  isOverbooked: boolean;
  confirmedAt: string | null;
  remindedAt: string | null;
  noShowAt: string | null;
  canceledAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AvailabilityFact {
  /** minutos disponíveis no período (horário da unidade × profissionais ativos × dias úteis) */
  availableMinutes: number;
  /** minutos reservados (todos os agendamentos não cancelados) */
  bookedMinutes: number;
  /** minutos efetivamente atendidos (concluídos) */
  completedMinutes: number;
}

export interface ContactAttemptFact {
  id: string;
  tenantId: string;
  appointmentId: string | null;
  channel: "whatsapp" | "sms" | "email" | "phone" | "in_person";
  result: string;
  attemptedAt: string;
}

export interface ClientFact {
  id: string;
  createdAt: string;
  isVip: boolean;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  birthDate: string | null;
  preferences: string | null;
  preferredProfessionalId: string | null;
  preferredUnitId: string | null;
  /** total de visitas concluídas (somado pelo repositório) */
  completedVisits: number;
  firstVisitAt: string | null;
  lastVisitAt: string | null;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function safeRatio(num: number, den: number): number {
  if (den <= 0) return 0;
  return num / den;
}

function clamp(n: number, min: number, max: number): number {
  const finite = Number.isFinite(n) ? n : min;
  return Math.max(min, Math.min(max, finite));
}

function pct(n: number): number {
  return Math.round(clamp(n, 0, 1) * 1000) / 10; // 1 casa, sempre 0..100
}

function reaisFromCents(cents: number): number {
  return Math.round(cents) / 100;
}

const ATTENDED_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "arrived",
  "in_service",
  "completed",
]);

/** Filtra um conjunto de appts pelos filtros declarados. */
export function applyFilters<T extends Pick<ApptFact, "unitId" | "professionalId" | "serviceId" | "source">>(
  rows: T[],
  f: Pick<AnalyticsFilters, "unitId" | "professionalId" | "serviceId" | "source">,
): T[] {
  return rows.filter(
    (r) =>
      (!f.unitId || r.unitId === f.unitId) &&
      (!f.professionalId || r.professionalId === f.professionalId) &&
      (!f.serviceId || r.serviceId === f.serviceId) &&
      (!f.source || r.source === f.source),
  );
}

// ----------------------------------------------------------------------------
// Métricas operacionais (cada função é uma fórmula documentada)
// ----------------------------------------------------------------------------

/** comparecimento = comparecimentos / agendamentos não cancelados no prazo */
export function attendanceRate(rows: ApptFact[]): { rate: number; attended: number; eligible: number } {
  const eligible = rows.filter((r) => r.status !== "canceled").length;
  const attended = rows.filter((r) => ATTENDED_STATUSES.has(r.status)).length;
  return { rate: pct(safeRatio(attended, eligible)), attended, eligible };
}

/** no-show = faltas / agendamentos não cancelados no prazo */
export function noShowRate(rows: ApptFact[]): { rate: number; noShows: number; eligible: number } {
  const eligible = rows.filter((r) => r.status !== "canceled").length;
  const noShows = rows.filter((r) => r.status === "no_show").length;
  return { rate: pct(safeRatio(noShows, eligible)), noShows, eligible };
}

/** cancelamento = cancelamentos / agendamentos marcados */
export function cancellationRate(rows: ApptFact[]): { rate: number; canceled: number; eligible: number } {
  const eligible = rows.length;
  const canceled = rows.filter((r) => r.status === "canceled").length;
  return { rate: pct(safeRatio(canceled, eligible)), canceled, eligible };
}

/** confirmação = agendamentos confirmados / agendamentos elegíveis para confirmação */
export function confirmationRate(rows: ApptFact[]): { rate: number; confirmed: number; eligible: number } {
  const eligibleRows = rows.filter(
    (r) => r.status !== "canceled" && r.status !== "no_show",
  );
  const eligible = eligibleRows.length;
  const confirmed = eligibleRows.filter(
    (r) =>
      r.confirmedAt !== null ||
      ["confirmed", "reminded", "arrived", "in_service", "completed"].includes(r.status),
  ).length;
  return { rate: pct(safeRatio(confirmed, eligible)), confirmed, eligible };
}

/** ocupação = minutos reservados / minutos disponíveis */
export function occupancyRate(av: AvailabilityFact): { rate: number } {
  return { rate: pct(safeRatio(av.bookedMinutes, av.availableMinutes)) };
}

/** Ticket médio (cents/100) — todos os concluídos. */
export function averageTicket(rows: ApptFact[]): number {
  const completed = rows.filter((r) => r.status === "completed");
  const total = completed.reduce((acc, r) => acc + r.totalPriceCents, 0);
  return reaisFromCents(safeRatio(total, completed.length));
}

export interface GroupTicket {
  key: string;
  label: string;
  ticket: number;
  visits: number;
  revenue: number;
}

export function ticketByGroup(
  rows: ApptFact[],
  keyOf: (r: ApptFact) => string,
  labelOf: (k: string) => string,
): GroupTicket[] {
  const map = new Map<string, { rev: number; cnt: number }>();
  for (const r of rows) {
    if (r.status !== "completed") continue;
    const k = keyOf(r);
    const cur = map.get(k) ?? { rev: 0, cnt: 0 };
    cur.rev += r.totalPriceCents;
    cur.cnt += 1;
    map.set(k, cur);
  }
  return Array.from(map.entries())
    .map(([k, v]) => ({
      key: k,
      label: labelOf(k),
      ticket: reaisFromCents(safeRatio(v.rev, v.cnt)),
      visits: v.cnt,
      revenue: reaisFromCents(v.rev),
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

/** Valor futuro agendado = soma de cents dos agendamentos futuros não cancelados. */
export function futureBookedValue(future: ApptFact[]): number {
  return reaisFromCents(
    future
      .filter((r) => r.status !== "canceled" && r.status !== "no_show")
      .reduce((acc, r) => acc + r.totalPriceCents, 0),
  );
}

/** Receita futura em risco = futuros sem confirmação. */
export function futureRevenueAtRisk(future: ApptFact[]): { value: number; count: number } {
  const risky = future.filter(
    (r) =>
      r.status !== "canceled" &&
      r.status !== "no_show" &&
      r.confirmedAt === null &&
      !["confirmed", "reminded", "arrived", "in_service", "completed"].includes(r.status),
  );
  return {
    value: reaisFromCents(risky.reduce((acc, r) => acc + r.totalPriceCents, 0)),
    count: risky.length,
  };
}

// ----------------------------------------------------------------------------
// Retenção, conversão e rebooking
// ----------------------------------------------------------------------------

/**
 * Retenção do negócio:
 *   clientes elegíveis que retornaram dentro da janela / clientes elegíveis
 *
 * Elegível = primeira visita concluída entre [start..end - windowDays].
 * Retornou = teve uma 2ª visita até windowDays após a 1ª.
 */
export function retentionRate(
  clients: ClientFact[],
  appts: ApptFact[],
  windowDays: number,
  range: { start: Date; end: Date },
): { rate: number; eligible: number; retained: number } {
  const cutoff = new Date(range.end.getTime() - windowDays * 86_400_000);
  // mapa cliente -> visitas concluídas ordenadas
  const visitsByClient = new Map<string, Date[]>();
  for (const a of appts) {
    if (a.status !== "completed") continue;
    const arr = visitsByClient.get(a.clientId) ?? [];
    arr.push(new Date(a.startsAt));
    visitsByClient.set(a.clientId, arr);
  }
  for (const [, arr] of visitsByClient) arr.sort((a, b) => a.getTime() - b.getTime());

  let eligible = 0;
  let retained = 0;
  for (const [, arr] of visitsByClient) {
    const first = arr[0];
    if (!first || first > cutoff || first < range.start) continue;
    eligible += 1;
    const limit = new Date(first.getTime() + windowDays * 86_400_000);
    if (arr.some((d, i) => i > 0 && d <= limit)) retained += 1;
  }
  return { rate: pct(safeRatio(retained, eligible)), eligible, retained };
}

/** Conversão de N-ésima para (N+1)-ésima visita. N começa em 1. */
export function visitConversion(
  appts: ApptFact[],
  nth: number,
  windowDays: number,
  range: { start: Date; end: Date },
): { rate: number; eligible: number; converted: number } {
  const visitsByClient = new Map<string, Date[]>();
  for (const a of appts) {
    if (a.status !== "completed") continue;
    const arr = visitsByClient.get(a.clientId) ?? [];
    arr.push(new Date(a.startsAt));
    visitsByClient.set(a.clientId, arr);
  }
  for (const [, arr] of visitsByClient) arr.sort((a, b) => a.getTime() - b.getTime());

  const cutoff = new Date(range.end.getTime() - windowDays * 86_400_000);
  let eligible = 0;
  let converted = 0;
  for (const [, arr] of visitsByClient) {
    const reference = arr[nth - 1];
    if (!reference || reference < range.start || reference > cutoff) continue;
    eligible += 1;
    const limit = new Date(reference.getTime() + windowDays * 86_400_000);
    if (arr[nth] && arr[nth] <= limit) converted += 1;
  }
  return { rate: pct(safeRatio(converted, eligible)), eligible, converted };
}

/**
 * Rebooking:
 *   atendimentos concluídos com próxima visita marcada / atendimentos concluídos elegíveis
 *
 * "Próxima visita marcada" = existe um futuro appointment não cancelado para o mesmo
 * cliente até windowDays após o concluído.
 */
export function rebookingRate(
  appts: ApptFact[],
  windowDays: number,
): { rate: number; rebooked: number; eligible: number } {
  const byClient = new Map<string, ApptFact[]>();
  for (const a of appts) {
    const arr = byClient.get(a.clientId) ?? [];
    arr.push(a);
    byClient.set(a.clientId, arr);
  }
  let eligible = 0;
  let rebooked = 0;
  for (const [, arr] of byClient) {
    arr.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    for (let i = 0; i < arr.length; i++) {
      const cur = arr[i];
      if (cur.status !== "completed") continue;
      eligible += 1;
      const limit = new Date(new Date(cur.startsAt).getTime() + windowDays * 86_400_000);
      const hasNext = arr.some(
        (other, j) =>
          j !== i &&
          new Date(other.startsAt) > new Date(cur.startsAt) &&
          new Date(other.startsAt) <= limit &&
          other.status !== "canceled" &&
          other.status !== "no_show",
      );
      if (hasNext) rebooked += 1;
    }
  }
  return { rate: pct(safeRatio(rebooked, eligible)), rebooked, eligible };
}

/** Recuperação de no-show: clientes com no-show que remarcaram dentro da janela. */
export function noShowRecoveryRate(
  appts: ApptFact[],
  windowDays: number,
): { rate: number; eligible: number; recovered: number } {
  const noShowsByClient = new Map<string, Date[]>();
  for (const a of appts) {
    if (a.status === "no_show") {
      const arr = noShowsByClient.get(a.clientId) ?? [];
      arr.push(new Date(a.startsAt));
      noShowsByClient.set(a.clientId, arr);
    }
  }
  const apptsByClient = new Map<string, ApptFact[]>();
  for (const a of appts) {
    const arr = apptsByClient.get(a.clientId) ?? [];
    arr.push(a);
    apptsByClient.set(a.clientId, arr);
  }
  let eligible = 0;
  let recovered = 0;
  for (const [clientId, dates] of noShowsByClient) {
    eligible += 1;
    const limit = new Date(Math.max(...dates.map((d) => d.getTime())) + windowDays * 86_400_000);
    const future = apptsByClient.get(clientId) ?? [];
    if (
      future.some(
        (a) =>
          a.status !== "canceled" &&
          a.status !== "no_show" &&
          new Date(a.startsAt) > new Date(Math.max(...dates.map((d) => d.getTime()))) &&
          new Date(a.startsAt) <= limit,
      )
    ) {
      recovered += 1;
    }
  }
  return { rate: pct(safeRatio(recovered, eligible)), eligible, recovered };
}

/** Tempo médio até confirmação (em horas), para os confirmados. */
export function avgHoursToConfirm(rows: ApptFact[]): number {
  const confirmed = rows.filter((r) => r.confirmedAt && r.createdAt);
  if (confirmed.length === 0) return 0;
  const sum = confirmed.reduce((acc, r) => {
    const created = new Date(r.createdAt).getTime();
    const conf = new Date(r.confirmedAt!).getTime();
    return acc + Math.max(0, (conf - created) / 36e5);
  }, 0);
  return Math.round((sum / confirmed.length) * 10) / 10;
}

/** Novos vs recorrentes entre clientes com visita atendida no período. */
export function newVsReturning(
  appts: ApptFact[],
  clients: ClientFact[],
  range: { start: Date; end: Date },
): { news: number; returning: number; total: number } {
  const inRange = appts.filter(
    (a) =>
      ATTENDED_STATUSES.has(a.status) &&
      new Date(a.startsAt) >= range.start &&
      new Date(a.startsAt) <= range.end,
  );
  const seen = new Set<string>();
  let news = 0;
  let returning = 0;
  for (const a of inRange) {
    if (seen.has(a.clientId)) continue;
    seen.add(a.clientId);
    const c = clients.find((x) => x.id === a.clientId);
    const firstAt = c?.firstVisitAt ? new Date(c.firstVisitAt) : null;
    if (firstAt && firstAt >= range.start) news += 1;
    else returning += 1;
  }
  return { news, returning, total: news + returning };
}

/** Distribuição por origem (source). */
export function sourceBreakdown(appts: ApptFact[]): Array<{ source: AppointmentSource; count: number; pct: number }> {
  const total = appts.length || 1;
  const map = new Map<AppointmentSource, number>();
  for (const a of appts) map.set(a.source, (map.get(a.source) ?? 0) + 1);
  const result = Array.from(map.entries())
    .map(([source, count]) => ({ source, count, pct: pct(count / total) }))
    .sort((a, b) => b.count - a.count);

  // A soma de percentuais arredondados independentemente pode resultar em
  // 99,9% ou 100,1%. Absorve o resíduo de uma casa decimal na maior categoria.
  const drift = Math.round((100 - result.reduce((sum, row) => sum + row.pct, 0)) * 10) / 10;
  if (result.length > 0 && drift !== 0) {
    result[0].pct = Math.round((result[0].pct + drift) * 10) / 10;
  }
  return result;
}

/** Lealdade ao profissional: clientes que retornaram ao mesmo profissional / clientes recorrentes. */
export function professionalLoyalty(appts: ApptFact[]): { rate: number; loyal: number; recurring: number } {
  const proByClient = new Map<string, Map<string, number>>();
  for (const a of appts) {
    if (a.status !== "completed") continue;
    const m = proByClient.get(a.clientId) ?? new Map();
    m.set(a.professionalId, (m.get(a.professionalId) ?? 0) + 1);
    proByClient.set(a.clientId, m);
  }
  let recurring = 0;
  let loyal = 0;
  for (const [, pros] of proByClient) {
    const total = Array.from(pros.values()).reduce((a, b) => a + b, 0);
    if (total < 2) continue;
    recurring += 1;
    const max = Math.max(...pros.values());
    if (max / total >= 0.7) loyal += 1;
  }
  return { rate: pct(safeRatio(loyal, recurring)), loyal, recurring };
}

/** Lealdade à marca: clientes recorrentes / clientes do período. */
export function brandLoyalty(appts: ApptFact[]): { rate: number; recurring: number; total: number } {
  const visitCount = new Map<string, number>();
  for (const a of appts) {
    if (a.status !== "completed") continue;
    visitCount.set(a.clientId, (visitCount.get(a.clientId) ?? 0) + 1);
  }
  const total = visitCount.size;
  const recurring = Array.from(visitCount.values()).filter((n) => n >= 2).length;
  return { rate: pct(safeRatio(recurring, total)), recurring, total };
}

/** Completude do CRM (média 0..1) sobre clientes com pelo menos 1 visita no período. */
export function crmCompleteness(clients: ClientFact[]): number {
  if (clients.length === 0) return 0;
  const fields: Array<keyof ClientFact> = [
    "fullName",
    "email",
    "phone",
    "whatsappPhone",
    "birthDate",
    "preferences",
    "preferredProfessionalId",
    "preferredUnitId",
  ];
  const sum = clients.reduce((acc, c) => {
    const filled = fields.filter((f) => Boolean(c[f])).length;
    return acc + filled / fields.length;
  }, 0);
  return pct(sum / clients.length);
}

/** Adesão à janela ideal de retorno: retornos dentro da faixa ideal / retornos elegíveis. */
export function idealWindowAdherence(
  appts: ApptFact[],
  idealRangeDays: { min: number; max: number },
): { rate: number; eligible: number; in_window: number } {
  const visitsByClient = new Map<string, Date[]>();
  for (const a of appts) {
    if (a.status !== "completed") continue;
    const arr = visitsByClient.get(a.clientId) ?? [];
    arr.push(new Date(a.startsAt));
    visitsByClient.set(a.clientId, arr);
  }
  let eligible = 0;
  let inWindow = 0;
  for (const [, arr] of visitsByClient) {
    arr.sort((a, b) => a.getTime() - b.getTime());
    for (let i = 1; i < arr.length; i++) {
      const days = (arr[i].getTime() - arr[i - 1].getTime()) / 86_400_000;
      eligible += 1;
      if (days >= idealRangeDays.min && days <= idealRangeDays.max) inWindow += 1;
    }
  }
  return { rate: pct(safeRatio(inWindow, eligible)), eligible, in_window: inWindow };
}

/** Conversão da lista de espera. */
export function waitlistConversionRate(input: {
  scheduled: number;
  worked: number;
}): number {
  return pct(safeRatio(input.scheduled, input.worked));
}

/** Reativação: inativos que voltaram. */
export function reactivationRate(input: {
  reactivated: number;
  inactives: number;
}): number {
  return pct(safeRatio(input.reactivated, input.inactives));
}

/** Conclusão de pacotes/protocolos. */
export function packageCompletionRate(packages: Array<{ used: number; total: number }>): number {
  if (packages.length === 0) return 0;
  const completed = packages.filter((p) => p.total > 0 && p.used >= p.total).length;
  return pct(completed / packages.length);
}

// ----------------------------------------------------------------------------
// ÍNDICE CATIVA (0..100)
// ----------------------------------------------------------------------------

export interface CativaIndexInputs {
  retentionPct: number;
  rebookingPct: number;
  confirmationPct: number;
  noShowRecoveryPct: number;
  occupancyPct: number;
  idealWindowPct: number;
  crmCompletenessPct: number;
  futureBookedValueCents: number;
  /** referência de “teto saudável” para futuro agendado, em cents (default 30 dias × ticket × volume) */
  futureBookedReferenceCents: number;
}

export interface CativaIndexBreakdown {
  score: number;
  components: Array<{
    key: keyof CativaIndexInputs;
    label: string;
    valuePct: number; // 0..100 normalizado
    weight: number;
    contribution: number; // weight * valuePct / 100
    isBottleneck: boolean;
    isStrength: boolean;
  }>;
}

export const CATIVA_WEIGHTS = {
  retentionPct: 25,
  rebookingPct: 15,
  confirmationPct: 10,
  noShowRecoveryPct: 10,
  occupancyPct: 10,
  idealWindowPct: 10,
  crmCompletenessPct: 10,
  futureBookedValueCents: 10,
} as const;

const COMPONENT_LABELS: Record<keyof CativaIndexInputs, string> = {
  retentionPct: "Retenção",
  rebookingPct: "Rebooking",
  confirmationPct: "Confirmação",
  noShowRecoveryPct: "Recuperação de no-show",
  occupancyPct: "Ocupação",
  idealWindowPct: "Janela ideal",
  crmCompletenessPct: "Completude do CRM",
  futureBookedValueCents: "Valor futuro agendado",
  futureBookedReferenceCents: "—",
};

/** Calcula o Índice Cativa com pesos definidos. Retorna score 0..100 e breakdown. */
export function cativaIndex(inputs: CativaIndexInputs): CativaIndexBreakdown {
  // Normaliza “valor futuro” como ratio sobre referência (cap em 100%).
  const futurePct = clamp(
    safeRatio(inputs.futureBookedValueCents, inputs.futureBookedReferenceCents) * 100,
    0,
    100,
  );

  const normalized: Array<{ key: keyof CativaIndexInputs; valuePct: number; weight: number }> = [
    { key: "retentionPct", valuePct: clamp(inputs.retentionPct, 0, 100), weight: CATIVA_WEIGHTS.retentionPct },
    { key: "rebookingPct", valuePct: clamp(inputs.rebookingPct, 0, 100), weight: CATIVA_WEIGHTS.rebookingPct },
    { key: "confirmationPct", valuePct: clamp(inputs.confirmationPct, 0, 100), weight: CATIVA_WEIGHTS.confirmationPct },
    { key: "noShowRecoveryPct", valuePct: clamp(inputs.noShowRecoveryPct, 0, 100), weight: CATIVA_WEIGHTS.noShowRecoveryPct },
    { key: "occupancyPct", valuePct: clamp(inputs.occupancyPct, 0, 100), weight: CATIVA_WEIGHTS.occupancyPct },
    { key: "idealWindowPct", valuePct: clamp(inputs.idealWindowPct, 0, 100), weight: CATIVA_WEIGHTS.idealWindowPct },
    { key: "crmCompletenessPct", valuePct: clamp(inputs.crmCompletenessPct, 0, 100), weight: CATIVA_WEIGHTS.crmCompletenessPct },
    { key: "futureBookedValueCents", valuePct: futurePct, weight: CATIVA_WEIGHTS.futureBookedValueCents },
  ];

  const total = normalized.reduce((acc, c) => acc + (c.valuePct * c.weight) / 100, 0);
  const score = clamp(Math.round(total), 0, 100);

  // Considera “gargalo” o componente cujo valor está abaixo de 50% E tem peso ≥ 10.
  // “Força” = ≥ 80%.
  const components = normalized.map((c) => ({
    key: c.key,
    label: COMPONENT_LABELS[c.key],
    valuePct: Math.round(c.valuePct * 10) / 10,
    weight: c.weight,
    contribution: Math.round((c.valuePct * c.weight) / 100),
    isBottleneck: c.valuePct < 50 && c.weight >= 10,
    isStrength: c.valuePct >= 80,
  }));

  // Arredondamento por componente não pode fazer o breakdown divergir do
  // score exibido. Corrigimos a diferença de no máximo alguns pontos no
  // componente de maior peso, preservando a explicabilidade do índice.
  let contributionDelta = score - components.reduce((sum, component) => sum + component.contribution, 0);
  if (contributionDelta !== 0) {
    // A single component may already be at 0 or at its weight. Distribuímos a
    // diferença inteira entre componentes por peso, em vez de deixar o
    // breakdown inconsistente em casos extremos (por exemplo, NaN/100%).
    const order = components
      .map((component, index) => ({ index, weight: component.weight }))
      .sort((a, b) => b.weight - a.weight);
    for (const { index } of order) {
      if (contributionDelta === 0) break;
      const component = components[index];
      const capacity = contributionDelta > 0
        ? component.weight - component.contribution
        : component.contribution;
      const adjustment = Math.sign(contributionDelta) * Math.min(Math.abs(contributionDelta), capacity);
      component.contribution += adjustment;
      contributionDelta -= adjustment;
    }
  }

  // Esta é uma invariante do contrato do índice. Se novos pesos/componentes
  // forem adicionados, falhar cedo evita publicar um score que não explica o
  // próprio breakdown.
  if (contributionDelta !== 0) {
    throw new Error("Índice Cativa não conseguiu reconciliar o breakdown");
  }

  return { score, components };
}

export function indexLabel(score: number): { label: string; tone: "danger" | "warning" | "info" | "success" } {
  if (score < 40) return { label: "Crítico", tone: "danger" };
  if (score < 60) return { label: "Atenção", tone: "warning" };
  if (score < 80) return { label: "Bom", tone: "info" };
  return { label: "Excelente", tone: "success" };
}

// ----------------------------------------------------------------------------
// NEXT BEST ACTION
// ----------------------------------------------------------------------------

export interface NextBestAction {
  id: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  ctaLabel: string;
  ctaTo: string;
}

export interface NbaInputs {
  confirmationPct: number;
  conv1to2Pct: number;
  occupancyPct: number;
  idealWindowPct: number;
  pendingPackages: number;
  highValueUnconfirmed: number;
  reactivableClients: number;
}

export function nextBestActions(i: NbaInputs): NextBestAction[] {
  const actions: NextBestAction[] = [];
  if (i.confirmationPct < 70) {
    actions.push({
      id: "low_confirmation",
      title: "Baixa taxa de confirmação",
      description:
        "Sua taxa de confirmação está abaixo do ideal. Acione a Central de Confirmação para mover horários pendentes para a fila de contato.",
      impact: "high",
      ctaLabel: "Abrir Central de Confirmação",
      ctaTo: "/app/confirmacoes",
    });
  }
  if (i.conv1to2Pct < 50) {
    actions.push({
      id: "low_first_to_second",
      title: "Conversão 1ª → 2ª visita baixa",
      description:
        "Foque em rebookar clientes de primeira visita ainda no atendimento. Crie um lembrete pós-atendimento.",
      impact: "high",
      ctaLabel: "Ver clientes recentes",
      ctaTo: "/app/clientes",
    });
  }
  if (i.occupancyPct < 60) {
    actions.push({
      id: "low_occupancy",
      title: "Agenda com buracos",
      description:
        "Sua ocupação está abaixo de 60%. Acione a lista de espera para preencher horários vazios.",
      impact: "medium",
      ctaLabel: "Abrir lista de espera",
      ctaTo: "/app/lista-de-espera",
    });
  }
  if (i.idealWindowPct < 50) {
    actions.push({
      id: "out_of_window",
      title: "Clientes fora da janela ideal",
      description:
        "Muitos clientes estão retornando fora do período recomendado. Mova-os para campanha de reativação.",
      impact: "medium",
      ctaLabel: "Ver clientes",
      ctaTo: "/app/clientes",
    });
  }
  if (i.pendingPackages > 0) {
    actions.push({
      id: "pending_packages",
      title: `${i.pendingPackages} protocolo(s) parado(s)`,
      description:
        "Existem pacotes/protocolos com sessões pendentes sem próximo agendamento. Alerte a recepção.",
      impact: "medium",
      ctaLabel: "Ver pacotes",
      ctaTo: "/app/pacotes",
    });
  }
  if (i.highValueUnconfirmed > 0) {
    actions.push({
      id: "high_value",
      title: `${i.highValueUnconfirmed} agendamento(s) de alto valor sem confirmação`,
      description:
        "Priorize contato humano para esses agendamentos. Eles têm maior impacto no faturamento futuro.",
      impact: "high",
      ctaLabel: "Priorizar contatos",
      ctaTo: "/app/confirmacoes",
    });
  }
  if (i.reactivableClients > 0) {
    actions.push({
      id: "reactivate",
      title: `${i.reactivableClients} cliente(s) inativo(s) reativáveis`,
      description:
        "Clientes que não voltaram dentro da janela ideal. Mova-os para a campanha de reativação.",
      impact: "low",
      ctaLabel: "Ver lista",
      ctaTo: "/app/clientes",
    });
  }
  return actions.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.impact] - order[b.impact];
  });
}

/**
 * Rentabilidade por hora (em reais, com precisão de centavos).
 * Calcula quanto cada profissional ou serviço gera por hora trabalhada.
 */
export function hourlyProfitability(
  rows: ApptFact[],
  keyOf: (r: ApptFact) => string,
  labelOf: (k: string) => string,
): Array<{ label: string; hourlyRate: number }> {
  const map = new Map<string, { totalRevenue: number; totalMinutes: number }>();
  
  for (const r of rows) {
    if (r.status !== "completed") continue;
    const k = keyOf(r);
    const cur = map.get(k) ?? { totalRevenue: 0, totalMinutes: 0 };
    cur.totalRevenue += r.totalPriceCents;
    cur.totalMinutes += r.durationMinutes;
    map.set(k, cur);
  }

  return Array.from(map.entries())
    .map(([k, v]) => ({
      label: labelOf(k),
      hourlyRate: reaisFromCents(safeRatio(v.totalRevenue, v.totalMinutes) * 60),
    }))
    .sort((a, b) => b.hourlyRate - a.hourlyRate);
}

/**
 * LTV Estimado (Life Time Value)
 * Ticket Médio × Frequência Média (Visitas/Mês) × 12 meses
 */
export function estimatedLtv(rows: ApptFact[], clients: ClientFact[]): number {
  const tkt = averageTicket(rows);
  const totalCompleted = rows.filter(r => r.status === "completed").length;
  const uniqueClients = new Set(rows.filter(r => r.status === "completed").map(r => r.clientId)).size;
  
  if (uniqueClients === 0) return 0;
  
  const frequency = totalCompleted / uniqueClients;
  return Math.round(tkt * frequency * 12 * 100) / 100;
}
