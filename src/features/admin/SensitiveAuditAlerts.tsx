/**
 * SensitiveAuditAlerts — sino de notificações em tempo real para o super admin.
 *
 * Escuta INSERTs em `audit_logs` via Supabase Realtime, filtra ações sensíveis
 * (mudanças de role/status, super_admin toggle, criação/cancelamento de
 * memberships e alterações de feature flags), exibe diff antes/depois e
 * permite navegar direto para a aba/registro relevante no painel.
 *
 * Persistência local: `localStorage` guarda o último timestamp visto, evitando
 * marcar alertas antigos como "novos" ao recarregar a página.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ExternalLink, ShieldAlert, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { EmptyState } from "@/components/feedback/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SENSITIVE_PREFIXES = [
  "admin.membership.role",
  "admin.membership.status",
  "admin.super_admin",
  "admin.client_membership.granted",
  "admin.client_membership.canceled",
  "admin.client_membership.reactivated",
  "admin.feature_flag",
  "admin.plan.limits",
  "admin.subscription.overrides",
] as const;

const TAB_BY_ACTION: Array<{ match: string; tab: string; label: string }> = [
  { match: "admin.membership.", tab: "members", label: "Membros" },
  { match: "admin.super_admin", tab: "members", label: "Membros" },
  { match: "admin.client_membership.", tab: "client-memberships", label: "Memberships" },
  { match: "admin.feature_flag", tab: "console", label: "Console" },
  { match: "admin.plan.limits", tab: "console", label: "Console" },
  { match: "admin.subscription.overrides", tab: "tenants", label: "Tenants" },
];

const STORAGE_KEY = "super_admin.audit_alerts.last_seen";

type SensitiveAlert = {
  id: string;
  action: string;
  actor_id: string | null;
  tenant_id: string | null;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Props = {
  /** Callback invocado quando o usuário clica em "ir ao registro". */
  onNavigate?: (tab: string) => void;
  /** Mapa opcional tenantId → nome para exibir no alerta. */
  tenantNames?: Record<string, string>;
};

