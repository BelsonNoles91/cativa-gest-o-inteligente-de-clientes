/**
 * MembersTab — painel mobile-first do Super Admin para gerenciar
 * papéis (role) e status de cada membro por tenant.
 *
 * Fonte: RPC `admin_list_tenant_memberships` (SECURITY DEFINER, super admin only).
 * Mutações: `admin_update_membership_role`, `admin_update_membership_status`,
 * `admin_set_super_admin` — todas com auditoria em `audit_logs`.
 *
 * UX:
 * - Lista em cards (1 col mobile, 2 cols tablet, 3 cols desktop)
 * - Filtros sticky no topo (busca + tenant + papel + status)
 * - Sheet lateral/inferior para edição (mobile-first)
 */
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Crown,
  Filter,
  Loader2,
  Mail,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCircle2,
  UserCog,
  UserPlus,
} from "lucide-react";
import { ProvisionUserDialog } from "./ProvisionUserDialog";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge, type StatusTone } from "@/components/feedback/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ROLES, roleLabels, type Role } from "@/domain/roles";
import { useAuth } from "@/features/auth/AuthProvider";

type MembershipStatus = "active" | "invited" | "suspended";

const STATUS_LABELS: Record<MembershipStatus, string> = {
  active: "Ativo",
  invited: "Convidado",
  suspended: "Suspenso",
};

const STATUS_TONES: Record<MembershipStatus, StatusTone> = {
  active: "success",
  invited: "warning",
  suspended: "danger",
};

// Papéis que fazem sentido em um vínculo tenant↔usuário
// (super_admin é flag global em profiles, não membership)
const ASSIGNABLE_ROLES: Role[] = ROLES.filter((r) => r !== "super_admin" && r !== "client");

type MemberRow = {
  membershipId: string;
  userId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  role: Role;
  status: MembershipStatus;
  fullName: string | null;
  email: string | null;
  isSuperAdmin: boolean;
  invitedEmail: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  updatedAt: string;
};

function rowToMember(r: Record<string, unknown>): MemberRow {
  return {
    membershipId: r.membership_id as string,
    userId: r.user_id as string,
    tenantId: r.tenant_id as string,
    tenantName: (r.tenant_name as string) ?? "—",
    tenantSlug: (r.tenant_slug as string) ?? "",
    role: r.role as Role,
    status: r.status as MembershipStatus,
    fullName: (r.user_full_name as string) ?? null,
    email: (r.user_email as string) ?? null,
    isSuperAdmin: Boolean(r.user_is_super_admin),
    invitedEmail: (r.invited_email as string) ?? null,
    invitedAt: (r.invited_at as string) ?? null,
    acceptedAt: (r.accepted_at as string) ?? null,
    updatedAt: r.updated_at as string,
  };
}

