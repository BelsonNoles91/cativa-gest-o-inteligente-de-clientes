import { useEffect, useState } from "react";
import { Copy, Loader2, MessageCircle, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  insertAppointment,
  listWaitlistHydrated,
  setWaitlistStatus,
} from "@/repositories/scheduling";
import {
  matchWaitlistForSlot,
  slotOfferMessage,
  type RankedCandidate,
} from "@/domain/waitlist-offer";
import { whatsappLink } from "@/domain/retention-outreach";

export interface FreedSlotInfo {
  unitId: string;
  professionalId: string;
  professionalName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  cancellationPolicyId?: string | null;
  priceCents?: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  businessName: string | null;
  slot: FreedSlotInfo | null;
  userId?: string | null;
  onScheduled?: () => void | Promise<void>;
}

export function SlotOfferDialog({
  open,
  onOpenChange,
  tenantId,
  businessName,
  slot,
  userId,
  onScheduled,
}: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [ranked, setRanked] = useState<RankedCandidate[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !slot || !tenantId) return;
    let ignore = false;
    setLoading(true);
    void (async () => {
      try {
        const entries = await listWaitlistHydrated(tenantId);
        if (ignore) return;
        const candidates = entries.map((row) => ({
          id: row.entry.id,
          clientId: row.entry.clientId,
          clientName: row.clientName,
          clientPhone: row.clientPhone,
          serviceId: row.entry.serviceId,
          serviceName: row.serviceName,
          preferredUnitId: row.entry.preferredUnitId,
          preferredProfessionalId: row.entry.preferredProfessionalId,
          desiredWindowStart: row.entry.desiredWindowStart,
          desiredWindowEnd: row.entry.desiredWindowEnd,
          priority: row.entry.priority,
          status: row.entry.status,
          createdAt: row.entry.createdAt,
        }));
        setRanked(matchWaitlistForSlot(candidates, slot).slice(0, 5));
      } catch (error) {
        if (!ignore) {
          toast({
            title: "Não foi possível abrir a lista de espera",
            description: error instanceof Error ? error.message : "Erro inesperado.",
            variant: "destructive",
          });
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [open, slot, tenantId, toast]);

  function messageFor(item: RankedCandidate) {
    if (!slot) return "";
    return slotOfferMessage({
      clientName: item.candidate.clientName,
      businessName,
      serviceName: item.candidate.serviceName ?? slot.serviceName,
      professionalName: slot.professionalName,
      startsAt: slot.startsAt,
    });
  }

  async function handleReserve(item: RankedCandidate) {
    if (!slot) return;
    const serviceId = item.candidate.serviceId ?? slot.serviceId;
    if (!serviceId) {
      toast({
        title: "Serviço não definido",
        description: "Escolha o serviço pela agenda para reservar este horário.",
        variant: "destructive",
      });
      return;
    }
    setBusyId(item.candidate.id);
    try {
      const appointment = await insertAppointment({
        tenantId,
        unitId: slot.unitId,
        clientId: item.candidate.clientId,
        professionalId: slot.professionalId,
        serviceId,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        durationMinutes: slot.durationMinutes,
        bufferBeforeMinutes: slot.bufferBeforeMinutes ?? 0,
        bufferAfterMinutes: slot.bufferAfterMinutes ?? 0,
        cancellationPolicyId: slot.cancellationPolicyId ?? null,
        source: "frontdesk",
        status: "pending",
        totalPriceCents: slot.priceCents ?? 0,
        itemPriceCents: slot.priceCents ?? 0,
        createdBy: userId ?? null,
        internalNotes: "Vaga oferecida pela lista de espera",
      });
      await setWaitlistStatus(item.candidate.id, "scheduled", {
        scheduledAppointmentId: appointment.id,
      });
      toast({ title: "Horário reservado", description: `${item.candidate.clientName ?? "Cliente"} entrou na agenda.` });
      onOpenChange(false);
      await onScheduled?.();
    } catch (error) {
      toast({
        title: "Não foi possível reservar",
        description: error instanceof Error ? error.message : "Erro inesperado.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy(item: RankedCandidate) {
    await navigator.clipboard.writeText(messageFor(item));
    toast({ title: "Texto copiado" });
  }

  function handleWhats(item: RankedCandidate) {
    const link = whatsappLink(item.candidate.clientPhone, messageFor(item));
    if (!link) {
      toast({
        title: "Sem telefone válido",
        description: "Cadastre o WhatsApp do cliente para enviar a mensagem.",
        variant: "destructive",
      });
      return;
    }
    window.open(link, "_blank", "noopener,noreferrer");
    void setWaitlistStatus(item.candidate.id, "contacted");
  }

  const when = slot
    ? new Date(slot.startsAt).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            Oferecer a vaga que abriu
          </DialogTitle>
          <DialogDescription>
            {when ? `Horário livre em ${when}${slot?.professionalName ? ` com ${slot.professionalName}` : ""}.` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : ranked.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Ninguém da lista de espera combina com esse horário agora.
          </p>
        ) : (
          <div className="space-y-3">
            {ranked.map((item) => (
              <div key={item.candidate.id} className="rounded-xl border p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.candidate.clientName ?? "Cliente"}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.candidate.serviceName ?? slot?.serviceName ?? "Serviço a combinar"}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1">
                    {item.reasons.slice(0, 2).map((reason) => (
                      <Badge key={reason} variant="secondary" className="text-[11px]">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="min-h-[40px]"
                    disabled={busyId === item.candidate.id}
                    onClick={() => void handleReserve(item)}
                  >
                    {busyId === item.candidate.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : null}
                    Reservar este horário
                  </Button>
                  <Button size="sm" variant="outline" className="min-h-[40px]" onClick={() => handleWhats(item)}>
                    <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                    WhatsApp
                  </Button>
                  <Button size="sm" variant="ghost" className="min-h-[40px]" onClick={() => void handleCopy(item)}>
                    <Copy className="mr-2 h-4 w-4" aria-hidden />
                    Copiar texto
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
