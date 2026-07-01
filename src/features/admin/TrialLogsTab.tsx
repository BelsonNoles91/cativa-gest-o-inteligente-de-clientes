/**
 * TrialLogsTab — painel SuperAdmin para acompanhar tentativas de
 * ativação de trial (RPC `start_default_trial`).
 *
 * Mostra status (sucesso / já existia / falha), motivo categorizado
 * (rls_denied, no_plan, unauthenticated, unknown), tenant + ator,
 * mensagem de erro original e ação recomendada. Filtros por status
 * e por tenant. Visível apenas para owner/manager/super_admin
 * (RLS no audit_logs já protege a leitura).
 */
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Filter,
  Loader2,
  RefreshCcw,
  ShieldOff,
  Sparkles,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge, type StatusTone } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  listTrialActivationLogs,
  type TenantWithSub,
  type TrialActivationLog,
  type TrialLogReason,
  type TrialLogStatus,
} from "@/repositories/billing";

const STATUS_LABELS: Record<TrialLogStatus, string> = {
  success: "Sucesso",
  already_existed: "Já existia",
  failure: "Falha",
};

const STATUS_TONES: Record<TrialLogStatus, StatusTone> = {
  success: "success",
  already_existed: "neutral",
  failure: "danger",
};

const REASON_LABELS: Record<NonNullable<TrialLogReason>, string> = {
  rls_denied: "Bloqueado por RLS",
  no_plan: "Plano padrão ausente",
  unauthenticated: "Sessão expirada",
  unknown: "Erro inesperado",
};

const REASON_HINTS: Record<NonNullable<TrialLogReason>, string> = {
  rls_denied:
    "Garanta que o usuário tenha papel owner ou manager neste tenant — ou seja super_admin.",
  no_plan:
    "Configure ao menos um plano com is_default=true e status=public na aba Planos.",
  unauthenticated:
    "Peça ao usuário para sair e entrar novamente. Tokens podem ter expirado.",
  unknown:
    "Veja a mensagem de erro original abaixo para investigar a causa.",
};

const REASON_ICONS: Record<NonNullable<TrialLogReason>, typeof ShieldOff> = {
  rls_denied: ShieldOff,
  no_plan: CircleSlash,
  unauthenticated: User,
  unknown: AlertTriangle,
};

