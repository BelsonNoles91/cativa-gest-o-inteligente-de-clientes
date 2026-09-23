/**
 * ManagerDashboard — painel completo do gestor (/app/painel-gestor).
 * Reúne os fluxos reais de clientes, agendamentos e atendimentos do período
 * escolhido, com os indicadores de retenção alimentados pelos dados do tenant
 * e o card de insights de retenção com IA.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  Gem,
  HeartHandshake,
  LineChart,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { RetentionInsightsCard } from "@/features/analytics/RetentionInsightsCard";
import { useManagerDashboard, type ManagerDashboardPeriod } from "@/hooks/use-manager-dashboard";
import type { ManagerFlowStep } from "@/hooks/use-manager-dashboard";
import { cn } from "@/lib/utils";

const PERIODS: Array<{ value: ManagerDashboardPeriod; label: string }> = [
  { value: 30, label: "30 dias" },
  { value: 90, label: "90 dias" },
  { value: 180, label: "180 dias" },
  { value: 365, label: "1 ano" },
];

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

function FlowBar({ steps, tone }: { steps: ManagerFlowStep[]; tone: "primary" | "accent" }) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <ul className="space-y-3">
      {steps.map((step) => (
        <li key={step.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-medium">{step.label}</span>
            <span className="font-display text-sm font-semibold">
              {step.value.toLocaleString("pt-BR")}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-accent")}
              style={{ width: `${Math.round((step.value / max) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{step.hint}</p>
        </li>
      ))}
    </ul>
  );
}

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<ManagerDashboardPeriod>(90);
  const { data, isLoading, isFetching, refetch } = useManagerDashboard(period);

  const kpis = useMemo(() => {
    if (!data) return [];
    return [
      {
        label: "Clientes atendidos",
        value: (data.clients.news + data.clients.returning).toLocaleString("pt-BR"),
        hint: `${data.clients.news} novos · ${data.clients.returning} recorrentes`,
        icon: Users,
        tone: "brand" as const,
      },
      {
        label: "Agendamentos",
        value: data.appointments.total.toLocaleString("pt-BR"),
        hint: `${data.appointments.occupancy}% de ocupação`,
        icon: CalendarClock,
        tone: "info" as const,
      },
      {
        label: "Atendimentos concluídos",
        value: data.services.completed.toLocaleString("pt-BR"),
        hint: `Ticket médio ${money(data.services.averageTicketCents)}`,
        icon: CalendarCheck,
        tone: "success" as const,
      },
      {
        label: "Retenção (60 dias)",
        value: `${data.retention.rate60d}%`,
        hint: `${data.retention.retained} de ${data.retention.eligible} voltaram`,
        icon: HeartHandshake,
        tone: data.retention.rate60d >= 50 ? ("success" as const) : ("warning" as const),
      },
    ];
  }, [data]);

  return (
    <>
      <PageHeader
        title="Painel do gestor"
        description="Fluxo de clientes, agendamentos, atendimentos e retenção com os dados reais do seu estabelecimento."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-2xl border bg-card p-1">
              {PERIODS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setPeriod(item.value)}
                  aria-pressed={period === item.value}
                  className={cn(
                    "min-h-[36px] rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    period === item.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="min-h-[40px] rounded-2xl"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", isFetching && "animate-spin")} /> Atualizar
            </Button>
          </div>
        }
      />

      {isLoading || !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface-card h-28 animate-pulse p-5" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="surface-card flex flex-col gap-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-soft text-primary">
                    <kpi.icon className="h-5 w-5" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                    {kpi.label}
                  </p>
                </div>
                <div>
                  <p className="font-display text-2xl font-semibold leading-none md:text-3xl">{kpi.value}</p>
                  <StatusBadge tone={kpi.tone} dot className="mt-2 w-fit px-2 py-0.5 text-[11px] font-normal">
                    {kpi.hint}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl p-5">
              <ErrorBoundary name="ManagerClientFlow">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Fluxo de clientes</h2>
                    <p className="text-xs text-muted-foreground">
                      Da base cadastrada até quem está prestes a se perder.
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate("/app/clientes")}>
                    Clientes <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
                <FlowBar steps={data.clients.flow} tone="primary" />
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Intervalo médio entre visitas</p>
                    <p className="font-display text-lg font-semibold">
                      {data.clients.avgDaysBetweenVisits || "—"} {data.clients.avgDaysBetweenVisits ? "dias" : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Nunca visitaram</p>
                    <p className="font-display text-lg font-semibold">{data.clients.neverVisited}</p>
                  </div>
                </div>
              </ErrorBoundary>
            </Card>

            <Card className="rounded-2xl p-5">
              <ErrorBoundary name="ManagerAppointmentFlow">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold">Fluxo de agendamentos</h2>
                    <p className="text-xs text-muted-foreground">Do agendamento até a conclusão do atendimento.</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate("/app/agenda")}>
                    Agenda <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </div>
                <FlowBar steps={data.appointments.flow} tone="accent" />
                <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Cancelamentos</p>
                    <p className="font-display text-lg font-semibold">{data.appointments.cancellationRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Faltas</p>
                    <p className="font-display text-lg font-semibold">{data.appointments.noShowRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Confirmados</p>
                    <p className="font-display text-lg font-semibold">{data.appointments.confirmedRate}%</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Agendado à frente</p>
                    <p className="font-display text-lg font-semibold">
                      {data.appointments.future} · {money(data.appointments.futureValueCents)}
                    </p>
                  </div>
                </div>
              </ErrorBoundary>
            </Card>
          </div>

          <Card className="rounded-2xl p-5">
            <ErrorBoundary name="ManagerServiceFlow">
              <div className="mb-4">
                <h2 className="font-display text-lg font-semibold">Atendimentos e receita</h2>
                <p className="text-xs text-muted-foreground">
                  Atendimentos concluídos por mês e a receita registrada neles.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Receita concluída</p>
                  <p className="font-display text-2xl font-semibold">{money(data.services.revenueCents)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Ticket médio</p>
                  <p className="font-display text-2xl font-semibold">{money(data.services.averageTicketCents)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Saem com retorno marcado</p>
                  <p className="font-display text-2xl font-semibold">{data.services.rebookingRate}%</p>
                </div>
              </div>

              {data.services.monthly.length > 0 ? (
                <div className="mt-5 flex items-end gap-3 overflow-x-auto pb-2">
                  {data.services.monthly.map((point) => {
                    const max = Math.max(1, ...data.services.monthly.map((p) => p.scheduled));
                    return (
                      <div key={point.month} className="flex min-w-[56px] flex-1 flex-col items-center gap-2">
                        <div className="flex h-32 w-full items-end justify-center gap-1">
                          <div
                            className="w-3 rounded-t-lg bg-primary/25"
                            style={{ height: `${Math.max(4, (point.scheduled / max) * 100)}%` }}
                            title={`${point.scheduled} agendamentos`}
                          />
                          <div
                            className="w-3 rounded-t-lg bg-primary"
                            style={{ height: `${Math.max(4, (point.completed / max) * 100)}%` }}
                            title={`${point.completed} concluídos`}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{monthLabel(point.month)}</span>
                        <span className="text-[11px] font-medium">{money(point.revenueCents)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">
                  Ainda não há atendimentos concluídos neste período.
                </p>
              )}

              {data.appointments.bySource.length > 0 && (
                <div className="mt-5 border-t pt-4">
                  <p className="mb-2 text-sm font-medium">Origem dos agendamentos</p>
                  <div className="flex flex-wrap gap-2">
                    {data.appointments.bySource.map((row) => (
                      <StatusBadge key={row.source} tone="info" className="px-2 py-1 text-xs font-normal">
                        {row.source}: {row.count} ({row.pct}%)
                      </StatusBadge>
                    ))}
                  </div>
                </div>
              )}
            </ErrorBoundary>
          </Card>

          <Card className="rounded-2xl p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Retenção com dados reais</h2>
                <p className="text-xs text-muted-foreground">
                  Calculado sobre os atendimentos concluídos nos últimos {data.periodDays} dias.
                </p>
              </div>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Voltaram em até 60 dias</p>
                <p className="font-display text-2xl font-semibold">{data.retention.rate60d}%</p>
                <p className="text-xs text-muted-foreground">
                  {data.retention.retained} de {data.retention.eligible} clientes
                </p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Share de recorrentes</p>
                <p className="font-display text-2xl font-semibold">{data.retention.returningShare}%</p>
                <p className="text-xs text-muted-foreground">Dos clientes atendidos no período</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Para reativar</p>
                <p className="font-display text-2xl font-semibold">{data.retention.reactivationCandidates}</p>
                <p className="text-xs text-muted-foreground">Em risco ou perdidos</p>
              </div>
              <div className="rounded-2xl bg-muted/40 p-4">
                <p className="text-sm text-muted-foreground">Receita em risco</p>
                <p className="font-display text-2xl font-semibold">{money(data.retention.atRiskRevenueCents)}</p>
                <p className="text-xs text-muted-foreground">Gerada por quem parou de vir</p>
              </div>
            </div>
          </Card>

          <Card className="rounded-2xl p-5">
            <ErrorBoundary name="ManagerClientValue">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">Valor do cliente</h2>
                  <p className="text-xs text-muted-foreground">
                    Quanto cada pessoa já deixou no caixa e quanto tende a deixar em 12 meses.
                  </p>
                </div>
                <Gem className="h-5 w-5 text-primary" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Valor médio por cliente</p>
                  <p className="font-display text-2xl font-semibold">
                    {money(data.clientValue.averageValueCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {data.clientValue.payingClients} clientes atendidos
                  </p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Valor típico (mediana)</p>
                  <p className="font-display text-2xl font-semibold">
                    {money(data.clientValue.medianValueCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">Metade gasta mais, metade menos</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Concentração nos maiores</p>
                  <p className="font-display text-2xl font-semibold">{data.clientValue.topSharePct}%</p>
                  <p className="text-xs text-muted-foreground">Receita vinda dos 20% que mais gastam</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Potencial em 12 meses</p>
                  <p className="font-display text-2xl font-semibold">
                    {money(data.clientValue.projectedAnnualCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">Se mantiverem a frequência atual</p>
                </div>
              </div>

              {data.clientValue.rows.length > 0 ? (
                <ul className="mt-5 divide-y">
                  {data.clientValue.rows.slice(0, 10).map((row) => (
                    <li key={row.clientId} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.visits} {row.visits === 1 ? "visita" : "visitas"} · ticket{" "}
                          {money(row.averageTicketCents)}
                          {row.averageIntervalDays
                            ? ` · volta a cada ${row.averageIntervalDays} dias`
                            : ""}
                          {row.daysSinceLastVisit !== null
                            ? ` · última há ${row.daysSinceLastVisit} dias`
                            : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display text-sm font-semibold">{money(row.revenueCents)}</p>
                        <StatusBadge tone={TIER_TONES[row.tier]} className="px-2 py-0.5 text-[11px] font-normal">
                          {TIER_LABELS[row.tier]}
                        </StatusBadge>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-sm text-muted-foreground">
                  Ainda não há atendimentos concluídos para calcular o valor dos clientes.
                </p>
              )}
            </ErrorBoundary>
          </Card>

          <Card className="rounded-2xl p-5">
            <ErrorBoundary name="ManagerForecast">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">Previsão de faturamento</h2>
                  <p className="text-xs text-muted-foreground">
                    Usa a média dos meses fechados e o que já está marcado na agenda.
                  </p>
                </div>
                <LineChart className="h-5 w-5 text-primary" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Média mensal</p>
                  <p className="font-display text-2xl font-semibold">
                    {money(data.forecast.baselineMonthlyCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">Últimos meses fechados</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Próximos 30 dias</p>
                  <p className="font-display text-2xl font-semibold">{money(data.forecast.next30Cents)}</p>
                  <p className="text-xs text-muted-foreground">Previsão</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Próximos 90 dias</p>
                  <p className="font-display text-2xl font-semibold">{money(data.forecast.next90Cents)}</p>
                  <p className="text-xs text-muted-foreground">Previsão</p>
                </div>
                <div className="rounded-2xl bg-muted/40 p-4">
                  <p className="text-sm text-muted-foreground">Já marcado à frente</p>
                  <p className="font-display text-2xl font-semibold">
                    {money(data.forecast.bookedAheadCents)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Tendência do último mês: {data.forecast.trendPct > 0 ? "+" : ""}
                    {data.forecast.trendPct}%
                  </p>
                </div>
              </div>

              {data.forecast.points.length > 0 && (
                <div className="mt-5 flex items-end gap-3 overflow-x-auto pb-2">
                  {data.forecast.points.map((point) => {
                    const max = Math.max(1, ...data.forecast.points.map((p) => p.forecastCents));
                    return (
                      <div
                        key={point.month}
                        className="flex min-w-[64px] flex-1 flex-col items-center gap-2"
                      >
                        <div className="flex h-32 w-full items-end justify-center">
                          <div
                            className={cn(
                              "w-6 rounded-t-lg",
                              point.isFuture ? "bg-primary/30 ring-1 ring-primary/40" : "bg-primary",
                            )}
                            style={{ height: `${Math.max(4, (point.forecastCents / max) * 100)}%` }}
                            title={money(point.forecastCents)}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{monthLabel(point.month)}</span>
                        <span className="text-[11px] font-medium">{money(point.forecastCents)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Barras cheias são meses já realizados; barras claras são previsão.
              </p>
            </ErrorBoundary>
          </Card>

          <RetentionInsightsCard />
        </div>
      )}
    </>
  );
}
