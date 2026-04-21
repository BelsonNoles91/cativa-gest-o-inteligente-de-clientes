/**
 * ConfirmationActionDialog — drawer/dialog com todas as ações operacionais
 * para um item da fila: gerar texto pronto, copiar, abrir wa.me, registrar
 * ligação, registrar tentativa e atualizar status.
 *
 * NUNCA dispara mensagens automaticamente.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  ExternalLink,
  Phone,
  Send,
  CalendarPlus,
  CheckCircle2,
  XCircle,
  PhoneOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { renderForTemplate } from "@/services/confirmation/renderTemplate";
import {
  callOutcomeLabels,
  channelLabels,
  digitsOnly,
  type CallOutcome,
  type MessageChannel,
  type MessageTemplate,
} from "@/domain/confirmation";
import { listAttempts } from "@/repositories/confirmation";
import type { QueueItemHydrated } from "@/repositories/confirmation";
import type { useConfirmationCenter } from "./useConfirmationCenter";

interface Props {
  item: QueueItemHydrated | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  templates: MessageTemplate[];
  center: ReturnType<typeof useConfirmationCenter>;
}

export function ConfirmationActionDialog({ item, open, onOpenChange, templates, center }: Props) {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  const [templateId, setTemplateId] = useState<string>("");
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<MessageChannel>("whatsapp");
  const [callOutcome, setCallOutcome] = useState<CallOutcome>("answered");
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState<Awaited<ReturnType<typeof listAttempts>>>([]);

  const phoneDigits = useMemo(
    () => (item?.clientWhatsapp ? digitsOnly(item.clientWhatsapp) : ""),
    [item?.clientWhatsapp],
  );

  const renderCtx = useMemo(() => {
    if (!item) return null;
    return {
      clientName: item.clientName,
      businessName: currentTenant?.name ?? "",
      unitName: item.unitName,
      professionalName: item.professionalName,
      serviceName: item.serviceName,
      startsAt: item.appointmentStartsAt,
      unitAddress: null,
    };
  }, [item, currentTenant?.name]);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!open || !item) return;
    setTemplateId("");
    setText("");
    setChannel("whatsapp");
    setCallOutcome("answered");
    setNotes("");
    void (async () => {
      try {
        if (currentTenant) {
          const h = await listAttempts({
            tenantId: currentTenant.id,
            queueId: item.id,
            limit: 20,
          });
          setHistory(h);
        }
      } catch {
        setHistory([]);
      }
    })();
  }, [open, item, currentTenant]);

  // Preenche texto ao escolher template
  useEffect(() => {
    if (!templateId || !renderCtx) return;
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setText(renderForTemplate(t, renderCtx));
    setChannel(t.channel);
  }, [templateId, templates, renderCtx]);

  if (!item) return null;

  const waLink =
    phoneDigits && text
      ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`
      : phoneDigits
      ? `https://wa.me/${phoneDigits}`
      : null;

  async function copyMessage() {
    if (!text) {
      toast({ title: "Escreva uma mensagem antes de copiar", variant: "destructive" });
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Mensagem copiada" });
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  }

  async function openWhatsApp() {
    if (!waLink) {
      toast({ title: "Cliente sem WhatsApp/telefone", variant: "destructive" });
      return;
    }
    window.open(waLink, "_blank", "noopener,noreferrer");
    if (item) {
      await center.logAttempt({
        item,
        channel: "whatsapp",
        result: "sent",
        messagePreview: text.slice(0, 280),
        templateId: templateId || null,
        notes: notes || null,
      });
    }
  }

  async function justRegister(result: "sent" | "no_response") {
    if (!item) return;
    await center.logAttempt({
      item,
      channel,
      result,
      messagePreview: text ? text.slice(0, 280) : null,
      templateId: templateId || null,
      notes: notes || null,
    });
  }

  async function submitCall() {
    if (!item) return;
    await center.logCall({
      item,
      outcome: callOutcome,
      notes: notes || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {item.clientName}
              </DialogTitle>
              <DialogDescription>
                {item.serviceName ?? "Atendimento"} •{" "}
                {new Date(item.appointmentStartsAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {item.professionalName ? ` • ${item.professionalName}` : ""}
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="message" className="mt-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="message">Mensagem</TabsTrigger>
                <TabsTrigger value="call">Ligação</TabsTrigger>
                <TabsTrigger value="status">Status</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
              </TabsList>

              {/* MENSAGEM */}
              <TabsContent value="message" className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Template</Label>
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha um template (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.length === 0 && (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          Nenhum template ativo. Crie em Configurações.
                        </div>
                      )}
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name} • {channelLabels[t.channel]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block">Canal</Label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as MessageChannel)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(channelLabels) as MessageChannel[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {channelLabels[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block">Mensagem</Label>
                  <Textarea
                    rows={8}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Escreva ou selecione um template…"
                    className="font-mono text-sm"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Variáveis disponíveis: {"{{cliente_nome}}, {{data}}, {{hora}}, {{servico_nome}}, {{negocio_nome}}…"}
                  </p>
                </div>

                <div>
                  <Label className="mb-1.5 block">Anotação interna (opcional)</Label>
                  <Textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observação que ficará no histórico…"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button onClick={copyMessage} variant="outline">
                    <Copy className="mr-1.5 h-4 w-4" /> Copiar
                  </Button>
                  <Button onClick={openWhatsApp} disabled={!phoneDigits}>
                    <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir WhatsApp
                  </Button>
                  <Button onClick={() => justRegister("sent")} variant="secondary">
                    <Send className="mr-1.5 h-4 w-4" /> Marcar como enviado
                  </Button>
                  <Button onClick={() => justRegister("no_response")} variant="ghost">
                    Sem resposta
                  </Button>
                </div>
              </TabsContent>

              {/* LIGAÇÃO */}
              <TabsContent value="call" className="space-y-4">
                {item.clientPhone ? (
                  <Button asChild variant="outline">
                    <a href={`tel:${item.clientPhone}`}>
                      <Phone className="mr-1.5 h-4 w-4" /> Ligar para {item.clientPhone}
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Cliente sem telefone cadastrado.</p>
                )}
                <div>
                  <Label className="mb-1.5 block">Resultado</Label>
                  <Select value={callOutcome} onValueChange={(v) => setCallOutcome(v as CallOutcome)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(callOutcomeLabels) as CallOutcome[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {callOutcomeLabels[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block">Notas</Label>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="O que foi conversado…"
                  />
                </div>
                <Button onClick={submitCall}>
                  <PhoneOff className="mr-1.5 h-4 w-4" /> Registrar ligação
                </Button>
              </TabsContent>

              {/* STATUS */}
              <TabsContent value="status" className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Atualize o status final deste item da fila.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Button
                    variant="default"
                    onClick={() => center.setItemStatus(item.id, "confirmed")}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmado
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => center.setItemStatus(item.id, "reschedule_requested")}
                  >
                    <CalendarPlus className="mr-1.5 h-4 w-4" /> Pediu reagendar
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => center.setItemStatus(item.id, "no_response")}
                  >
                    Sem resposta
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => center.setItemStatus(item.id, "follow_up_scheduled")}
                  >
                    Retorno agendado
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => center.setItemStatus(item.id, "canceled")}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" /> Cancelou
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => center.setItemStatus(item.id, "closed")}
                  >
                    Encerrar
                  </Button>
                </div>
              </TabsContent>

              {/* HISTÓRICO */}
              <TabsContent value="history" className="space-y-2">
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhuma tentativa registrada ainda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {history.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-md border bg-card p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {channelLabels[h.channel]} • {h.result}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(h.attemptedAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {h.messagePreview && (
                          <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                            {h.messagePreview}
                          </p>
                        )}
                        {h.notes && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            “{h.notes}”
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
