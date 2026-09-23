/**
 * PortalAgenda — lista de próximos horários do cliente.
 * Permite confirmar, reagendar (link → /portal/agendar?reschedule=) e cancelar.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePortalClient } from "@/features/portal/PortalClientProvider";
import { listMyAppointments } from "@/repositories/portal";
import { fetchSelfServiceStatus } from "@/repositories/self-service-rules";
import { cancelFromPortal, confirmFromPortal } from "@/services/portal/booking";
import {
  canClientCancel,
  canClientReschedule,
  type SelfServiceStatus,
} from "@/domain/self-service";
import {
  isUpcomingAppointment,
  type PortalAppointmentView,
} from "@/domain/portal";
import { appointmentStatusLabels, statusTone } from "@/domain/scheduling";

const toneMap = {
  default: "neutral",
  success: "success",
  warning: "warning",
  destructive: "danger",
  info: "info",
  muted: "neutral",
} as const;

export default function PortalAgenda() {
  const { activeLink } = usePortalClient();
  const { toast } = useToast();
  const [items, setItems] = useState<PortalAppointmentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelTarget, setCancelTarget] = useState<PortalAppointmentView | null>(null);

  const load = async () => {
    if (!activeLink) return;
    setLoading(true);
    try {
      const data = await listMyAppointments({
        tenantId: activeLink.tenantId,
        clientId: activeLink.clientId,
        rangeStart: new Date().toISOString(),
      });
      setItems(data.filter((a) => isUpcomingAppointment(a.appointment)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLink?.clientId]);

  async function handleConfirm(view: PortalAppointmentView) {
    try {
      await confirmFromPortal(view.appointment.id);
      toast({ title: "Horário confirmado" });
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao confirmar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return;
    try {
      const r = await cancelFromPortal({
        appointmentId: cancelTarget.appointment.id,
        startsAt: cancelTarget.appointment.startsAt,
        policy: cancelTarget.policy,
        reason: "Cancelado pelo cliente no portal",
      });
      toast({
        title: "Horário cancelado",
        description: r.willChargeFee
          ? `Atenção: pode haver cobrança de ${r.feePct}% conforme política.`
          : undefined,
      });
      setCancelTarget(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao cancelar";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Minha agenda</h1>
          <p className="text-sm text-muted-foreground">
            Próximos atendimentos e ações rápidas
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/portal/agendar">
            <CalendarPlus className="mr-1.5 h-4 w-4" /> Agendar
          </Link>
        </Button>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Nenhum horário marcado"
          description="Você ainda não tem agendamentos futuros."
          action={
            <Button asChild>
              <Link to="/portal/agendar">
                <CalendarPlus className="mr-1.5 h-4 w-4" /> Agendar agora
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((view) => {
            const a = view.appointment;
            const start = new Date(a.startsAt);
            const cancelInfo = canCancelWithoutFee(a.startsAt, view.policy);
            return (
              <Card key={a.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-base font-semibold">
                      {view.serviceName ?? "Atendimento"}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      com {view.professionalName ?? "profissional"}
                    </p>
                  </div>
                  <StatusBadge tone={toneMap[statusTone(a.status)]}>
                    {appointmentStatusLabels[a.status]}
                  </StatusBadge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {start.toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      weekday: "short",
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {start.toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {view.unitName && (
                    <span className="col-span-2 inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" /> {view.unitName}
                    </span>
                  )}
                </div>

                {!cancelInfo.allowed && view.policy && (
                  <p className="mt-2 rounded-md bg-warning/10 px-2 py-1 text-xs text-warning-foreground/90">
                    Atenção: cancelamento dentro de {view.policy.hoursBeforeNoCharge}h
                    pode gerar taxa de {view.policy.lateCancelFeePct}%.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {a.status !== "confirmed" && (
                    <Button size="sm" onClick={() => handleConfirm(view)}>
                      <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmar
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/portal/agendar?reschedule=${a.id}`}>
                      <RotateCcw className="mr-1.5 h-4 w-4" /> Reagendar
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setCancelTarget(view)}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Cancelar
                  </Button>
                </div>
              </Card>
            );
          })}
        </ul>
      )}

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar este horário?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget?.policy && cancelTarget &&
              !canCancelWithoutFee(cancelTarget.appointment.startsAt, cancelTarget.policy)
                .allowed ? (
                <>
                  Você está cancelando dentro da janela de{" "}
                  {cancelTarget.policy.hoursBeforeNoCharge}h. Isso pode gerar uma taxa
                  de {cancelTarget.policy.lateCancelFeePct}% conforme a política do
                  estabelecimento.
                </>
              ) : (
                "Você não será cobrado por este cancelamento."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
