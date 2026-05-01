/**
 * QueueItemCard — cartão de um item da fila de confirmação.
 * Exibe cliente, agendamento e ações rápidas (abrir contato).
 */
import { Phone, MessageCircle, Mail, Clock, CalendarClock, AlertTriangle, Crown, ExternalLink, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import {
  queueStatusLabels,
  queueStatusTone,
} from "@/domain/confirmation";
import type { QueueItemHydrated } from "@/repositories/confirmation";

const toneMap = {
  default: "neutral",
  success: "success",
  warning: "warning",
  destructive: "danger",
  info: "info",
  muted: "neutral",
} as const;

interface QueueItemCardProps {
  item: QueueItemHydrated;
  onOpen: (item: QueueItemHydrated) => void;
  onConfirmQuick?: (item: QueueItemHydrated) => void;
}

function formatStarts(iso: string): { date: string; time: string; relative: string } {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (d.getTime() - now.getTime()) / 36e5;
  let relative = "";
  if (diffH < 0) relative = "atrasado";
  else if (diffH < 1) relative = `em ${Math.round(diffH * 60)} min`;
  else if (diffH < 24) relative = `em ${Math.round(diffH)}h`;
  else relative = `em ${Math.round(diffH / 24)}d`;
  return {
    date: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    time: d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    relative,
  };
}

interface SelectionContext {
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
}

export function QueueItemCard({ 
  item, 
  onOpen, 
  onConfirmQuick, 
  selection 
}: QueueItemCardProps & { selection?: SelectionContext }) {
  const t = formatStarts(item.appointmentStartsAt);

  const tone = toneMap[queueStatusTone(item.status)];

  const phoneDigits = item.clientWhatsapp ? item.clientWhatsapp.replace(/\D/g, "") : null;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
      className="cursor-pointer p-4 transition hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-foreground">
              {item.clientName}
            </h3>
            {item.clientIsVip && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                <Crown className="h-3 w-3" /> VIP
              </span>
            )}
            {item.clientRiskLevel === "high" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                <AlertTriangle className="h-3 w-3" /> Alto risco
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {item.serviceName ?? "Serviço"} • {item.professionalName ?? "Sem profissional"}
          </p>
        </div>
        <div className="text-right">
          <StatusBadge tone={tone}>{queueStatusLabels[item.status]}</StatusBadge>
          <div className="mt-1 text-xs text-muted-foreground">prio. {item.priority}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground border-b border-border/40 pb-3">
        <span className="inline-flex items-center gap-1.5">
          <CalendarClock className="h-4 w-4" />
          {t.date} • {t.time}
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-primary">
          <Clock className="h-4 w-4" />
          {t.relative}
        </span>
        {item.attemptsCount > 0 && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
            {item.attemptsCount} tentativa{item.attemptsCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1 rounded-xl h-10 md:flex-none"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(item);
          }}
        >
          <MessageCircle className="mr-1.5 h-4 w-4" /> Ações
        </Button>
        
        {phoneDigits && (
          <Button
            size="sm"
            variant="outline"
            className="flex-1 rounded-xl h-10 border-success/30 text-success hover:bg-success/5 md:flex-none"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://wa.me/${phoneDigits}`, "_blank", "noopener,noreferrer");
            }}
          >
            <ExternalLink className="mr-1.5 h-4 w-4" /> WhatsApp
          </Button>
        )}

        {onConfirmQuick && (
          <Button
            size="sm"
            variant="default"
            className="flex-1 rounded-xl h-10 bg-success hover:bg-success/90 text-success-foreground md:flex-none"
            onClick={(e) => {
              e.stopPropagation();
              onConfirmQuick(item);
            }}
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmar
          </Button>
        )}
      </div>
    </Card>
  );
}

