import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarHeart,
  CheckCircle2,
  Clock3,
  PhoneCall,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { useTenant } from "@/features/tenant/TenantProvider";
import { NoSubscriptionBanner } from "@/features/billing/NoSubscriptionBanner";
import { useTenantBilling } from "@/features/billing/useTenantBilling";
import { UsageBar } from "@/features/billing/UsageBar";
import { useDashboardData } from "@/hooks/use-dashboard-data";

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentTenant } = useTenant();
  const { plan, usage, limits, subscription } = useTenantBilling();
  const { data, isLoading } = useDashboardData();

  const snapshot = useMemo(() => ({
    appointmentsToday: data?.appointmentsToday ?? 0,
    occupancyToday: data?.occupancyToday ?? 0,
    pendingConfirmations: data?.pendingConfirmations ?? 0,
    newClientsWeek: data?.newClientsWeek ?? 0,
    ltvEstimate: data?.ltvEstimate ?? 0,
  }), [data]);

  const upcoming = data?.upcoming ?? [];


  const kpis = useMemo(
    () => [
      {
        label: "Atendimentos hoje",
        value: snapshot.appointmentsToday.toLocaleString("pt-BR"),
        delta: upcoming.length > 0 ? `${upcoming.length} próximos` : "Sem fila imediata",
        icon: CalendarHeart,
        tone: "brand" as const,
      },
      {
        label: "Ocupação hoje",
        value: `${snapshot.occupancyToday}%`,
        delta: snapshot.occupancyToday >= 75 ? "Boa ocupação" : "Há espaço na agenda",
        icon: TrendingUp,
        tone: snapshot.occupancyToday >= 75 ? ("success" as const) : ("warning" as const),
      },
      {
        label: "Confirmações pendentes",
        value: snapshot.pendingConfirmations.toLocaleString("pt-BR"),
        delta: snapshot.pendingConfirmations > 0 ? "Exigem ação" : "Fila sob controle",
        icon: PhoneCall,
        tone: snapshot.pendingConfirmations > 0 ? ("warning" as const) : ("success" as const),
      },
      {
        label: "Novos clientes (semana)",
        value: snapshot.newClientsWeek.toLocaleString("pt-BR"),
        delta: snapshot.newClientsWeek > 0 ? "Aquisição ativa" : "Sem novos cadastros",
        icon: Users,
        tone: "info" as const,
      },
    ],
    [snapshot, upcoming.length],
  );

  const focusMessage =
    snapshot.pendingConfirmations > 0
      ? `${snapshot.pendingConfirmations} horários ainda aguardam confirmação manual.`
      : snapshot.occupancyToday < 70
        ? "A agenda ainda comporta encaixes e reativações hoje."
        : "A operação de hoje está estável e com boa ocupação.";

  return (
    <>
      <PageHeader
        title="Olá! Bem-vindo de volta"
        description={`Visão geral de ${currentTenant?.name ?? "seu negócio"} para hoje.`}
        actions={
          <>
            <Button variant="outline" className="rounded-xl" onClick={() => navigate("/app/dados")}>
              Exportar
            </Button>
            <Button className="rounded-xl bg-gradient-brand" onClick={() => navigate("/app/agenda")}>
              <Plus className="mr-2 h-4 w-4" /> Novo agendamento
            </Button>
          </>
        }
      />

      <NoSubscriptionBanner variant="panel" className="mb-4 md:mb-6" />

      {subscription && (
        <section className="surface-card mb-4 grid grid-cols-1 gap-4 p-4 md:mb-6 md:grid-cols-2 md:p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Seu plano atual</p>
              <p className="font-display text-lg font-semibold text-primary">{plan?.name ?? "Carregando..."}</p>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1 border-t pt-3 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <UsageBar 
              label="Agendamentos (30 dias)" 
              used={usage.appointmentsLast30d} 
              limit={limits?.maxAppointmentsMonth ?? null} 
            />
            {limits?.maxAppointmentsMonth ? (
              <p className="text-[10px] text-muted-foreground">
                {usage.appointmentsLast30d >= limits.maxAppointmentsMonth
                  ? "Limite atingido! Seu negócio cresceu e agora precisa de mais fôlego. Faça upgrade para continuar agendando."
                  : usage.appointmentsLast30d >= (limits.maxAppointmentsMonth * 0.8) 
                    ? "Você está próximo do limite mensal. Considere um upgrade para não parar sua operação." 
                    : "Uso saudável dos limites do seu plano."}
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">
                Você tem agendamentos ilimitados. Aproveite para crescer seu negócio!
              </p>
            )}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="surface-card flex h-28 animate-pulse items-center gap-4 p-4 md:p-5" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className="surface-card flex items-center gap-4 p-4 md:p-5"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-soft text-primary">
                  <kpi.icon className="h-5 w-5" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p
                    className="truncate text-xs font-medium text-muted-foreground"
                    title={kpi.label}
                  >
                    {kpi.label}
                  </p>
                  <p className="font-display text-2xl font-semibold leading-none md:text-3xl">
                    {kpi.value}
                  </p>
                  <StatusBadge
                    tone={kpi.tone}
                    dot
                    className="mt-1 w-fit max-w-full px-1.5 py-0.5 text-[10px] font-normal"
                  >
                    <span className="truncate" title={kpi.delta}>
                      {kpi.delta}
                    </span>
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="surface-card p-5">
              <ErrorBoundary name="UpcomingAppointments">
                <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">Próximos atendimentos</h2>
                  <p className="text-xs text-muted-foreground">Baseado na agenda do dia atual.</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary"
                  onClick={() => navigate(`/app/agenda?date=${todayIso()}`)}
                >
                  Ver agenda <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>

              {upcoming.length === 0 ? (
                <EmptyState
                  title="Sem próximos atendimentos"
                  description="Não há compromissos futuros restantes para hoje."
                  icon={<CalendarHeart className="h-6 w-6" />}
                />
              ) : (
                <ul className="divide-y divide-border/60">
                  {upcoming.map((item) => {
                    const startsAt = new Date(item.appointment.startsAt);
                    return (
                      <li key={item.appointment.id} className="flex items-center gap-3 py-3">
                        <div className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-semibold text-primary">
                          {startsAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <Avatar className="h-9 w-9 border border-border/60">
                          <AvatarFallback className="bg-accent-soft text-xs text-accent-foreground">
                            {initials(item.clientName ?? "Cliente")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.clientName ?? "Cliente"}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.serviceName ?? "Serviço"} · com {item.professionalName ?? "Profissional"}
                          </p>
                        </div>
                        {["confirmed", "arrived", "in_service", "completed", "reminded"].includes(item.appointment.status) ? (
                          <StatusBadge tone="success">Confirmado</StatusBadge>
                        ) : (
                          <StatusBadge tone="warning">A confirmar</StatusBadge>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              </ErrorBoundary>
            </section>

            <div className="grid gap-4 md:gap-6">
              <section className="surface-card overflow-hidden">
                <div className="bg-gradient-brand p-5 text-primary-foreground">
                  <p className="text-xs uppercase tracking-wide opacity-80">Foco do dia</p>
                  <h3 className="mt-1 font-display text-xl">
                    {snapshot.pendingConfirmations > 0 ? "Feche as confirmações pendentes" : "Mantenha a agenda saudável"}
                  </h3>
                  <p className="mt-1 text-sm opacity-90">{focusMessage}</p>
                </div>
                <div className="space-y-2 p-5">
                  <Button
                    className="h-11 w-full rounded-xl bg-foreground text-background hover:bg-foreground/90"
                    onClick={() => navigate("/app/confirmacoes")}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Abrir central de confirmações
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    As mensagens são geradas e abertas manualmente. Nenhum envio automático via WhatsApp.
                  </p>
                </div>
              </section>

              <section className="surface-card p-5">
                <ErrorBoundary name="DashboardShortcuts">
                  <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-lg font-semibold leading-tight">Atalhos</h3>
                    <p className="text-xs text-muted-foreground">Ações mais usadas no dia a dia</p>
                  </div>
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-soft text-primary">
                    <Sparkles className="h-4 w-4" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { label: "Novo cliente", hint: "Cadastrar", icon: Users, to: "/app/clientes" },
                    { label: "Bloquear horário", hint: "Agenda", icon: Clock3, to: `/app/agenda?date=${todayIso()}` },
                    { label: "Vender pacote", hint: "Comercial", icon: Sparkles, to: "/app/pacotes" },
                    { label: "Lista de espera", hint: "Encaixes", icon: PhoneCall, to: "/app/lista-de-espera" },
                  ].map((shortcut) => (
                    <button
                      key={shortcut.label}
                      type="button"
                      onClick={() => navigate(shortcut.to)}
                      className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-soft text-primary transition-transform group-hover:scale-105">
                        <shortcut.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <p className="truncate text-sm font-medium leading-tight">{shortcut.label}</p>
                        <p className="text-[11px] text-muted-foreground">{shortcut.hint}</p>
                      </div>
                    </button>
                  ))}
                </div>
                </ErrorBoundary>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function todayIso() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}