export function SensitiveAuditAlerts({ onNavigate, tenantNames = {} }: Props) {
  const [alerts, setAlerts] = useState<SensitiveAlert[]>([]);
  const [open, setOpen] = useState(false);
  const lastSeenRef = useRef<string>(
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) ?? "" : "",
  );

  const unreadCount = useMemo(
    () => alerts.filter((a) => a.created_at > lastSeenRef.current).length,
    // depende também de `open` para recalcular ao marcar como lido
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alerts, open],
  );

  // Carga inicial — últimos 50 registros sensíveis
  const loadInitial = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, actor_id, tenant_id, entity, entity_id, metadata, created_at")
        .or(SENSITIVE_PREFIXES.map((p) => `action.ilike.${p}%`).join(","))
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setAlerts((data ?? []) as SensitiveAlert[]);
    } catch (err) {
      console.error("[SensitiveAuditAlerts] erro ao carregar", err);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("super-admin-audit-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        (payload) => {
          const row = payload.new as SensitiveAlert;
          if (!isSensitive(row.action)) return;
          setAlerts((prev) => [row, ...prev].slice(0, 50));
          // Toast leve para chamar atenção
          toast(formatActionLabel(row.action), {
            description: describeAlert(row, tenantNames),
            icon: <ShieldAlert className="h-4 w-4 text-warning" />,
            action: {
              label: "Ver",
              onClick: () => setOpen(true),
            },
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tenantNames]);

  function markAllRead() {
    if (alerts.length === 0) return;
    const newest = alerts[0].created_at;
    lastSeenRef.current = newest;
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, newest);
    }
    // força re-render do badge
    setAlerts((prev) => [...prev]);
  }

  function handleNavigate(alert: SensitiveAlert) {
    const target = TAB_BY_ACTION.find((t) => alert.action.startsWith(t.match));
    if (target && onNavigate) {
      onNavigate(target.tab);
      setOpen(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) markAllRead();
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative gap-1.5"
          aria-label={`Alertas sensíveis${unreadCount > 0 ? ` (${unreadCount} novos)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          <span className="hidden sm:inline">Alertas</span>
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              aria-hidden="true"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/60 px-4 py-3 sm:px-6">
          <SheetTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            Alertas de mudanças sensíveis
          </SheetTitle>
          <SheetDescription>
            Monitora roles, status, super admin, memberships e feature flags em tempo real.
          </SheetDescription>
        </SheetHeader>

        {alerts.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6">
            <EmptyState
              icon={<Bell className="h-6 w-6" />}
              title="Nenhum alerta"
              description="Mudanças sensíveis aparecerão aqui assim que ocorrerem."
            />
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <ul className="divide-y divide-border/60">
              {alerts.map((alert) => {
                const isUnread = alert.created_at > lastSeenRef.current;
                const target = TAB_BY_ACTION.find((t) => alert.action.startsWith(t.match));
                return (
                  <li
                    key={alert.id}
                    className={`space-y-2 px-4 py-3 sm:px-6 ${isUnread ? "bg-warning/5" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge tone={toneFromAction(alert.action)}>
                            {formatActionLabel(alert.action)}
                          </StatusBadge>
                          {isUnread && (
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-destructive" />
                          )}
                        </div>
                        <p className="text-sm">{describeAlert(alert, tenantNames)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatDateTime(alert.created_at)}
                        </p>
                      </div>
                    </div>

                    {/* Diff antes/depois */}
                    {renderDiff(alert.metadata)}

                    {target && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 gap-1.5 px-2 text-xs"
                        onClick={() => handleNavigate(alert)}
                      >
                        <ExternalLink className="h-3 w-3" />
                        Ir para {target.label}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/60 px-4 py-2 sm:px-6">
          <span className="text-[11px] text-muted-foreground">
            {alerts.length} {alerts.length === 1 ? "alerta" : "alertas"} recente(s)
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setOpen(false)}
          >
            <X className="h-3 w-3" />
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------- helpers ----------

function isSensitive(action: string) {
  return SENSITIVE_PREFIXES.some((p) => action.startsWith(p));
}

function formatActionLabel(action: string): string {
  const map: Record<string, string> = {
    "admin.membership.role_changed": "Role alterado",
    "admin.membership.status_changed": "Status alterado",
    "admin.super_admin.granted": "Super admin concedido",
    "admin.super_admin.revoked": "Super admin revogado",
    "admin.client_membership.granted": "Membership criada",
    "admin.client_membership.canceled": "Membership cancelada",
    "admin.client_membership.reactivated": "Membership reativada",
    "admin.feature_flag.upserted": "Feature flag alterada",
    "admin.feature_flag.toggled": "Feature flag toggled",
    "admin.feature_flag.deleted": "Feature flag removida",
    "admin.plan.limits_updated": "Limites de plano alterados",
    "admin.subscription.overrides_updated": "Overrides de assinatura",
  };
  return map[action] ?? action;
}

function describeAlert(
  alert: SensitiveAlert,
  tenantNames: Record<string, string>,
): string {
  const meta = alert.metadata ?? {};
  const tenantName = alert.tenant_id ? tenantNames[alert.tenant_id] ?? "Tenant" : "Global";
  const target =
    (meta.target_email as string) ||
    (meta.target_name as string) ||
    (meta.flag_key as string) ||
    (meta.client_name as string) ||
    alert.entity_id?.slice(0, 8) ||
    "—";
  return `${tenantName} · ${target}`;
}

function renderDiff(metadata: Record<string, unknown> | null) {
  if (!metadata) return null;
  const before = metadata.before as Record<string, unknown> | undefined;
  const after = metadata.after as Record<string, unknown> | undefined;
  if (!before && !after) return null;

  const keys = Array.from(
    new Set([
      ...(before ? Object.keys(before) : []),
      ...(after ? Object.keys(after) : []),
    ]),
  );
  if (keys.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-md border border-border/60 bg-muted/30 text-[11px]">
      {keys.map((k) => {
        const b = before?.[k];
        const a = after?.[k];
        const changed = JSON.stringify(b) !== JSON.stringify(a);
        if (!changed) return null;
        return (
          <div key={k} className="grid grid-cols-[80px_1fr] gap-2 border-b border-border/40 px-2 py-1 last:border-b-0">
            <span className="font-mono text-muted-foreground">{k}</span>
            <span className="font-mono">
              <span className="text-destructive/80 line-through">{formatVal(b)}</span>
              {" → "}
              <span className="text-success">{formatVal(a)}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (typeof v === "number") return String(v);
  return JSON.stringify(v);
}

function toneFromAction(action: string) {
  if (action.includes("revoked") || action.includes("canceled") || action.includes("suspended") || action.includes("deleted")) {
    return "danger" as const;
  }
  if (action.includes("granted") || action.includes("reactivated")) {
    return "success" as const;
  }
  if (action.includes("changed") || action.includes("updated") || action.includes("toggled") || action.includes("upserted")) {
    return "warning" as const;
  }
  return "brand" as const;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
