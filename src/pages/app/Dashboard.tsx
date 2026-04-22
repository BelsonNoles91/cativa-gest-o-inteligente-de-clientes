import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowUpRight,
  CalendarHeart,
  CheckCircle2,
  Clock3,
  Loader2,
  PhoneCall,
  Plus,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useToast } from "@/hooks/use-toast";
import { listAppointmentsHydrated, type HydratedAppointment } from "@/repositories/scheduling";
import { countQueueByStage } from "@/repositories/confirmation";
import { fetchAvailability } from "@/repositories/analytics";
import { supabase } from "@/integrations/supabase/client";

type DashboardSnapshot = {
  appointmentsToday: number;
  occupancyToday: number;
  pendingConfirmations: number;
  newClientsWeek: number;
};

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
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({
    appointmentsToday: 0,
    occupancyToday: 0,
    pendingConfirmations: 0,
    newClientsWeek: 0,
  });
  const [upcoming, setUpcoming] = useState<HydratedAppointment[]>([]);

  useEffect(() => {
    if (!currentTenant) return;
    let ignore = false;
    setLoading(true);

    const today = localDayRange(new Date());
    const weekStart = startOfWeek(new Date());

    void (async () => {
      try {
        const [appointmentsToday, queueCounts, availability, newClients] = await Promise.all([
          listAppointmentsHydrated({
            tenantId: currentTenant.id,
            rangeStart: today.start.toISOString(),
            rangeEnd: today.end.toISOString(),
          }),
          countQueueByStage(currentTenant.id),
          fetchAvailability({
            tenantId: currentTenant.id,
            start: today.start.toISOString(),
            end: today.end.toISOString(),
          }),
          supabase
            .from("clients")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", currentTenant.id)
            .gte("created_at", weekStart.toISOString()),
        ]);

        if (ignore) return;

        const bookedMinutes = appointmentsToday
          .filter((item) => !["canceled", "no_show"].includes(item.appointment.status))
          .reduce((total, item) => total + item.appointment.durationMinutes, 0);
        const occupancyToday =
          availability.availableMinutes > 0
            ? Math.round((bookedMinutes / availability.availableMinutes) * 100)
            : 0;
        const pendingConfirmations = Object.values(queueCounts).reduce((total, value) => total + value, 0);

        setUpcoming(
          appointmentsToday
            .filter((item) => new Date(item.appointment.startsAt).getTime() >= Date.now())
            .slice(0, 6),
        );
        setSnapshot({
          appointmentsToday: appointmentsToday.length,
          occupancyToday,
          pendingConfirmations,
          newClientsWeek: newClients.count ?? 0,
        });
      } catch (error) {
        if (ignore) return;
        toast({
          title: "Erro ao carregar painel",
          description: error instanceof Error ? error.message : "Erro inesperado.",
          variant: "destructive",
        });
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [currentTenant, toast]);

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

      {loading ? (
        <div className="flex h-60 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="surface-card p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-soft text-primary">
                    <kpi.icon className="h-4 w-4" />
                  </div>
                  <StatusBadge tone={kpi.tone} dot={false} className="text-[10px]">
                    {kpi.delta}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{kpi.label}</p>
                <p className="font-display text-2xl font-semibold">{kpi.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="surface-card p-5">
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
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">Atalhos</h3>
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Novo cliente", icon: Users, to: "/app/clientes" },
                    { label: "Bloquear horário", icon: Clock3, to: `/app/agenda?date=${todayIso()}` },
                    { label: "Vender pacote", icon: Sparkles, to: "/app/pacotes" },
                    { label: "Lista de espera", icon: PhoneCall, to: "/app/lista-de-espera" },
                  ].map((shortcut) => (
                    <Button
                      key={shortcut.label}
                      variant="outline"
                      className="h-auto justify-start gap-2 rounded-xl py-3"
                      onClick={() => navigate(shortcut.to)}
                    >
                      <shortcut.icon className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium">{shortcut.label}</span>
                    </Button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function localDayRange(base: Date) {
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function startOfWeek(base: Date) {
  const date = new Date(base);
  date.setHours(0, 0, 0, 0);
  const diff = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - diff);
  return date;
}

function todayIso() {
  const now = new Date();
  const adjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return adjusted.toISOString().slice(0, 10);
}
