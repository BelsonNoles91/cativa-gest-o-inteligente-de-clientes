/**
 * PortalHistory — atendimentos passados + opção de avaliar.
 */
import { useEffect, useState } from "react";
import { Calendar, Clock, MapPin, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePortalClient } from "@/features/portal/PortalClientProvider";
import {
  listMyAppointments,
  listMyReviews,
  submitReview,
} from "@/repositories/portal";
import { isPastAppointment, type PortalAppointmentView } from "@/domain/portal";
import { appointmentStatusLabels, statusTone } from "@/domain/scheduling";
import { cn } from "@/lib/utils";

const toneMap = {
  default: "neutral",
  success: "success",
  warning: "warning",
  destructive: "danger",
  info: "info",
  muted: "neutral",
} as const;

export default function PortalHistory() {
  const { activeLink } = usePortalClient();
  const { toast } = useToast();
  const [items, setItems] = useState<PortalAppointmentView[]>([]);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<PortalAppointmentView | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!activeLink) return;
    setLoading(true);
    try {
      const [appts, revs] = await Promise.all([
        listMyAppointments({
          tenantId: activeLink.tenantId,
          clientId: activeLink.clientId,
        }),
        listMyReviews(activeLink.tenantId, activeLink.clientId),
      ]);
      setItems(appts.filter((a) => isPastAppointment(a.appointment)));
      setReviewedIds(new Set(revs.map((r) => r.appointmentId)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLink?.clientId]);

  async function handleSubmitReview() {
    if (!activeLink || !reviewing) return;
    setSubmitting(true);
    try {
      await submitReview({
        tenantId: activeLink.tenantId,
        clientId: activeLink.clientId,
        professionalId: reviewing.appointment.professionalId,
        review: {
          appointmentId: reviewing.appointment.id,
          rating,
          comment: comment.trim() || null,
          wouldRecommend: rating >= 4,
        },
      });
      toast({ title: "Obrigado pela avaliação!" });
      setReviewing(null);
      setRating(5);
      setComment("");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao enviar avaliação";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-2xl font-semibold">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          Seus atendimentos anteriores
        </p>
      </header>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="Nenhum atendimento ainda"
          description="Quando você for atendido, aparecerá aqui."
        />
      ) : (
        <ul className="space-y-3">
          {items.map((view) => {
            const a = view.appointment;
            const start = new Date(a.startsAt);
            const canReview =
              a.status === "completed" && !reviewedIds.has(a.id);
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
                      year: "numeric",
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
                {canReview && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setReviewing(view);
                      setRating(5);
                      setComment("");
                    }}
                  >
                    <Star className="mr-1.5 h-4 w-4" /> Avaliar atendimento
                  </Button>
                )}
                {reviewedIds.has(a.id) && (
                  <p className="mt-2 text-xs text-success">✓ Avaliado</p>
                )}
              </Card>
            );
          })}
        </ul>
      )}

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Avalie seu atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="mb-2 block">Sua nota</Label>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className="p-1"
                    aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
                  >
                    <Star
                      className={cn(
                        "h-8 w-8 transition",
                        n <= rating
                          ? "fill-warning text-warning"
                          : "text-muted-foreground/40",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Comentário (opcional)</Label>
              <Textarea
                rows={4}
                placeholder="O que você achou?"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, 500))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReviewing(null)} disabled={submitting}>
                Cancelar
              </Button>
              <Button onClick={handleSubmitReview} disabled={submitting}>
                Enviar avaliação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