export function MembersTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MembershipStatus | "all">("all");
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void> | void;
    destructive?: boolean;
  } | null>(null);

  async function reload() {
    setLoading(true);
    try {
      // RPC ainda não tipada nos types gerados — usa cast para any apenas aqui.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("admin_list_tenant_memberships");
      if (error) throw error;
      setRows((data ?? []).map(rowToMember));
    } catch (error) {
      toast({
        title: "Erro ao carregar membros",
        description: String((error as Error)?.message ?? error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const tenants = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.tenantId, r.tenantName);
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tenantFilter !== "all" && r.tenantId !== tenantFilter) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        (r.fullName ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q) ||
        r.tenantName.toLowerCase().includes(q) ||
        r.tenantSlug.toLowerCase().includes(q) ||
        (r.invitedEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, tenantFilter, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((r) => r.status === "active").length;
    const invited = rows.filter((r) => r.status === "invited").length;
    const suspended = rows.filter((r) => r.status === "suspended").length;
    const supers = new Set(rows.filter((r) => r.isSuperAdmin).map((r) => r.userId)).size;
    return { total, active, invited, suspended, supers };
  }, [rows]);

  async function handleRoleChange(member: MemberRow, newRole: Role) {
    if (newRole === member.role) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_update_membership_role", {
        p_membership_id: member.membershipId,
        p_new_role: newRole,
      });
      if (error) throw error;
      toast({ title: "Papel atualizado", description: `${member.fullName ?? member.email} agora é ${roleLabels[newRole]}.` });
      await reload();
      setEditing((cur) => (cur ? { ...cur, role: newRole } : cur));
    } catch (error) {
      toast({
        title: "Erro ao atualizar papel",
        description: String((error as Error)?.message ?? error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(member: MemberRow, newStatus: MembershipStatus) {
    if (newStatus === member.status) return;
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_update_membership_status", {
        p_membership_id: member.membershipId,
        p_new_status: newStatus,
      });
      if (error) throw error;
      toast({ title: "Status atualizado", description: `${member.fullName ?? member.email}: ${STATUS_LABELS[newStatus]}.` });
      await reload();
      setEditing((cur) => (cur ? { ...cur, status: newStatus } : cur));
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: String((error as Error)?.message ?? error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSuperAdmin(member: MemberRow, value: boolean) {
    if (member.userId === user?.id && !value) {
      toast({
        title: "Operação bloqueada",
        description: "Você não pode remover seu próprio acesso de super admin.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("admin_set_super_admin", {
        p_user_id: member.userId,
        p_is_super: value,
      });
      if (error) throw error;
      toast({
        title: value ? "Promovido a Super Admin" : "Super Admin removido",
        description: member.fullName ?? member.email ?? "",
      });
      await reload();
      setEditing((cur) => (cur ? { ...cur, isSuperAdmin: value } : cur));
    } catch (error) {
      toast({
        title: "Erro ao alterar Super Admin",
        description: String((error as Error)?.message ?? error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4" data-testid="members-tab">
      {/* Filtros — sticky em mobile */}
      <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:static sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome, e-mail ou tenant..."
            className="pl-9"
            data-testid="members-search"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={tenantFilter} onValueChange={setTenantFilter}>
            <SelectTrigger className="h-9 min-w-[140px] flex-1 sm:flex-none">
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tenants</SelectItem>
              {tenants.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as Role | "all")}>
            <SelectTrigger className="h-9 min-w-[130px] flex-1 sm:flex-none">
              <UserCog className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os papéis</SelectItem>
              {ASSIGNABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as MembershipStatus | "all")}>
            <SelectTrigger className="h-9 min-w-[130px] flex-1 sm:flex-none">
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABELS) as MembershipStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => void reload()}
            disabled={loading}
            data-testid="members-refresh"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            className="h-9"
            onClick={() => setProvisionOpen(true)}
            data-testid="members-provision"
          >
            <UserPlus className="mr-1.5 h-3.5 w-3.5" />
            Provisionar
          </Button>
        </div>
      </div>

      <ProvisionUserDialog
        open={provisionOpen}
        onOpenChange={setProvisionOpen}
        tenants={tenants}
        defaultTenantId={tenantFilter !== "all" ? tenantFilter : null}
        onCreated={() => void reload()}
      />

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryTile label="Total" value={stats.total} />
        <SummaryTile label="Ativos" value={stats.active} tone="success" />
        <SummaryTile label="Convidados" value={stats.invited} tone="warning" />
        <SummaryTile label="Super admins" value={stats.supers} tone="brand" />
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<UserCog className="h-6 w-6" />}
          title="Nenhum membro"
          description="Ajuste os filtros ou aguarde novos convites serem aceitos."
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((member) => (
            <li key={member.membershipId}>
              <button
                type="button"
                onClick={() => setEditing(member)}
                className="surface-card group flex w-full flex-col gap-2 p-3 text-left transition hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
                data-testid="member-card"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-soft text-primary">
                    {member.isSuperAdmin ? <Crown className="h-4 w-4" /> : <UserCircle2 className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.fullName ?? member.invitedEmail ?? member.email ?? "Sem nome"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.email ?? member.invitedEmail ?? "—"}
                    </p>
                  </div>
                  <StatusBadge tone={STATUS_TONES[member.status]}>
                    {STATUS_LABELS[member.status]}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    <span className="max-w-[12rem] truncate">{member.tenantName}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 font-medium text-primary">
                    <UserCog className="h-3 w-3" />
                    {roleLabels[member.role]}
                  </span>
                  {member.isSuperAdmin && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-warning/15 px-2 py-0.5 font-medium text-warning">
                      <Crown className="h-3 w-3" /> Super Admin
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Editor (Sheet) */}
      <Sheet open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[92vh] overflow-y-auto rounded-t-2xl sm:max-w-lg sm:rounded-l-2xl sm:rounded-tr-none"
        >
          {editing && (
            <>
              <SheetHeader className="text-left">
                <SheetTitle className="flex items-center gap-2">
                  <UserCog className="h-4 w-4 text-primary" />
                  {editing.fullName ?? editing.invitedEmail ?? editing.email ?? "Membro"}
                </SheetTitle>
                <SheetDescription className="space-y-1">
                  <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {editing.email ?? editing.invitedEmail ?? "—"}</span>
                  <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" /> {editing.tenantName}</span>
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-5">
                <div className="grid gap-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Papel neste tenant</Label>
                  <Select
                    value={editing.role}
                    onValueChange={(value) => void handleRoleChange(editing, value as Role)}
                    disabled={saving}
                  >
                    <SelectTrigger data-testid="member-role-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">Status</Label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(STATUS_LABELS) as MembershipStatus[]).map((s) => (
                      <Button
                        key={s}
                        type="button"
                        size="sm"
                        variant={editing.status === s ? "default" : "outline"}
                        disabled={saving}
                        onClick={() => void handleStatusChange(editing, s)}
                        data-testid={`member-status-${s}`}
                      >
                        {STATUS_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="surface-card space-y-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <ShieldCheck className="h-4 w-4 text-warning" /> Super Admin global
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Acesso total a todos os tenants e ao painel administrativo.
                      </p>
                    </div>
                    <Switch
                      checked={editing.isSuperAdmin}
                      disabled={saving || (editing.userId === user?.id && editing.isSuperAdmin)}
                      onCheckedChange={(value) => void handleToggleSuperAdmin(editing, value)}
                      data-testid="member-superadmin-toggle"
                    />
                  </div>
                  {editing.userId === user?.id && (
                    <p className="text-[11px] text-muted-foreground">
                      Você não pode remover seu próprio acesso de super admin.
                    </p>
                  )}
                </div>

                <dl className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    <dt className="font-medium text-foreground">Convidado em</dt>
                    <dd>{editing.invitedAt ? new Date(editing.invitedAt).toLocaleString("pt-BR") : "—"}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Aceito em</dt>
                    <dd>{editing.acceptedAt ? new Date(editing.acceptedAt).toLocaleString("pt-BR") : "—"}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="font-medium text-foreground">Última atualização</dt>
                    <dd>{new Date(editing.updatedAt).toLocaleString("pt-BR")}</dd>
                  </div>
                </dl>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
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
