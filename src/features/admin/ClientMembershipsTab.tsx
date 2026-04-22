/**
 * ClientMembershipsTab — gestão mobile-first de **memberships de clientes**
 * (planos recorrentes do salão/clínica) por tenant, restrito ao Super Admin.
 *
 * Operações:
 * - Listar memberships ativas/canceladas em qualquer tenant
 * - Conceder uma membership a um cliente (com ciclo + saldos automáticos)
 * - Cancelar / reativar memberships existentes
 *
 * Tudo passa por RPCs `SECURITY DEFINER` com auditoria em `audit_logs`.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CalendarDays,
  CircleSlash,
  Filter,
  Gift,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Search,
  UserRound,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge, type StatusTone } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type SubscriptionStatus = "active" | "paused" | "canceled" | "expired";

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Ativa",
  paused: "Pausada",
  canceled: "Cancelada",
  expired: "Expirada",
};

const STATUS_TONES: Record<SubscriptionStatus, StatusTone> = {
  active: "success",
  paused: "warning",
  canceled: "danger",
  expired: "neutral",
};

interface TenantOption {
  id: string;
  name: string;
}

interface MembershipRow {
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  membershipId: string;
  membershipName: string;
  billingCycle: string;
  priceCents: number;
  status: SubscriptionStatus;
  startedAt: string;
  currentCycleStart: string;
  currentCycleEnd: string | null;
  canceledAt: string | null;
  notes: string | null;
  totalSessions: number;
  usedSessions: number;
}

interface DashboardSnapshot {
  clients: Array<{ id: string; full_name: string; email: string | null }>;
  memberships: Array<{ id: string; name: string; billing_cycle: string; price_cents: number; is_active: boolean }>;
}

function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function rowToMembership(r: Record<string, unknown>): MembershipRow {
  return {
    subscriptionId: r.subscription_id as string,
    tenantId: r.tenant_id as string,
    clientId: r.client_id as string,
    clientName: (r.client_name as string) ?? "—",
    clientEmail: (r.client_email as string) ?? null,
    membershipId: r.membership_id as string,
    membershipName: (r.membership_name as string) ?? "—",
    billingCycle: (r.billing_cycle as string) ?? "monthly",
    priceCents: Number(r.price_cents ?? 0),
    status: (r.status as SubscriptionStatus) ?? "active",
    startedAt: r.started_at as string,
    currentCycleStart: r.current_cycle_start as string,
    currentCycleEnd: (r.current_cycle_end as string) ?? null,
    canceledAt: (r.canceled_at as string) ?? null,
    notes: (r.notes as string) ?? null,
    totalSessions: Number(r.total_sessions_total ?? 0),
    usedSessions: Number(r.total_sessions_used ?? 0),
  };
}

interface Props {
  tenants: TenantOption[];
}

export function ClientMembershipsTab({ tenants }: Props) {
  const { toast } = useToast();
  const sortedTenants = useMemo(
    () => [...tenants].sort((a, b) => a.name.localeCompare(b.name)),
    [tenants],
  );

  const [tenantId, setTenantId] = useState<string>(sortedTenants[0]?.id ?? "");
  const [rows, setRows] = useState<MembershipRow[]>([]);
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>({ clients: [], memberships: [] });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "all">("all");

  const [granting, setGranting] = useState(false);
  const [grantClientId, setGrantClientId] = useState<string>("");
  const [grantMembershipId, setGrantMembershipId] = useState<string>("");
  const [grantNotes, setGrantNotes] = useState("");

  const [editing, setEditing] = useState<MembershipRow | null>(null);
  const [editingReason, setEditingReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function reload() {
    if (!tenantId) {
      setRows([]);
      setSnapshot({ clients: [], memberships: [] });
      return;
    }
    setLoading(true);
    try {
      const [memRes, dashRes] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc("admin_list_client_memberships", { _tenant_id: tenantId }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (supabase as any).rpc("admin_get_tenant_membership_dashboard", { _tenant_id: tenantId }),
      ]);
      if (memRes.error) throw memRes.error;
      if (dashRes.error) throw dashRes.error;
      setRows((memRes.data ?? []).map(rowToMembership));
      setSnapshot(
        (dashRes.data as DashboardSnapshot) ?? { clients: [], memberships: [] },
      );
    } catch (err) {
      toast({
        title: "Erro ao carregar memberships",
        description: String((err as Error)?.message ?? err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.clientName.toLowerCase().includes(q) ||
        (r.clientEmail ?? "").toLowerCase().includes(q) ||
        r.membershipName.toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === "active").length;
    const canceled = rows.filter((r) => r.status === "canceled").length;
    const mrr = rows
      .filter((r) => r.status === "active")
      .reduce((acc, r) => {
        const monthlyFactor =
          r.billingCycle === "yearly"
            ? 1 / 12
            : r.billingCycle === "biannual"
              ? 1 / 6
              : r.billingCycle === "quarterly"
                ? 1 / 3
                : 1;
        return acc + r.priceCents * monthlyFactor;
      }, 0);
    return { total, active, canceled, mrr: Math.round(mrr) };
  }, [rows]);

  async function handleGrant() {
    if (!tenantId || !grantClientId || !grantMembershipId) {
      toast({ title: "Preencha cliente e plano", variant: "destructive" });
      return;
    }
    setGranting(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_grant_client_membership", {
        _tenant_id: tenantId,
        _client_id: grantClientId,
        _membership_id: grantMembershipId,
        _notes: grantNotes.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Membership concedida" });
      setGrantClientId("");
      setGrantMembershipId("");
      setGrantNotes("");
      await reload();
    } catch (err) {
      toast({
        title: "Erro ao conceder",
        description: String((err as Error)?.message ?? err),
        variant: "destructive",
      });
    } finally {
      setGranting(false);
    }
  }

  async function handleCancel(row: MembershipRow) {
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_cancel_client_membership", {
        _subscription_id: row.subscriptionId,
        _reason: editingReason.trim() || null,
      });
      if (error) throw error;
      toast({ title: "Membership cancelada" });
      setEditing(null);
      setEditingReason("");
      await reload();
    } catch (err) {
      toast({
        title: "Erro ao cancelar",
        description: String((err as Error)?.message ?? err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleReactivate(row: MembershipRow) {
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_reactivate_client_membership", {
        _subscription_id: row.subscriptionId,
      });
      if (error) throw error;
      toast({ title: "Membership reativada" });
      setEditing(null);
      await reload();
    } catch (err) {
      toast({
        title: "Erro ao reativar",
        description: String((err as Error)?.message ?? err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="client-memberships-tab">
      {/* Seletor de tenant + filtros */}
      <div className="surface-card space-y-2 p-3">
        <div className="grid gap-1.5">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Estabelecimento</Label>
          <Select value={tenantId} onValueChange={setTenantId} disabled={loading}>
            <SelectTrigger data-testid="cm-tenant-select">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {sortedTenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente ou plano..."
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SubscriptionStatus | "all")}>
            <SelectTrigger className="h-9 min-w-[140px]">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABELS) as SubscriptionStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-9" onClick={() => void reload()} disabled={loading || !tenantId}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="Total" value={stats.total} />
        <SummaryTile label="Ativas" value={stats.active} tone="success" />
        <SummaryTile label="Canceladas" value={stats.canceled} tone="danger" />
        <SummaryTile label="MRR (R$)" value={Number((stats.mrr / 100).toFixed(0))} tone="brand" />
      </div>

      {/* Conceder membership */}
      {tenantId && snapshot.clients.length > 0 && snapshot.memberships.length > 0 && (
        <div className="surface-card space-y-2 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Gift className="h-4 w-4 text-primary" /> Conceder membership a um cliente
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={grantClientId} onValueChange={setGrantClientId} disabled={granting}>
              <SelectTrigger data-testid="cm-grant-client"><SelectValue placeholder="Cliente..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {snapshot.clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={grantMembershipId} onValueChange={setGrantMembershipId} disabled={granting}>
              <SelectTrigger data-testid="cm-grant-plan"><SelectValue placeholder="Plano..." /></SelectTrigger>
              <SelectContent>
                {snapshot.memberships.filter((m) => m.is_active).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} · {formatBRL(m.price_cents)} / {m.billing_cycle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={grantNotes}
            onChange={(e) => setGrantNotes(e.target.value)}
            placeholder="Observação (opcional)"
            rows={2}
          />
          <Button onClick={handleGrant} disabled={granting} data-testid="cm-grant-submit">
            {granting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
            Conceder
          </Button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !tenantId ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Selecione um estabelecimento"
          description="Escolha um tenant acima para listar memberships."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Gift className="h-6 w-6" />}
          title="Nenhuma membership"
          description="Conceda uma membership ou ajuste os filtros."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((row) => (
            <li key={row.subscriptionId}>
              <button
                type="button"
                onClick={() => { setEditing(row); setEditingReason(""); }}
                className="surface-card flex w-full flex-col gap-2 p-3 text-left transition hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="cm-card"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-soft text-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.clientName}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.membershipName}</p>
                  </div>
                  <StatusBadge tone={STATUS_TONES[row.status]}>
                    {STATUS_LABELS[row.status]}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
                    {formatBRL(row.priceCents)} / {row.billingCycle}
                  </span>
                  {row.totalSessions > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {row.usedSessions}/{row.totalSessions} sessões
                    </span>
                  )}
                  {row.currentCycleEnd && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(row.currentCycleEnd).toLocaleDateString("pt-BR")}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Sheet de detalhe / ações */}
      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl sm:max-w-lg sm:rounded-l-2xl sm:rounded-tr-none"
        >
          {editing && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" /> {editing.membershipName}
                </SheetTitle>
                <SheetDescription>
                  Cliente: <strong>{editing.clientName}</strong>
                  {editing.clientEmail ? ` · ${editing.clientEmail}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <Field label="Status" value={STATUS_LABELS[editing.status]} />
                  <Field label="Valor" value={`${formatBRL(editing.priceCents)} / ${editing.billingCycle}`} />
                  <Field label="Início" value={new Date(editing.startedAt).toLocaleDateString("pt-BR")} />
                  <Field label="Fim do ciclo" value={editing.currentCycleEnd ? new Date(editing.currentCycleEnd).toLocaleDateString("pt-BR") : "—"} />
                  <Field label="Sessões usadas" value={`${editing.usedSessions} / ${editing.totalSessions}`} />
                  {editing.canceledAt && (
                    <Field label="Cancelada em" value={new Date(editing.canceledAt).toLocaleString("pt-BR")} />
                  )}
                </dl>

                {editing.status === "active" && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Motivo do cancelamento (opcional)
                    </Label>
                    <Textarea value={editingReason} onChange={(e) => setEditingReason(e.target.value)} rows={2} />
                    <Button
                      variant="destructive"
                      onClick={() => void handleCancel(editing)}
                      disabled={saving}
                      className="w-full"
                      data-testid="cm-cancel"
                    >
                      {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleSlash className="mr-2 h-4 w-4" />}
                      Cancelar membership
                    </Button>
                  </div>
                )}

                {editing.status === "canceled" && (
                  <Button
                    onClick={() => void handleReactivate(editing)}
                    disabled={saving}
                    className="w-full"
                    data-testid="cm-reactivate"
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
                    Reativar membership
                  </Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-foreground">{label}</dt>
      <dd className="text-muted-foreground">{value}</dd>
    </div>
  );
}

function SummaryTile({ label, value, tone = "neutral" }: { label: string; value: number; tone?: StatusTone }) {
  const toneClass: Record<StatusTone, string> = {
    success: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-destructive",
    brand: "text-primary",
    info: "text-sky-600 dark:text-sky-400",
    neutral: "text-foreground",
  };
  return (
    <div className="surface-card p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-xl font-semibold ${toneClass[tone] ?? toneClass.neutral}`}>{value}</p>
    </div>
  );
}
