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
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { renderForTemplate } from "@/services/confirmation/renderTemplate";
import {
  callOutcomeLabels,
  channelLabels,
  queueStatusLabels,
  type CallOutcome,
  type ChannelPreference,
  type MessageChannel,
  type MessageTemplate,
} from "@/domain/confirmation";
import { buildManualWhatsAppLink } from "@/lib/whatsapp";
import { getChannelPreference, listAttempts, listCallLogs, upsertChannelPreference } from "@/repositories/confirmation";
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
  const [calls, setCalls] = useState<Awaited<ReturnType<typeof listCallLogs>>>([]);
  const [preference, setPreference] = useState<ChannelPreference | null>(null);
  const [prefChannel, setPrefChannel] = useState<MessageChannel>("whatsapp");
  const [fallbackChannel, setFallbackChannel] = useState<string>("none");
  const [prefWindowStart, setPrefWindowStart] = useState("");
  const [prefWindowEnd, setPrefWindowEnd] = useState("");
  const [doNotDisturb, setDoNotDisturb] = useState(false);
  const [prefNotes, setPrefNotes] = useState("");

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
          const [h, c, p] = await Promise.all([
            listAttempts({
              tenantId: currentTenant.id,
              queueId: item.id,
              limit: 20,
            }),
            listCallLogs({
              tenantId: currentTenant.id,
              queueId: item.id,
              limit: 20,
            }),
            getChannelPreference(currentTenant.id, item.clientId),
          ]);
          setHistory(h);
          setCalls(c);
          setPreference(p);
          setPrefChannel(p?.preferredChannel ?? "whatsapp");
          setFallbackChannel(p?.fallbackChannel ?? "none");
          setPrefWindowStart(p?.preferredWindowStart?.slice(0, 5) ?? "");
          setPrefWindowEnd(p?.preferredWindowEnd?.slice(0, 5) ?? "");
          setDoNotDisturb(p?.doNotDisturb ?? false);
          setPrefNotes(p?.notes ?? "");
        }
      } catch {
        setHistory([]);
        setCalls([]);
        setPreference(null);
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

  const waLink = buildManualWhatsAppLink(item.clientWhatsapp, text || null);

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
    toast({ title: "WhatsApp aberto", description: "Após enviar manualmente, registre como enviado." });
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

  async function savePreference() {
    if (!item || !currentTenant) return;
    try {
      await upsertChannelPreference({
        tenantId: currentTenant.id,
        clientId: item.clientId,
        preferredChannel: prefChannel,
        fallbackChannel: fallbackChannel === "none" ? null : (fallbackChannel as MessageChannel),
        preferredWindowStart: prefWindowStart ? `${prefWindowStart}:00` : null,
        preferredWindowEnd: prefWindowEnd ? `${prefWindowEnd}:00` : null,
        doNotDisturb,
        notes: prefNotes || null,
      });
      toast({ title: preference ? "Preferência atualizada" : "Preferência registrada" });
    } catch {
      toast({ title: "Não foi possível salvar a preferência", variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-h-[90vh] min-w-0 max-w-2xl overflow-hidden p-0 sm:w-full">
        <div className="max-h-[90vh] min-w-0 overflow-x-hidden overflow-y-auto">
          <div className="min-w-0 p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle className="break-words pr-8">
                {item.clientName}
              </DialogTitle>
              <DialogDescription className="break-words">
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

            <Tabs defaultValue="message" className="mt-4 min-w-0">
              <TabsList className="flex w-full max-w-full justify-start overflow-x-auto">
                <TabsTrigger value="message" className="shrink-0 whitespace-nowrap">Mensagem</TabsTrigger>
                <TabsTrigger value="call" className="shrink-0 whitespace-nowrap">Ligação</TabsTrigger>
                <TabsTrigger value="status" className="shrink-0 whitespace-nowrap">Status</TabsTrigger>
                <TabsTrigger value="prefs" className="shrink-0 whitespace-nowrap">Preferências</TabsTrigger>
                <TabsTrigger value="history" className="shrink-0 whitespace-nowrap">Histórico</TabsTrigger>
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
              <TabsContent value="status" className="space-y-4">
                <div className="rounded-xl bg-muted/40 p-4">
                  <p className="text-sm font-medium text-foreground">
                    Atualizar status do agendamento
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Status atual na fila: {queueStatusLabels[item.status]}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Button
                    variant="default"
                    className="bg-success hover:bg-success/90"
                    onClick={() => center.setItemStatus(item.id, "confirmed")}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmado
                  </Button>
                  <Button
                    variant="outline"
                    className="border-warning/30 text-warning hover:bg-warning/5"
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

                {(item.status === "reschedule_requested" || item.status === "canceled") && (
                  <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-2">
                    <p className="text-sm font-semibold text-primary flex items-center gap-2">
                      <CalendarPlus className="h-4 w-4" /> Sugestão: Rebooking
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      O cliente não virá. Deseja registrar as opções de horários propostas para garantir a volta dele?
                    </p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" className="h-8 text-[11px] rounded-lg">Registrar opções</Button>
                      <Button size="sm" variant="ghost" className="h-8 text-[11px] rounded-lg">Ignorar</Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="prefs" className="space-y-4">
                <div>
                  <Label className="mb-1.5 block">Canal preferido</Label>
                  <Select value={prefChannel} onValueChange={(v) => setPrefChannel(v as MessageChannel)}>
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
                  <Label className="mb-1.5 block">Canal reserva</Label>
                  <Select value={fallbackChannel} onValueChange={setFallbackChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem reserva</SelectItem>
                      {(Object.keys(channelLabels) as MessageChannel[]).map((c) => (
                        <SelectItem key={c} value={c}>
                          {channelLabels[c]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="mb-1.5 block">Janela inicial</Label>
                    <input
                      type="time"
                      value={prefWindowStart}
                      onChange={(e) => setPrefWindowStart(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block">Janela final</Label>
                    <input
                      type="time"
                      value={prefWindowEnd}
                      onChange={(e) => setPrefWindowEnd(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={doNotDisturb}
                    onChange={(e) => setDoNotDisturb(e.target.checked)}
                  />
                  Não perturbar
                </label>

                <div>
                  <Label className="mb-1.5 block">Observações</Label>
                  <Textarea
                    rows={3}
                    value={prefNotes}
                    onChange={(e) => setPrefNotes(e.target.value)}
                    placeholder="Ex.: só responde após 14h, prefere ligação."
                  />
                </div>

                <Button onClick={savePreference}>Salvar preferência</Button>
              </TabsContent>

              {/* HISTÓRICO */}
              <TabsContent value="history" className="space-y-2">
                {history.length === 0 && calls.length === 0 ? (
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
                    {calls.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-md border bg-card p-3 text-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            Ligação • {callOutcomeLabels[c.outcome]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.calledAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        {c.durationSeconds ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            duração: {Math.round(c.durationSeconds / 60)} min
                          </p>
                        ) : null}
                        {c.notes && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            “{c.notes}”
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
