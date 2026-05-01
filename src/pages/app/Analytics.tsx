import { useState, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CalendarClock,
  CircleDollarSign,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  ListChecks,
  RefreshCcw,
  ShieldAlert,
  TrendingUp,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AnalyticsFiltersBar } from "@/features/analytics/AnalyticsFiltersBar";
import { CativaIndexCard } from "@/features/analytics/CativaIndexCard";
import { KpiCard } from "@/features/analytics/KpiCard";
import { NextBestActions } from "@/features/analytics/NextBestActions";
import { useAnalytics } from "@/features/analytics/useAnalytics";
import { cn } from "@/lib/utils";
import { jsonToCsv, downloadFile, formatCurrencyForExport, formatDateForExport } from "@/lib/export-utils";


const SOURCE_LABELS: Record<string, string> = {
  frontdesk: "Recepção",
  professional: "Profissional",
  client_portal: "Portal do cliente",
  walk_in: "Walk-in",
  phone: "Telefone",
  whatsapp: "WhatsApp",
  recurring: "Recorrente",
  system: "Sistema",
};

export default function AnalyticsPage() {
  const [contextView, setContextView] = useState<"executive" | "operational" | "retention">("executive");
  const analytics = useAnalytics();
  const { metrics, labels, cativa, nba, filters, range } = analytics;

  const scopeParts = [
    filters.unitId ? labels?.units.get(filters.unitId) : "Todas as unidades",
    filters.professionalId ? labels?.pros.get(filters.professionalId) : null,
    filters.serviceId ? labels?.services.get(filters.serviceId) : null,
    filters.source ? SOURCE_LABELS[filters.source] ?? filters.source : null,
  ].filter(Boolean);

  const scopeLabel = scopeParts.join(" · ");
  const rangeLabel = `${range.start.toLocaleDateString("pt-BR")} até ${range.end.toLocaleDateString("pt-BR")}`;

  if (analytics.loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Analytics"
          description="Dashboards operacionais e executivos para retenção, agenda e faturamento futuro."
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.9fr]">
          <Skeleton className="h-[420px] rounded-2xl" />
          <Skeleton className="h-[420px] rounded-2xl" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const exportToCsv = () => {
    // Mapeia client_id para full_name para exportação
    const clientMap = new Map(analytics.clients.map((c) => [c.id, c.fullName]));

    const data = analytics.appts.map((a) => ({
      Data: formatDateForExport(a.startsAt),
      Cliente: clientMap.get(a.clientId) ?? "—",
      Serviço: labels?.services.get(a.serviceId ?? "") ?? "—",
      Profissional: labels?.pros.get(a.professionalId) ?? "—",
      Unidade: labels?.units.get(a.unitId) ?? "—",
      Status: a.status,
      Valor: formatCurrencyForExport(a.totalPriceCents),
    }));

    const csv = jsonToCsv(data);
    const fileName = `relatorio-cativa-${new Date().toISOString().split("T")[0]}.csv`;
    downloadFile(csv, fileName, "text/csv;charset=utf-8;");
  };

  const exportSummaryToCsv = () => {
    const summary = [
      { Métrica: "Taxa de confirmação", Valor: `${(metrics.confirmation.rate).toFixed(1)}%` },
      { Métrica: "Ocupação", Valor: `${(metrics.occupancy.rate).toFixed(1)}%` },
      { Métrica: "Ticket Médio", Valor: formatCurrency(metrics.ticketAvg) },
      { Métrica: "LTV Anual", Valor: formatCurrency(metrics.ltv) },
      { Métrica: "Receita Futura", Valor: formatCurrency(metrics.futureValue) },
      { Métrica: "Índice Cativa", Valor: cativa.score },
    ];

    const csv = jsonToCsv(summary);
    const fileName = `resumo-gerencial-${new Date().toISOString().split("T")[0]}.csv`;
    downloadFile(csv, fileName, "text/csv;charset=utf-8;");
  };


  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Retenção, conversão, confirmação, ocupação e próximos movimentos recomendados."
        icon={<BarChart3 className="h-5 w-5" />}
        actions={
          <>
            <StatusBadge tone="info">{rangeLabel}</StatusBadge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="mr-1.5 h-4 w-4" /> Exportar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Relatórios de Fechamento</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportToCsv}>
                  <FileSpreadsheet className="mr-2 h-4 w-4 text-success" />
                  Listagem completa (CSV/Excel)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportSummaryToCsv}>
                  <FileText className="mr-2 h-4 w-4 text-info" />
                  Resumo executivo (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <FileText className="mr-2 h-4 w-4 text-destructive" />
                  Relatório em PDF (Breve)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCcw className="mr-1.5 h-4 w-4" /> Atualizar
            </Button>
          </>
        }
      />


      <AnalyticsFiltersBar
        preset={analytics.preset}
        onPreset={analytics.setPreset}
        units={labels?.units ?? null}
        pros={labels?.pros ?? null}
        services={labels?.services ?? null}
        unitId={filters.unitId}
        professionalId={filters.professionalId}
        serviceId={filters.serviceId}
        source={filters.source}
        onUnit={analytics.setUnitId}
        onPro={analytics.setProfessionalId}
        onService={analytics.setServiceId}
        onSource={analytics.setSource}
      />

      <Tabs value={contextView} onValueChange={(value) => setContextView(value as "executive" | "operational" | "retention")}>
        <TabsList className="h-10 w-full justify-start overflow-x-auto">
          <TabsTrigger value="executive">Executivo</TabsTrigger>
          <TabsTrigger value="operational">Operacional</TabsTrigger>
          <TabsTrigger value="retention">Retenção</TabsTrigger>
        </TabsList>
        <p className="mt-3 text-sm text-muted-foreground">
          {contextView === "executive"
            ? "Leitura consolidada de receita futura, ticket, ocupação e ranking da operação."
            : contextView === "operational"
            ? "Acompanhamento diário de confirmação, comparecimento, no-show e origem da agenda."
            : "Saúde da base, conversão de visitas, recorrência, reativação e fidelização."}
        </p>

        <div className="mt-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Taxa de confirmação"
              value={formatPct(metrics.confirmation.rate)}
              hint={`${metrics.confirmation.confirmed} confirmados de ${metrics.confirmation.eligible}`}
              icon={ListChecks}
              tone={metrics.confirmation.rate >= 75 ? "success" : "warning"}
            />
            <KpiCard
              label="Ocupação"
              value={formatPct(metrics.occupancy.rate)}
              hint={`${metrics.bookedMinutes} min reservados de ${metrics.availableMinutes} min disponíveis`}
              icon={Gauge}
              tone={metrics.occupancy.rate >= 70 ? "success" : "warning"}
            />
            <KpiCard
              label="Ticket médio"
              value={formatCurrency(metrics.ticketAvg)}
              hint={`${analytics.appts.filter((appt) => appt.status === "completed").length} atendimentos concluídos`}
              icon={CircleDollarSign}
              tone="brand"
            />
            <KpiCard
              label="LTV (Anual)"
              value={formatCurrency(metrics.ltv)}
              hint="Potencial médio por cliente"
              icon={TrendingUp}
              tone="info"
            />

          </div>

          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
            <CativaIndexCard breakdown={cativa} scope={scopeLabel} />
            <NextBestActions actions={nba} />
          </div>

          <TabsContent value="executive" className="mt-0 space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                title="Receita e agenda futura"
                description="Leitura executiva do pipeline de faturamento já agendado."
              >
                <MetricRow
                  label="Valor futuro agendado"
                  value={formatCurrency(metrics.futureValue)}
                  helper="Soma dos horários futuros não cancelados"
                />
                <MetricRow
                  label="Receita futura em risco"
                  value={formatCurrency(metrics.futureRisk.value)}
                  helper={`${metrics.futureRisk.count} horário(s) sem confirmação`}
                  tone={metrics.futureRisk.count > 0 ? "danger" : "success"}
                />
                <MetricRow
                  label="Alto valor sem confirmação"
                  value={String(metrics.highValueUnconfirmed)}
                  helper="Prioridade operacional da Central de Confirmação"
                  tone={metrics.highValueUnconfirmed > 0 ? "warning" : "success"}
                />
                <MetricRow
                  label="Conversão da lista de espera"
                  value={formatPct(metrics.waitlistConv)}
                  helper={`${metrics.waitlist.scheduled} agendados de ${metrics.waitlist.worked} trabalhados`}
                />
              </SectionCard>

              <SectionCard
                title="Resumo da base"
                description="Novos clientes, qualidade do CRM e reativação."
              >
                <MetricRow
                  label="Novos clientes"
                  value={String(metrics.newReturning.news)}
                  helper={`${metrics.newReturning.total} clientes atendidos no período`}
                />
                <MetricRow
                  label="Clientes recorrentes"
                  value={String(metrics.newReturning.returning)}
                  helper="Já tinham histórico anterior"
                />
                <MetricRow
                  label="Completude do CRM"
                  value={formatPct(metrics.crm)}
                  helper="Campos-chave preenchidos"
                />
                <MetricRow
                  label="Reativação"
                  value={formatPct(metrics.reactivation)}
                  helper={`${metrics.inactivePool} cliente(s) no pool reativável`}
                />
              </SectionCard>
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <RankedCard
                title="Ticket por serviço"
                description="Serviços com maior receita no período."
                items={metrics.ticketByService.slice(0, 6).map((item) => ({
                  key: item.key,
                  label: item.label,
                  value: formatCurrency(item.revenue),
                  helper: `${item.visits} visita(s) · ticket ${formatCurrency(item.ticket)}`,
                }))}
              />
              <RankedCard
                title="Ticket por profissional"
                description="Quem mais puxou receita concluída."
                items={metrics.ticketByPro.slice(0, 6).map((item) => ({
                  key: item.key,
                  label: item.label,
                  value: formatCurrency(item.revenue),
                  helper: `${item.visits} visita(s) · ticket ${formatCurrency(item.ticket)}`,
                }))}
              />
              <RankedCard
                title="Ticket por unidade"
                description="Desempenho consolidado por operação."
                items={metrics.ticketByUnit.slice(0, 6).map((item) => ({
                  key: item.key,
                  label: item.label,
                  value: formatCurrency(item.revenue),
                  helper: `${item.visits} visita(s) · ticket ${formatCurrency(item.ticket)}`,
                }))}
              />
            </div>
            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                title="Rentabilidade por Profissional"
                description="Receita gerada por hora trabalhada (concluídos)."
              >
                {metrics.profitabilityByPro.length === 0 ? (
                  <EmptyMiniState text="Sem dados de atendimentos concluídos." />
                ) : (
                  <div className="space-y-3">
                    {metrics.profitabilityByPro.slice(0, 5).map((item) => (
                      <MetricRow
                        key={item.label}
                        label={item.label}
                        value={`${formatCurrency(item.hourlyRate)}/h`}
                        helper="Média de faturamento por hora"
                      />
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Potencial de Valor (LTV)"
                description="Estimativa de valor do cliente em 12 meses baseado no comportamento atual."
              >
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-sm text-muted-foreground italic mb-2">LTV Estimado (Médio)</p>
                  <p className="text-4xl font-display font-bold text-primary">
                    {formatCurrency(metrics.ltv)}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground max-w-xs">
                    Cálculo: Ticket Médio × Frequência de Visitas × 12 meses. Ajuda a definir quanto você pode investir para adquirir um novo cliente.
                  </p>
                </div>
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="operational" className="mt-0 space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Comparecimento"
                value={formatPct(metrics.attendance.rate)}
                hint={`${metrics.attendance.attended} compareceram`}
                icon={Activity}
                tone={metrics.attendance.rate >= 80 ? "success" : "warning"}
              />
              <KpiCard
                label="No-show"
                value={formatPct(metrics.noShow.rate)}
                hint={`${metrics.noShow.noShows} falta(s) no período`}
                icon={CalendarClock}
                tone={metrics.noShow.rate <= 8 ? "success" : "danger"}
              />
              <KpiCard
                label="Cancelamentos"
                value={formatPct(metrics.cancellation.rate)}
                hint={`${metrics.cancellation.canceled} cancelamento(s)`}
                icon={Clock3}
                tone={metrics.cancellation.rate <= 12 ? "success" : "warning"}
              />
              <KpiCard
                label="Tempo médio até confirmar"
                value={`${metrics.avgConfirmHours.toFixed(1)}h`}
                hint="Da criação até a confirmação"
                icon={Clock3}
                tone="info"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <SectionCard
                title="Confirmação e risco"
                description="Ritmo operacional da agenda e impacto imediato na receita."
              >
                <MetricRow
                  label="Taxa de confirmação"
                  value={formatPct(metrics.confirmation.rate)}
                  helper={`${metrics.confirmation.confirmed}/${metrics.confirmation.eligible} elegíveis`}
                />
                <MetricRow
                  label="Receita futura em risco"
                  value={formatCurrency(metrics.futureRisk.value)}
                  helper={`${metrics.futureRisk.count} agendamento(s) sem confirmação`}
                  tone={metrics.futureRisk.count > 0 ? "danger" : "success"}
                />
                <MetricRow
                  label="Alto valor sem confirmação"
                  value={String(metrics.highValueUnconfirmed)}
                  helper="Fila prioritária para contato humano"
                  tone={metrics.highValueUnconfirmed > 0 ? "warning" : "success"}
                />
              </SectionCard>

              <SectionCard
                title="Origem da agenda"
                description="Distribuição dos agendamentos por canal de entrada."
              >
                {metrics.sources.length === 0 ? (
                  <EmptyMiniState text="Sem dados suficientes neste período." />
                ) : (
                  <div className="space-y-3">
                    {metrics.sources.map((item) => (
                      <ProgressMetric
                        key={item.source}
                        label={SOURCE_LABELS[item.source] ?? item.source}
                        value={item.pct}
                        helper={`${item.count} agendamento(s)`}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </TabsContent>

          <TabsContent value="retention" className="mt-0 space-y-6">
            <div className="grid gap-6 xl:grid-cols-3">
              <SectionCard
                title="Coortes de retorno"
                description="Leitura das etapas críticas da jornada entre visitas."
              >
                <ProgressMetric
                  label="Retenção"
                  value={metrics.retention.rate}
                  helper={`${metrics.retention.retained}/${metrics.retention.eligible} clientes elegíveis`}
                />
                <ProgressMetric
                  label="1ª → 2ª visita"
                  value={metrics.conv1to2.rate}
                  helper={`${metrics.conv1to2.converted}/${metrics.conv1to2.eligible} clientes`}
                />
                <ProgressMetric
                  label="2ª → 3ª visita"
                  value={metrics.conv2to3.rate}
                  helper={`${metrics.conv2to3.converted}/${metrics.conv2to3.eligible} clientes`}
                />
              </SectionCard>

              <SectionCard
                title="Recorrência e janela ideal"
                description="Aderência à cadência recomendada e recuperação de falhas."
              >
                <ProgressMetric
                  label="Rebooking"
                  value={metrics.rebook.rate}
                  helper={`${metrics.rebook.rebooked}/${metrics.rebook.eligible} concluídos`}
                />
                <ProgressMetric
                  label="Janela ideal de retorno"
                  value={metrics.ideal.rate}
                  helper={`${metrics.ideal.in_window}/${metrics.ideal.eligible} retornos`}
                />
                <ProgressMetric
                  label="Recuperação de no-show"
                  value={metrics.noShowRecovery.rate}
                  helper={`${metrics.noShowRecovery.recovered}/${metrics.noShowRecovery.eligible} recuperados`}
                />
              </SectionCard>

              <SectionCard
                title="Lealdade e pacotes"
                description="Vínculo com marca, profissional e execução de protocolos."
              >
                <ProgressMetric
                  label="Lealdade ao profissional"
                  value={metrics.proLoyalty.rate}
                  helper={`${metrics.proLoyalty.loyal}/${metrics.proLoyalty.recurring} clientes recorrentes`}
                />
                <ProgressMetric
                  label="Lealdade à marca"
                  value={metrics.brand.rate}
                  helper={`${metrics.brand.recurring}/${metrics.brand.total} clientes com 2+ visitas`}
                />
                <ProgressMetric
                  label="Conclusão de pacotes"
                  value={metrics.packageCompletion}
                  helper={`${metrics.pendingPackages} pacote(s)/protocolo(s) ainda em aberto`}
                />
              </SectionCard>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function MetricRow({
  label,
  value,
  helper,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "bg-muted/70 text-foreground",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning-foreground",
    danger: "bg-destructive/10 text-destructive",
  }[tone];

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border/60 p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{helper}</p>
      </div>
      <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", toneClass)}>{value}</span>
    </div>
  );
}

function ProgressMetric({
  label,
  value,
  helper,
}: {
  label: string;
  value: number;
  helper: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{formatPct(value)}</span>
      </div>
      <Progress value={Math.max(0, Math.min(value, 100))} className="h-2" />
      <p className="text-xs text-muted-foreground">{helper}</p>
    </div>
  );
}

function RankedCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ key: string; label: string; value: string; helper: string }>;
}) {
  return (
    <SectionCard title={title} description={description}>
      {items.length === 0 ? (
        <EmptyMiniState text="Sem dados suficientes neste período." />
      ) : (
        <ul className="space-y-3">
          {items.map((item, index) => (
            <li key={item.key} className="flex items-start gap-3 rounded-xl border border-border/60 p-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-sm font-semibold text-primary">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-medium">{item.label}</p>
                  <span className="text-sm font-semibold">{item.value}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function EmptyMiniState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{text}</div>;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
