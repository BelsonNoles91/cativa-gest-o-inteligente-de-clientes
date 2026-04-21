/**
 * PortalHome — visão geral premium e mobile-first do cliente.
 * Próximo horário em destaque + ações rápidas + termos pendentes.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  MapPin,
  Sparkles,
  User as UserIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { usePortalClient } from "@/features/portal/PortalClientProvider";
import {
  listMyAppointments,
  listMyPendingConsents,
} from "@/repositories/portal";
import { confirmFromPortal } from "@/services/portal/booking";
import {
  firstName,
  isUpcomingAppointment,
  type PortalAppointmentView,
  type PortalConsentPending,
} from "@/domain/portal";
import { appointmentStatusLabels } from "@/domain/scheduling";

function formatDateTime(iso: string): { date: string; time: string; relative: string } {
  const d = new Date(iso);
  const diffH = (d.getTime() - Date.now()) / 36e5;
  let relative = "";
  if (diffH < 0) relative = "passou";
  else if (diffH < 1) relative = `em ${Math.round(diffH * 60)} min`;
  else if (diffH < 24) relative = `em ${Math.round(diffH)}h`;
  else relative = `em ${Math.round(diffH / 24)} dias`;
  return {
    date: d.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
    }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    relative,
  };
}

export default function PortalHome() {
  const { profile, activeLink, branding, refresh } = usePortalClient();
  const { toast } = useToast();
  const [next, setNext] = useState<PortalAppointmentView | null>(null);
  const [consents, setConsents] = useState<PortalConsentPending[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeLink) return;
    void (async () => {
      setLoading(true);
      try {
        const [appts, pending] = await Promise.all([
          listMyAppointments({
            tenantId: activeLink.tenantId,
            clientId: activeLink.clientId,
            rangeStart: new Date().toISOString(),
            excludeStatuses: ["canceled", "no_show", "completed"],
          }),
          listMyPendingConsents(activeLink.tenantId, activeLink.clientId),
        ]);
        const upcoming = appts
          .filter((a) => isUpcomingAppointment(a.appointment))
          .sort(
            (a, b) =>
              new Date(a.appointment.startsAt).getTime() -
              new Date(b.appointment.startsAt).getTime(),
          );
        setNext(upcoming[0] ?? null);
        setConsents(pending);
      } finally {
        setLoading(false);
      }
    })();
  }, [activeLink]);

  async function handleConfirm() {
    if (!next) return;
    try {
      await confirmFromPortal(next.appointment.id);
      toast({ title: "Horário confirmado!" });
      await refresh();
      // recarrega próximos
      if (activeLink) {
        const appts = await listMyAppointments({
          tenantId: activeLink.tenantId,
          clientId: activeLink.clientId,
          rangeStart: new Date().toISOString(),
          excludeStatuses: ["canceled", "no_show", "completed"],
        });
        const upcoming = appts
          .filter((a) => isUpcomingAppointment(a.appointment))
          .sort(
            (a, b) =>
              new Date(a.appointment.startsAt).getTime() -
              new Date(b.appointment.startsAt).getTime(),
          );
        setNext(upcoming[0] ?? null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao confirmar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      {/* Saudação */}
      <section className="space-y-1">
        <p className="text-sm text-muted-foreground">Olá,</p>
        <h1 className="font-display text-2xl font-semibold">
          {firstName(profile?.fullName) || "tudo bem?"} 👋
        </h1>
      </section>

      {/* Próximo horário */}
      {loading ? (
        <Skeleton className="h-44 w-full rounded-2xl" />
      ) : next ? (
        <Card className="overflow-hidden border-0 bg-gradient-brand p-5 text-primary-foreground shadow-lg">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary-foreground/80">
            <Sparkles className="h-3.5 w-3.5" />
            Próximo horário
          </div>
          <h2 className="mt-2 font-display text-xl font-semibold leading-tight">
            {next.serviceName ?? "Atendimento"}
          </h2>
          <p className="mt-0.5 text-sm text-primary-foreground/85">
            com {next.professionalName ?? "profissional"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-primary-foreground/10 p-3">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary-foreground/75">
                <Calendar className="h-3.5 w-3.5" /> Data
              </div>
              <p className="mt-1 capitalize">
                {formatDateTime(next.appointment.startsAt).date}
              </p>
            </div>
            <div className="rounded-xl bg-primary-foreground/10 p-3">
              <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary-foreground/75">
                <Clock className="h-3.5 w-3.5" /> Hora
              </div>
              <p className="mt-1">
                {formatDateTime(next.appointment.startsAt).time} •{" "}
                {formatDateTime(next.appointment.startsAt).relative}
              </p>
            </div>
          </div>
          {next.unitName && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-primary-foreground/80">
              <MapPin className="h-3.5 w-3.5" /> {next.unitName}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {next.appointment.status !== "confirmed" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleConfirm}
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              asChild
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <Link to="/portal/agenda">
                Ver detalhes <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-primary-foreground/75">
            Status: {appointmentStatusLabels[next.appointment.status]}
          </p>
        </Card>
      ) : (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Nenhum horário marcado"
          description="Que tal agendar o seu próximo atendimento agora?"
          action={
            <Button asChild>
              <Link to="/portal/agendar">
                <CalendarPlus className="mr-1.5 h-4 w-4" /> Agendar agora
              </Link>
            </Button>
          }
        />
      )}

      {/* Ações rápidas */}
      <section>
        <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
          Ações rápidas
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <Link
            to="/portal/agendar"
            className="group flex flex-col gap-1 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">
              <CalendarPlus className="h-5 w-5" />
            </div>
            <p className="mt-1 font-medium">Novo agendamento</p>
            <p className="text-xs text-muted-foreground">Escolha serviço, dia e hora</p>
          </Link>
          <Link
            to="/portal/historico"
            className="group flex flex-col gap-1 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">
              <Calendar className="h-5 w-5" />
            </div>
            <p className="mt-1 font-medium">Histórico</p>
            <p className="text-xs text-muted-foreground">Atendimentos anteriores</p>
          </Link>
          <Link
            to="/portal/pacotes"
            className="group flex flex-col gap-1 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <p className="mt-1 font-medium">Pacotes</p>
            <p className="text-xs text-muted-foreground">Sessões e protocolos</p>
          </Link>
          <Link
            to="/portal/perfil"
            className="group flex flex-col gap-1 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-soft text-primary">
              <UserIcon className="h-5 w-5" />
            </div>
            <p className="mt-1 font-medium">Meu perfil</p>
            <p className="text-xs text-muted-foreground">Dados e preferências</p>
          </Link>
        </div>
      </section>

      {/* Termos pendentes */}
      {consents.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Pendências
          </h3>
          <div className="space-y-2">
            {consents.map((c) => (
              <Card
                key={c.responseId}
                className="flex items-center gap-3 p-3"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/15 text-warning">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.templateTitle}</p>
                  <p className="text-xs text-muted-foreground">Termo aguardando assinatura</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/portal/perfil`}>
                    Abrir <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Contato do estabelecimento */}
      {branding?.unitPhone && (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Precisa de ajuda?</p>
          <p className="mt-1 font-medium">{branding.tenantName}</p>
          <a
            href={`tel:${branding.unitPhone}`}
            className="mt-1 block text-sm text-primary hover:underline"
          >
            {branding.unitPhone}
          </a>
          {branding.unitAddress && (
            <p className="mt-1 text-xs text-muted-foreground">{branding.unitAddress}</p>
          )}
        </Card>
      )}
    </div>
  );
}