export function TrialLogsTab({ tenants }: { tenants: TenantWithSub[] }) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<TrialActivationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TrialLogStatus | "all">("all");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const rows = await listTrialActivationLogs({
        status: statusFilter,
        tenantId: tenantFilter === "all" ? null : tenantFilter,
        limit: 200,
      });
      setLogs(rows);
    } catch (error) {
      toast({
        title: "Erro ao carregar logs",
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, tenantFilter]);

  const stats = useMemo(() => {
    const total = logs.length;
    const failures = logs.filter((l) => l.status === "failure").length;
    const successes = logs.filter((l) => l.status === "success").length;
    const failureRate = total > 0 ? Math.round((failures / total) * 100) : 0;
    const failuresByReason = logs
      .filter((l) => l.status === "failure")
      .reduce<Record<string, number>>((acc, l) => {
        const key = l.reason ?? "unknown";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
    return { total, failures, successes, failureRate, failuresByReason };
  }, [logs]);

  return (
    <div className="space-y-4" data-testid="trial-logs-tab">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as TrialLogStatus | "all")}
        >
          <SelectTrigger className="w-full min-w-0 sm:w-[170px]" data-testid="trial-logs-status-filter">
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="failure">Apenas falhas</SelectItem>
            <SelectItem value="success">Apenas sucessos</SelectItem>
            <SelectItem value="already_existed">Já existia</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tenantFilter} onValueChange={setTenantFilter}>
          <SelectTrigger className="w-full min-w-0 sm:w-[220px]" data-testid="trial-logs-tenant-filter">
            <Building2 className="mr-1.5 h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tenants</SelectItem>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void reload()}
          disabled={loading}
          data-testid="trial-logs-refresh"
        >
          {loading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Atualizar
        </Button>

        <div className="ml-auto flex flex-wrap gap-2 text-xs">
          <SummaryChip
            tone="success"
            icon={<CheckCircle2 className="h-3 w-3" />}
            label={`${stats.successes} sucessos`}
          />
          <SummaryChip
            tone="destructive"
            icon={<AlertTriangle className="h-3 w-3" />}
            label={`${stats.failures} falhas (${stats.failureRate}%)`}
          />
          {Object.entries(stats.failuresByReason).map(([reason, count]) => (
            <SummaryChip
              key={reason}
              tone="warning"
              label={`${REASON_LABELS[reason as NonNullable<TrialLogReason>] ?? reason}: ${count}`}
            />
          ))}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div
          className="flex h-40 items-center justify-center"
          data-testid="trial-logs-loading"
        >
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : logs.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Nenhuma tentativa registrada"
          description="Quando alguém ativar (ou tentar ativar) o trial, os eventos aparecem aqui."
        />
      ) : (
        <div className="surface-card overflow-hidden" data-testid="trial-logs-list">
          <ul className="divide-y divide-border/60">
            {logs.map((log) => {
              const isOpen = expanded === log.id;
              const ReasonIcon =
                log.status === "failure" && log.reason
                  ? REASON_ICONS[log.reason]
                  : log.status === "success"
                    ? CheckCircle2
                    : Sparkles;
              return (
                <li key={log.id} data-testid="trial-log-row" data-status={log.status}>
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                    className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/30"
                    aria-expanded={isOpen}
                  >
                    <div
                      className={cn(
                        "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                        log.status === "failure"
                          ? "bg-destructive/10 text-destructive"
                          : log.status === "success"
                            ? "bg-success/10 text-success-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      <ReasonIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={STATUS_TONES[log.status]}>
                          {STATUS_LABELS[log.status]}
                        </StatusBadge>
                        {log.status === "failure" && log.reason && (
                          <span className="text-xs font-medium text-destructive">
                            {REASON_LABELS[log.reason]}
                          </span>
                        )}
                        {log.errorCode && (
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {log.errorCode}
                          </code>
                        )}
                      </div>
                      <p className="truncate text-sm font-medium">
                        {log.tenantName ?? "(tenant desconhecido)"}
                        {log.tenantSlug && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                            · {log.tenantSlug}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {log.actorName ?? log.actorId ?? "(usuário desconhecido)"}
                        {" · "}
                        {formatWhen(log.createdAt)}
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-90",
                      )}
                    />
                  </button>

                  {isOpen && (
                    <div
                      className="space-y-3 border-t border-border/40 bg-muted/20 px-4 py-4 text-xs"
                      data-testid="trial-log-details"
                    >
                      {log.errorMessage && (
                        <Field label="Mensagem original">
                          <code className="block whitespace-pre-wrap rounded-md bg-background p-2 text-[11px] text-destructive">
                            {log.errorMessage}
                          </code>
                        </Field>
                      )}
                      {log.recommendedAction && (
                        <Field label="Ação recomendada">
                          <p className="rounded-md border border-primary/30 bg-primary/5 p-2 text-[11px] leading-relaxed">
                            {log.recommendedAction}
                          </p>
                        </Field>
                      )}
                      {log.status === "failure" && log.reason && (
                        <Field label="Como resolver">
                          <p className="leading-relaxed text-muted-foreground">
                            {REASON_HINTS[log.reason]}
                          </p>
                        </Field>
                      )}
                      <Field label="Metadata">
                        <pre className="overflow-x-auto rounded-md bg-background p-2 text-[10px] text-muted-foreground">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </Field>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function SummaryChip({
  label,
  icon,
  tone,
}: {
  label: string;
  icon?: React.ReactNode;
  tone: "success" | "destructive" | "warning";
}) {
  const toneClass =
    tone === "success"
      ? "border-success/40 bg-success/10 text-success-foreground"
      : tone === "destructive"
        ? "border-destructive/40 bg-destructive/10 text-destructive"
        : "border-warning/40 bg-warning/10 text-warning-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        toneClass,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
