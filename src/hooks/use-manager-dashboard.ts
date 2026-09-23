/**
 * use-manager-dashboard — consolida o painel completo do gestor.
 *
 * Lê os fatos reais do tenant (agendamentos do período, agendamentos futuros,
 * clientes e disponibilidade) e deriva os três fluxos apresentados na tela:
 * clientes, agendamentos e atendimentos, além dos indicadores de retenção.
 */
import { useQuery } from "@tanstack/react-query";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  fetchAppointments,
  fetchAvailability,
  fetchClients,
  fetchFutureAppointments,
} from "@/repositories/analytics";
import {
  averageTicket,
  cancellationRate,
  confirmationRate,
  newVsReturning,
  noShowRate,
  occupancyRate,
  rebookingRate,
  retentionRate,
  sourceBreakdown,
  type ApptFact,
  type ClientFact,
} from "@/domain/analytics";

export type ManagerDashboardPeriod = 30 | 90 | 180 | 365;

const DAY = 86_400_000;
const AT_RISK_DAYS = 45;
const LOST_DAYS = 90;

export interface ManagerFlowStep {
  label: string;
  value: number;
  hint: string;
}

export interface MonthlyPoint {
  month: string;
  scheduled: number;
  completed: number;
  revenueCents: number;
}

export interface ManagerDashboardData {
  periodDays: ManagerDashboardPeriod;
  clients: {
    total: number;
    news: number;
    returning: number;
    active: number;
    atRisk: number;
    lost: number;
    neverVisited: number;
    avgDaysBetweenVisits: number;
    flow: ManagerFlowStep[];
  };
  appointments: {
    total: number;
    confirmedRate: number;
    cancellationRate: number;
    noShowRate: number;
    occupancy: number;
    future: number;
    futureValueCents: number;
    bySource: Array<{ source: string; count: number; pct: number }>;
    flow: ManagerFlowStep[];
  };
  services: {
    completed: number;
    revenueCents: number;
    averageTicketCents: number;
    rebookingRate: number;
    monthly: MonthlyPoint[];
  };
  retention: {
    rate60d: number;
    eligible: number;
    retained: number;
    returningShare: number;
    reactivationCandidates: number;
    atRiskRevenueCents: number;
  };
}

const sourceLabels: Record<string, string> = {
  frontdesk: "Recepção",
  professional: "Profissional",
  client_portal: "Portal do cliente",
  walk_in: "Sem hora marcada",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  recurring: "Recorrente",
  system: "Sistema",
};

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
}

function averageIntervalDays(appts: ApptFact[]): number {
  const byClient = new Map<string, number[]>();
  for (const appt of appts) {
    if (appt.status !== "completed") continue;
    const list = byClient.get(appt.clientId) ?? [];
    list.push(new Date(appt.startsAt).getTime());
    byClient.set(appt.clientId, list);
  }
  const gaps: number[] = [];
  for (const [, times] of byClient) {
    times.sort((a, b) => a - b);
    for (let i = 1; i < times.length; i += 1) gaps.push((times[i] - times[i - 1]) / DAY);
  }
  if (gaps.length === 0) return 0;
  return Math.round(gaps.reduce((acc, value) => acc + value, 0) / gaps.length);
}

