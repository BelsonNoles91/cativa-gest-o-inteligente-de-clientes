/**
 * AuditLogsTab — auditoria global navegável (super admin vê tudo, owner/manager vê apenas seu tenant).
 */
import { useEffect, useMemo, useState } from "react";
import { 
  CalendarRange, 
  Filter, 
  Loader2, 
  RefreshCcw, 
  ScrollText, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";

type AuditRow = {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  total_count?: number;
};

const ACTION_PREFIXES = [
  { label: "Todas", value: "all" },
  { label: "admin.*", value: "admin." },
  { label: "admin.membership.*", value: "admin.membership." },
  { label: "admin.super_admin.*", value: "admin.super_admin." },
  { label: "admin.tenant.*", value: "admin.tenant." },
  { label: "subscription.*", value: "subscription." },
  { label: "team.*", value: "team." },
  { label: "onboarding.*", value: "onboarding." },
];

export function AuditLogsTab({
  tenants = [],
}: {
  tenants?: Array<{ id: string; name: string }>;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState<string>("50");
  const [page, setPage] = useState(0);
  const [cursors, setCursors] = useState<Array<{ id: string; timestamp: string } | null>>([null]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [periodPreset, setPeriodPreset] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [totalCount, setTotalCount] = useState(0);

  const isSuperAdmin = user?.role === 'super_admin';

  function resolveRange(): { from: string | null; to: string | null } {
    if (periodPreset === "custom") {
      return {
        from: fromDate ? new Date(fromDate + "T00:00:00").toISOString() : null,
        to: toDate ? new Date(toDate + "T23:59:59").toISOString() : null,
      };
    }
    if (periodPreset === "all") return { from: null, to: null };
    const days = parseInt(periodPreset, 10);
    if (!Number.isFinite(days)) return { from: null, to: null };
    const from = new Date();
    from.setDate(from.getDate() - days);
    return { from: from.toISOString(), to: null };
  }

  async function load() {
    setLoading(true);
    try {
      const range = resolveRange();
      const currentLimit = parseInt(limit, 10);
      const cursor = cursors[page];
      
      const { data, error } = await supabase.rpc("get_audit_logs_advanced", {
        _tenant_id: tenantFilter === "all" ? null : tenantFilter,
        _action_prefix: actionFilter === "all" ? null : actionFilter,
        _from: range.from,
        _to: range.to,
        _limit: currentLimit,
        _cursor_id: cursor?.id ?? null,
        _cursor_timestamp: cursor?.timestamp ?? null,
        _sort_order: sortOrder
      });

      if (error) throw error;
      
      const results = (data ?? []) as AuditRow[];
      setRows(results);
      setTotalCount(Number(results[0]?.total_count ?? 0));
    } catch (err) {
      toast({
        title: "Erro ao carregar auditoria",
        description: String(err instanceof Error ? err.message : err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(0);
    setCursors([null]);
  }, [tenantFilter, actionFilter, limit, periodPreset, fromDate, toDate, sortOrder]);

  useEffect(() => {
    void load();
  }, [tenantFilter, actionFilter, limit, periodPreset, fromDate, toDate, page, sortOrder]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.action.toLowerCase().includes(q) ||
        (r.actor_name ?? "").toLowerCase().includes(q) ||
        (r.actor_email ?? "").toLowerCase().includes(q) ||
        (r.tenant_name ?? "").toLowerCase().includes(q) ||
        (r.entity ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totalPages = Math.ceil(totalCount / parseInt(limit, 10));

  return (
    <div className="space-y-4">
      {/* Filtros Avançados */}
      <div className="surface-card sticky top-0 z-10 space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar nesta página..."
              className="pl-9"
            />
          </div>
          <Button 
            size="sm" 
            variant="outline" 
            onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
          >
            <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
            {sortOrder === "asc" ? "Antigos primeiro" : "Recentes primeiro"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Sincronizar
          </Button>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {isSuperAdmin && (
            <div>
              <Label className="text-[11px] text-muted-foreground font-semibold uppercase">Tenant</Label>
              <Select value={tenantFilter} onValueChange={(v) => { setTenantFilter(v); setPage(0); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tenants</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className={isSuperAdmin ? "" : "sm:col-span-2"}>
            <Label className="text-[11px] text-muted-foreground font-semibold uppercase">Módulo / Ação</Label>
            <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTION_PREFIXES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground font-semibold uppercase">Registros p/ página</Label>
            <Select value={limit} onValueChange={(v) => { setLimit(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["25", "50", "100", "200"].map((n) => (
                  <SelectItem key={n} value={n}>{n} registros</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold uppercase">
              <CalendarRange className="h-3 w-3" /> Período
            </Label>
            <Select value={periodPreset} onValueChange={(v) => { setPeriodPreset(v); setPage(0); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o histórico</SelectItem>
                <SelectItem value="1">Últimas 24h</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="custom">Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {periodPreset === "custom" && (
            <>
              <div>
                <Label className="text-[11px] text-muted-foreground">Início</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div>
                <Label className="text-[11px] text-muted-foreground">Fim</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border/50 pt-2 mt-2">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Filter className="h-3 w-3" />
            Mostrando {filtered.length} de {totalCount} eventos
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-7 w-7" 
              disabled={page === 0 || loading}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[11px] font-medium">
              Pág. {page + 1} de {totalPages || 1}
            </span>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-7 w-7" 
              disabled={page >= totalPages - 1 || loading}
              onClick={() => {
                const lastRow = rows[rows.length - 1];
                if (lastRow) {
                  setCursors(prev => {
                    const next = [...prev];
                    next[page + 1] = { id: lastRow.id, timestamp: lastRow.created_at };
                    return next;
                  });
                  setPage(p => p + 1);
                }
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Lista de Eventos */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-8 w-8" />}
          title="Nenhum evento encontrado"
          description="Tente ajustar os filtros ou o período de busca."
        />
      ) : (
        <ul className="space-y-3">
          {filtered.map((row) => {
            const isOpen = expanded === row.id;
            return (
              <li
                key={row.id}
                className={`surface-card overflow-hidden transition-all duration-200 border border-transparent ${isOpen ? "ring-1 ring-primary/30 border-primary/20 shadow-lg" : "hover:border-border/60 hover:shadow-sm"}`}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                  className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center sm:gap-4"
                >
                  <div className="flex flex-wrap items-center gap-2 sm:w-48">
                    <StatusBadge tone={toneFromAction(row.action)} className="font-mono text-[10px] uppercase">
                      {row.action}
                    </StatusBadge>
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="truncate text-sm font-semibold">
                        {row.actor_name ?? "Sistema"}
                      </p>
                      {row.tenant_name && isSuperAdmin && (
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
                          {row.tenant_name}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {row.entity && (
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <span className="font-medium text-foreground/70">{row.entity}:</span>
                          <span className="font-mono">{row.entity_id ? row.entity_id.slice(0, 8) : "—"}</span>
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDateTime(row.created_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border/40 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="p-4 space-y-4">
                      {/* Resumo e Links */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-muted-foreground uppercase">Ator</p>
                          <p className="text-xs">{row.actor_email || "Sistema Automático"}</p>
                        </div>
                        {row.entity_id && (
                          <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1.5" asChild>
                            <a href={`/app/${row.entity}s?id=${row.entity_id}`} target="_blank" rel="noreferrer">
                              <ExternalLink className="h-3 w-3" />
                              Ver recurso afetado
                            </a>
                          </Button>
                        )}
                      </div>

                      {/* Diferencial Visual */}
                      {row.metadata && renderBeforeAfter(row.metadata)}

                      {/* JSON Completo */}
                      <div className="space-y-2">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase">Payload Completo</p>
                        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-[11px] font-mono text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
                          {JSON.stringify(row.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function toneFromAction(action: string) {
  if (action.includes("revoked") || action.includes("suspended") || action.includes("canceled") || action.includes("deleted") || action.includes("error")) {
    return "danger" as const;
  }
  if (action.includes("granted") || action.includes("started") || action.includes("created") || action.includes("success")) {
    return "success" as const;
  }
  if (action.includes("changed") || action.includes("updated") || action.includes("modified")) {
    return "warning" as const;
  }
  return "brand" as const;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function renderBeforeAfter(metadata: Record<string, unknown>) {
  const before = metadata.before as Record<string, unknown> | undefined;
  const after = metadata.after as Record<string, unknown> | undefined;

  if (!before && !after) return null;

  const keys = Array.from(
    new Set([...(before ? Object.keys(before) : []), ...(after ? Object.keys(after) : [])]),
  ).filter(k => k !== 'updated_at');

  if (keys.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-muted-foreground uppercase">Comparativo de Mudanças</p>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-background/50">
        <div className="grid grid-cols-3 bg-muted/50 p-2 text-[10px] font-bold uppercase text-muted-foreground border-b border-border/40">
          <div>Atributo</div>
          <div>Anterior</div>
          <div>Novo Valor</div>
        </div>
        <div className="divide-y divide-border/30">
          {keys.map((k) => {
            const b = before?.[k];
            const a = after?.[k];
            const changed = JSON.stringify(b) !== JSON.stringify(a);
            if (!changed && keys.length > 5) return null; // Esconder campos não alterados se forem muitos

            return (
              <div key={k} className={`grid grid-cols-3 p-2 text-[11px] font-mono items-center ${changed ? "bg-warning/5" : ""}`}>
                <div className="font-semibold text-foreground/70 truncate mr-2" title={k}>{k}</div>
                <div className="text-destructive/70 line-through truncate mr-2" title={formatVal(b)}>{formatVal(b)}</div>
                <div className="text-success font-medium truncate" title={formatVal(a)}>{formatVal(a)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

