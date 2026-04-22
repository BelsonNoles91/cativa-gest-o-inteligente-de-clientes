/**
 * AuditLogsTab — auditoria global navegável (somente super admin).
 *
 * Fonte: RPC `admin_list_audit_logs(_tenant_id, _actor_id, _action_prefix, _from, _to, _limit)`.
 * Filtros: tenant, prefixo de ação, intervalo de datas, limite.
 * UX: lista densa em cards, expansível para ver metadata em JSON.
 */
import { useEffect, useMemo, useState } from "react";
import { Filter, Loader2, RefreshCcw, ScrollText, Search } from "lucide-react";
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
};

const ACTION_PREFIXES = [
  { label: "Todas", value: "all" },
  { label: "admin.*", value: "admin." },
  { label: "admin.membership.*", value: "admin.membership." },
  { label: "admin.super_admin.*", value: "admin.super_admin." },
  { label: "admin.impersonation.*", value: "admin.impersonation." },
  { label: "admin.tenant.*", value: "admin.tenant." },
  { label: "subscription.*", value: "subscription." },
  { label: "team.*", value: "team." },
];

export function AuditLogsTab({
  tenants,
}: {
  tenants: Array<{ id: string; name: string }>;
}) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState<string>("200");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("admin_list_audit_logs", {
        _tenant_id: tenantFilter === "all" ? null : tenantFilter,
        _actor_id: null,
        _action_prefix: actionFilter === "all" ? null : actionFilter,
        _from: null,
        _to: null,
        _limit: Math.max(1, Math.min(parseInt(limit, 10) || 200, 1000)),
      });
      if (error) throw error;
      setRows((data ?? []) as AuditRow[]);
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
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantFilter, actionFilter, limit]);

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

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="surface-card sticky top-0 z-10 space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por ação, ator, tenant..."
              className="pl-9"
            />
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCcw className={`mr-1.5 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Recarregar
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div>
            <Label className="text-[11px] text-muted-foreground">Tenant</Label>
            <Select value={tenantFilter} onValueChange={setTenantFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tenants</SelectItem>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Ação</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACTION_PREFIXES.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Limite</Label>
            <Select value={limit} onValueChange={setLimit}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["50", "100", "200", "500", "1000"].map((n) => (
                  <SelectItem key={n} value={n}>{n} registros</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Filter className="h-3 w-3" />
          {filtered.length} {filtered.length === 1 ? "registro" : "registros"} exibido(s)
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-6 w-6" />}
          title="Nenhum registro"
          description="Ajuste os filtros para ver outras ações administrativas."
        />
      ) : (
        <ul className="space-y-2">
          {filtered.map((row) => {
            const isOpen = expanded === row.id;
            return (
              <li
                key={row.id}
                className="surface-card overflow-hidden transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : row.id)}
                  className="flex w-full flex-col gap-2 p-3 text-left sm:flex-row sm:items-center sm:gap-3 sm:p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge tone={toneFromAction(row.action)}>{row.action}</StatusBadge>
                    {row.tenant_name && (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                        {row.tenant_name}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      <span className="font-medium">{row.actor_name ?? "Sistema"}</span>
                      {row.actor_email && (
                        <span className="text-muted-foreground"> · {row.actor_email}</span>
                      )}
                    </p>
                    {row.entity && (
                      <p className="truncate text-[11px] text-muted-foreground">
                        {row.entity}
                        {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}…` : ""}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDateTime(row.created_at)}
                  </span>
                </button>
                {isOpen && row.metadata && Object.keys(row.metadata).length > 0 && (
                  <div className="border-t border-border/60 bg-muted/30 p-3 sm:p-4">
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background/80 p-3 text-[11px] leading-relaxed">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
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
  if (action.includes("revoked") || action.includes("suspended") || action.includes("canceled")) {
    return "danger" as const;
  }
  if (action.includes("granted") || action.includes("started") || action.includes("created")) {
    return "success" as const;
  }
  if (action.includes("changed") || action.includes("updated")) {
    return "warning" as const;
  }
  return "brand" as const;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
