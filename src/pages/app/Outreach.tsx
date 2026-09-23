/**
 * Outreach — Retorno e reativação (/app/retorno).
 *
 * Duas filas de trabalho para a recepção: quem está na hora de voltar
 * (lembrete de retorno) e quem parou de vir (reativação). O texto da mensagem
 * é gerado aqui e o envio é sempre manual, pelo WhatsApp da pessoa.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarHeart, Copy, MessageCircle, RefreshCw, Sparkles, Ticket, UserPlus } from "lucide-react";
import {
  couponDescription,
  createCoupon,
  generateCouponCode,
  listCoupons,
  type ReactivationCoupon,
} from "@/repositories/coupons";


import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useOutreach } from "@/features/outreach/useOutreach";
import {
  reactivationMessage,
  returnReminderMessage,
  whatsappLink,
  type OutreachClient,
  type ReactivationCandidate,
  type ReturnReminder,
} from "@/domain/retention-outreach";
import {
  clearOutreachEntry,
  logOutreach,
  outcomeLabels,
  readOutreachLog,
  type OutreachLogEntry,
  type OutreachOutcome,
} from "@/lib/outreach-log";

const URGENCY_LABEL: Record<ReturnReminder["urgency"], string> = {
  due_soon: "Chegando a hora",
  due: "Na hora de voltar",
  late: "Passou do ponto",
};

const URGENCY_TONE: Record<ReturnReminder["urgency"], "info" | "warning" | "danger"> = {
  due_soon: "info",
  due: "warning",
  late: "danger",
};

const SEGMENT_LABEL: Record<ReactivationCandidate["segment"], string> = {
  at_risk: "Em risco",
  lost: "Parou de vir",
};

function money(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

interface RowProps {
  row: OutreachClient;
  badge: React.ReactNode;
  detail: string;
  message: string;
  logEntry?: OutreachLogEntry;
  extraActions?: React.ReactNode;
  onLog: (clientId: string, outcome: OutreachOutcome) => void;
  onClearLog: (clientId: string) => void;
}

function OutreachRow({ row, badge, detail, message, logEntry, extraActions, onLog, onClearLog }: RowProps) {

  const { toast } = useToast();
  const link = whatsappLink(row.phone, message);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "Mensagem copiada" });
      onLog(row.clientId, "sent");
    } catch {
      toast({ title: "Não consegui copiar", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-sm text-muted-foreground">{detail}</p>
        </div>
        {badge}
      </div>

      <p className="mt-3 rounded-xl bg-muted/60 p-3 text-sm text-foreground/90">{message}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="min-h-[44px]"
          disabled={!link}
          onClick={() => {
            if (!link) return;
            window.open(link, "_blank", "noopener,noreferrer");
            onLog(row.clientId, "sent");
          }}
        >
          <MessageCircle className="mr-2 h-4 w-4" />
          {link ? "Abrir WhatsApp" : "Sem telefone"}
        </Button>
        <Button size="sm" variant="outline" className="min-h-[44px]" onClick={copy}>
          <Copy className="mr-2 h-4 w-4" />
          Copiar texto
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-[44px]"
          onClick={() => onLog(row.clientId, "booked")}
        >
          Marcou horário
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="min-h-[44px]"
          onClick={() => onLog(row.clientId, "no_answer")}
        >
          Sem resposta
        </Button>
        {extraActions}
      </div>


      {logEntry ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {outcomeLabels[logEntry.outcome]} em {shortDate(logEntry.at)}
          <button
            type="button"
            className="underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={() => onClearLog(row.clientId)}
          >
            desfazer
          </button>
        </p>
      ) : null}
    </div>
  );
}

export default function Outreach() {
  const { currentTenant } = useTenant();
  const tenantId = currentTenant?.id ?? null;
  const businessName = currentTenant?.name ?? "nosso espaço";
  const { data, isLoading, refetch, isFetching } = useOutreach();

  const [log, setLog] = useState<Record<string, OutreachLogEntry>>({});
  const [search, setSearch] = useState("");
  const [incentive, setIncentive] = useState("");
  const [hideContacted, setHideContacted] = useState(true);
  const [couponPercent, setCouponPercent] = useState(15);
  const [couponsByClient, setCouponsByClient] = useState<Record<string, ReactivationCoupon>>({});
  const { toast: notify } = useToast();

  useEffect(() => {
    if (tenantId) setLog(readOutreachLog(tenantId));
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    let alive = true;
    void listCoupons(tenantId)
      .then((list) => {
        if (!alive) return;
        const map: Record<string, ReactivationCoupon> = {};
        for (const c of list) {
          if (c.status === "active" && !map[c.clientId]) map[c.clientId] = c;
        }
        setCouponsByClient(map);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tenantId]);

  const handleCoupon = async (clientId: string) => {
    if (!tenantId) return;
    try {
      const expires = new Date(Date.now() + 30 * 86400000).toISOString();
      const coupon = await createCoupon({
        tenantId,
        clientId,
        code: generateCouponCode(),
        label: `${couponPercent}% de desconto no retorno`,
        discountPercent: couponPercent,
        expiresAt: expires,
      });
      setCouponsByClient((m) => ({ ...m, [clientId]: coupon }));
      notify({ title: `Cupom ${coupon.code} criado`, description: "Ele já aparece no portal do cliente." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      notify({ title: "Não foi possível criar o cupom", description: msg, variant: "destructive" });
    }
  };

  const couponLine = (clientId: string): string => {
    const c = couponsByClient[clientId];
    if (!c) return "";
    const until = c.expiresAt
      ? ` (vale até ${new Date(c.expiresAt).toLocaleDateString("pt-BR")})`
      : "";
    return `\n\nSeu desconto: ${couponDescription(c)} com o código ${c.code}${until}.`;
  };

  const handleLog = (clientId: string, outcome: OutreachOutcome) => {
    if (!tenantId) return;
    setLog(logOutreach(tenantId, clientId, outcome));
  };
  const handleClearLog = (clientId: string) => {
    if (!tenantId) return;
    setLog(clearOutreachEntry(tenantId, clientId));
  };


  const filter = useCallback(
    <T extends OutreachClient>(rows: T[]): T[] => {
      const term = search.trim().toLowerCase();
      return rows.filter((row) => {
        if (term && !row.name.toLowerCase().includes(term)) return false;
        if (hideContacted && log[row.clientId]) return false;
        return true;
      });
    },
    [search, hideContacted, log],
  );

  const reminders = useMemo(() => filter(data?.reminders ?? []), [data, filter]);
  const reactivation = useMemo(() => filter(data?.reactivation ?? []), [data, filter]);

  const potential = reactivation.reduce((sum, row) => sum + row.averageTicketCents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Retorno e reativação"
        description="Quem está na hora de voltar e quem precisa de um convite. O texto sai pronto — você envia pelo WhatsApp."
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={isFetching ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Atualizar
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="rounded-2xl p-4">
          <p className="text-sm text-muted-foreground">Na hora de voltar</p>
          <p className="text-2xl font-semibold">{data?.reminders.length ?? 0}</p>
        </Card>
        <Card className="rounded-2xl p-4">
          <p className="text-sm text-muted-foreground">Para reativar</p>
          <p className="text-2xl font-semibold">{data?.reactivation.length ?? 0}</p>
        </Card>
        <Card className="rounded-2xl p-4">
          <p className="text-sm text-muted-foreground">Potencial se voltarem</p>
          <p className="text-2xl font-semibold">{money(potential)}</p>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar pelo nome"
          className="h-11 max-w-xs"
          aria-label="Buscar cliente"
        />
        <Button
          variant={hideContacted ? "default" : "outline"}
          className="min-h-[44px]"
          onClick={() => setHideContacted((value) => !value)}
        >
          {hideContacted ? "Ocultando já contatados" : "Mostrando todos"}
        </Button>
      </div>

      <Tabs defaultValue="reminders">
        <TabsList>
          <TabsTrigger value="reminders" data-testid="outreach-tab-reminders">
            <CalendarHeart className="mr-2 h-4 w-4" />
            Lembretes de retorno
          </TabsTrigger>
          <TabsTrigger value="reactivation" data-testid="outreach-tab-reactivation">
            <UserPlus className="mr-2 h-4 w-4" />
            Reativação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reminders" className="mt-4 space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : reminders.length === 0 ? (
            <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
              Ninguém na fila agora — todo mundo em dia ou já com horário marcado.
            </Card>
          ) : (
            reminders.map((row) => (
              <OutreachRow
                key={row.clientId}
                row={row}
                badge={
                  <StatusBadge tone={URGENCY_TONE[row.urgency]}>{URGENCY_LABEL[row.urgency]}</StatusBadge>
                }
                detail={`Última visita em ${shortDate(row.lastVisitAt)} · costuma voltar a cada ${row.averageIntervalDays} dias · ${row.visits} visita(s)`}
                message={returnReminderMessage(
                  row,
                  businessName,
                  row.lastServiceId ? data?.serviceNames[row.lastServiceId] : null,
                )}
                logEntry={log[row.clientId]}
                onLog={handleLog}
                onClearLog={handleClearLog}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="reactivation" className="mt-4 space-y-3">
          <Card className="rounded-2xl p-4">
            <label className="text-sm font-medium" htmlFor="incentive">
              <Sparkles className="mr-2 inline h-4 w-4 text-primary" />
              Frase de incentivo (opcional)
            </label>
            <Textarea
              id="incentive"
              value={incentive}
              onChange={(event) => setIncentive(event.target.value)}
              placeholder="Ex.: Nesta semana temos horários especiais para quem está voltando."
              className="mt-2"
              rows={2}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              O que você escrever aqui entra no fim de todas as mensagens de reativação.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs font-medium" htmlFor="coupon-percent">
                  Desconto do cupom (%)
                </label>
                <Input
                  id="coupon-percent"
                  type="number"
                  min={1}
                  max={90}
                  value={couponPercent}
                  onChange={(e) =>
                    setCouponPercent(Math.min(90, Math.max(1, Number(e.target.value) || 1)))
                  }
                  className="mt-1 h-11 w-32"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O cupom vale 30 dias e aparece no portal do cliente.
              </p>
            </div>
          </Card>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : reactivation.length === 0 ? (
            <Card className="rounded-2xl p-6 text-sm text-muted-foreground">
              Nenhum cliente parado no momento. Ótimo sinal.
            </Card>
          ) : (
            reactivation.map((row) => (
              <OutreachRow
                key={row.clientId}
                row={row}
                badge={
                  <StatusBadge tone={row.segment === "lost" ? "danger" : "warning"}>
                    {SEGMENT_LABEL[row.segment]}
                  </StatusBadge>
                }
                detail={`${row.daysSinceLastVisit} dias sem vir · já deixou ${money(row.revenueCents)} · ticket médio ${money(row.averageTicketCents)}`}
                message={`${reactivationMessage(row, businessName, incentive)}${couponLine(row.clientId)}`}
                logEntry={log[row.clientId]}
                extraActions={
                  couponsByClient[row.clientId] ? (
                    <StatusBadge tone="success">
                      Cupom {couponsByClient[row.clientId].code}
                    </StatusBadge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => void handleCoupon(row.clientId)}
                    >
                      <Ticket className="mr-2 h-4 w-4" />
                      Gerar cupom
                    </Button>
                  )
                }
                onLog={handleLog}
                onClearLog={handleClearLog}
              />
            ))

          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
