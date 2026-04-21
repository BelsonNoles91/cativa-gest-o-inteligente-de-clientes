/**
 * Dashboard — visão de topo. Métricas mockadas (Etapa 1 visual).
 */
import {
  CalendarHeart,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock3,
  PhoneCall,
  Sparkles,
  Plus,
  ArrowUpRight,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTenant } from "@/features/tenant/TenantProvider";

const kpis = [
  { label: "Atendimentos hoje", value: "24", delta: "+12%", icon: CalendarHeart, tone: "brand" as const },
  { label: "Ocupação", value: "87%", delta: "+5pp", icon: TrendingUp, tone: "success" as const },
  { label: "Confirmações pendentes", value: "6", delta: "−3", icon: PhoneCall, tone: "warning" as const },
  { label: "Novos clientes (semana)", value: "18", delta: "+8", icon: Users, tone: "info" as const },
];

const upcoming = [
  { time: "10:30", client: "Marina Alves", service: "Coloração + corte", pro: "Júlia", status: "confirmado" as const },
  { time: "11:15", client: "Patrícia Lima", service: "Design de sobrancelha", pro: "Bruna", status: "confirmar" as const },
  { time: "13:00", client: "Renato Dias", service: "Barba + corte", pro: "Caio", status: "confirmado" as const },
  { time: "14:30", client: "Carla Sousa", service: "Manicure + pedicure", pro: "Letícia", status: "confirmar" as const },
];

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

export default function Dashboard() {
  const { currentTenant } = useTenant();

  return (
    <>
      <PageHeader
        title={`Olá! Bem-vindo de volta`}
        description={`Visão geral de ${currentTenant?.name ?? "seu negócio"} para hoje.`}
        actions={
          <>
            <Button variant="outline" className="rounded-xl">Exportar</Button>
            <Button className="rounded-xl bg-gradient-brand">
              <Plus className="mr-2 h-4 w-4" /> Novo agendamento
            </Button>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="surface-card p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-soft text-primary">
                <kpi.icon className="h-4 w-4" />
              </div>
              <StatusBadge tone={kpi.tone} dot={false} className="text-[10px]">{kpi.delta}</StatusBadge>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{kpi.label}</p>
            <p className="font-display text-2xl font-semibold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Conteúdo principal */}
      <div className="mt-6 grid gap-4 md:gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Próximos */}
        <section className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Próximos atendimentos</h2>
              <p className="text-xs text-muted-foreground">Atualizado há instantes</p>
            </div>
            <Button variant="ghost" size="sm" className="text-primary">
              Ver agenda <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>

          <ul className="divide-y divide-border/60">
            {upcoming.map((item) => (
              <li key={item.time + item.client} className="flex items-center gap-3 py-3">
                <div className="grid h-12 w-14 shrink-0 place-items-center rounded-xl bg-primary-soft text-sm font-semibold text-primary">
                  {item.time}
                </div>
                <Avatar className="h-9 w-9 border border-border/60">
                  <AvatarFallback className="bg-accent-soft text-accent-foreground text-xs">
                    {initials(item.client)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.client}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.service} · com {item.pro}</p>
                </div>
                {item.status === "confirmado" ? (
                  <StatusBadge tone="success">Confirmado</StatusBadge>
                ) : (
                  <StatusBadge tone="warning">A confirmar</StatusBadge>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Side widgets */}
        <div className="grid gap-4 md:gap-6">
          <section className="surface-card overflow-hidden">
            <div className="bg-gradient-brand p-5 text-primary-foreground">
              <p className="text-xs uppercase tracking-wide opacity-80">Foco do dia</p>
              <h3 className="mt-1 font-display text-xl">Reduza no-shows</h3>
              <p className="mt-1 text-sm opacity-90">
                6 horários ainda não foram confirmados. Envie a mensagem pronta em poucos cliques.
              </p>
            </div>
            <div className="space-y-2 p-5">
              <Button className="h-11 w-full rounded-xl bg-foreground text-background hover:bg-foreground/90">
                <CheckCircle2 className="mr-2 h-4 w-4" /> Abrir central de confirmações
              </Button>
              <p className="text-[11px] text-muted-foreground">
                As mensagens são geradas e abertas no WhatsApp manualmente. Nenhum envio automático.
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
                { label: "Novo cliente", icon: Users },
                { label: "Bloquear horário", icon: Clock3 },
                { label: "Vender pacote", icon: Sparkles },
                { label: "Lista de espera", icon: PhoneCall },
              ].map((a) => (
                <Button key={a.label} variant="outline" className="h-auto justify-start gap-2 rounded-xl py-3">
                  <a.icon className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium">{a.label}</span>
                </Button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