function monthlySeries(appts: ApptFact[]): MonthlyPoint[] {
  const map = new Map<string, MonthlyPoint>();
  for (const appt of appts) {
    const date = new Date(appt.startsAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const point =
      map.get(key) ?? { month: key, scheduled: 0, completed: 0, revenueCents: 0 };
    point.scheduled += 1;
    if (appt.status === "completed") {
      point.completed += 1;
      point.revenueCents += appt.totalPriceCents ?? 0;
    }
    map.set(key, point);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export function buildManagerDashboard(
  periodDays: ManagerDashboardPeriod,
  appts: ApptFact[],
  future: ApptFact[],
  clients: ClientFact[],
  availableMinutes: number,
  bookedMinutes: number,
  completedMinutes: number,
): ManagerDashboardData {
  const end = new Date();
  const start = new Date(end.getTime() - periodDays * DAY);
  const range = { start, end };

  const completed = appts.filter((a) => a.status === "completed");
  const canceled = appts.filter((a) => a.status === "canceled");
  const noShows = appts.filter((a) => a.status === "no_show");
  const attended = appts.filter((a) =>
    ["arrived", "in_service", "completed"].includes(a.status),
  );

  const nv = newVsReturning(appts, clients, range);
  const retention = retentionRate(clients, appts, 60, range);

  let active = 0;
  let atRisk = 0;
  let lost = 0;
  let neverVisited = 0;
  for (const client of clients) {
    const since = daysSince(client.lastVisitAt);
    if (since === null) {
      neverVisited += 1;
      continue;
    }
    if (since <= AT_RISK_DAYS) active += 1;
    else if (since <= LOST_DAYS) atRisk += 1;
    else lost += 1;
  }

  const revenueCents = completed.reduce((acc, a) => acc + (a.totalPriceCents ?? 0), 0);
  const futureValueCents = future
    .filter((a) => a.status !== "canceled" && a.status !== "no_show")
    .reduce((acc, a) => acc + (a.totalPriceCents ?? 0), 0);

  const atRiskClientIds = new Set(
    clients
      .filter((c) => {
        const since = daysSince(c.lastVisitAt);
        return since !== null && since > AT_RISK_DAYS;
      })
      .map((c) => c.id),
  );
  const atRiskRevenueCents = completed
    .filter((a) => atRiskClientIds.has(a.clientId))
    .reduce((acc, a) => acc + (a.totalPriceCents ?? 0), 0);

  return {
    periodDays,
    clients: {
      total: clients.length,
      news: nv.news,
      returning: nv.returning,
      active,
      atRisk,
      lost,
      neverVisited,
      avgDaysBetweenVisits: averageIntervalDays(appts),
      flow: [
        { label: "Base de clientes", value: clients.length, hint: "Cadastrados no estabelecimento" },
        { label: "Atendidos no período", value: nv.total, hint: "Clientes únicos com agendamento" },
        { label: "Novos", value: nv.news, hint: "Primeira visita no período" },
        { label: "Recorrentes", value: nv.returning, hint: "Já vinham antes do período" },
        { label: "Em risco", value: atRisk, hint: `Sem visita há mais de ${AT_RISK_DAYS} dias` },
        { label: "Perdidos", value: lost, hint: `Sem visita há mais de ${LOST_DAYS} dias` },
      ],
    },
    appointments: {
      total: appts.length,
      confirmedRate: confirmationRate(appts).rate,
      cancellationRate: cancellationRate(appts).rate,
      noShowRate: noShowRate(appts).rate,
      occupancy: occupancyRate({ availableMinutes, bookedMinutes, completedMinutes }).rate,
      future: future.filter((a) => a.status !== "canceled").length,
      futureValueCents,
      bySource: sourceBreakdown(appts).map((row) => ({
        source: sourceLabels[row.source] ?? row.source,
        count: row.count,
        pct: row.pct,
      })),
      flow: [
        { label: "Agendados", value: appts.length, hint: "Marcações criadas no período" },
        {
          label: "Confirmados",
          value: appts.filter((a) => a.confirmedAt !== null).length,
          hint: "Confirmação registrada",
        },
        { label: "Compareceram", value: attended.length, hint: "Chegaram ao estabelecimento" },
        { label: "Concluídos", value: completed.length, hint: "Atendimento finalizado" },
        { label: "Cancelados", value: canceled.length, hint: "Cancelados antes do horário" },
        { label: "Faltas", value: noShows.length, hint: "Cliente não compareceu" },
      ],
    },
    services: {
      completed: completed.length,
      revenueCents,
      averageTicketCents: Math.round(averageTicket(appts)),
      rebookingRate: rebookingRate([...appts, ...future], 45).rate,
      monthly: monthlySeries(appts),
    },
    retention: {
      rate60d: retention.rate,
      eligible: retention.eligible,
      retained: retention.retained,
      returningShare: nv.total > 0 ? Math.round((nv.returning / nv.total) * 1000) / 10 : 0,
      reactivationCandidates: atRisk + lost,
      atRiskRevenueCents,
    },
  };
}

export function useManagerDashboard(periodDays: ManagerDashboardPeriod = 90) {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;

  return useQuery<ManagerDashboardData>({
    queryKey: ["manager-dashboard", tenantId, periodDays],
    enabled: Boolean(tenantId),
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!tenantId) throw new Error("Tenant não encontrado");
      const end = new Date();
      const start = new Date(end.getTime() - periodDays * DAY);

      const [appts, future, clients, availability] = await Promise.all([
        fetchAppointments({ tenantId, start: start.toISOString(), end: end.toISOString() }),
        fetchFutureAppointments(tenantId),
        fetchClients(tenantId),
        fetchAvailability({ tenantId, start: start.toISOString(), end: end.toISOString() }),
      ]);

      return buildManagerDashboard(
        periodDays,
        appts,
        future,
        clients,
        availability.availableMinutes,
        availability.bookedMinutes,
        availability.completedMinutes,
      );
    },
  });
}
