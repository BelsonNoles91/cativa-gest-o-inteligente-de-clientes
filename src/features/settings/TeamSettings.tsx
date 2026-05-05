/**
 * TeamSettings — equipe atual + convites + ficha dos profissionais.
 *
 * "Equipe" (tenant_memberships) trata vínculo de usuário/papel de acesso.
 * "Profissionais" (tabela `professionals`) é o cadastro operacional usado pela
 * agenda, com contato, especialidade e comissão. As duas listas se complementam.
 */
import { useEffect, useState } from "react";
import {
  Loader2,
  UserPlus,
  Users,
  Pencil,
  Plus,
  Briefcase,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/features/tenant/TenantProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
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
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ROLES, roleLabels, type Role } from "@/domain/roles";
import { inviteMember, revokeInvitation } from "@/services/team/inviteMember";

const INVITE_ROLES: Role[] = ROLES.filter((r) => r !== "super_admin" && r !== "client");

interface MemberRow {
  user_id: string;
  role: Role;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface PendingInvite {
  id: string;
  email: string;
  role: Role;
  status: string;
  expires_at: string;
  created_at: string;
}

interface ProfessionalRow {
  id: string;
  display_name: string;
  role_title: string | null;
  specialty: string | null;
  email: string | null;
  phone: string | null;
  commission_pct: number | string | null;
  is_active: boolean;
}

interface ProfessionalForm {
  id: string | null;
  displayName: string;
  roleTitle: string;
  specialty: string;
  email: string;
  phone: string;
  commissionPct: string;
  isActive: boolean;
}

const EMPTY_PROFESSIONAL: ProfessionalForm = {
  id: null,
  displayName: "",
  roleTitle: "",
  specialty: "",
  email: "",
  phone: "",
  commissionPct: "",
  isActive: true,
};

export function TeamSettings() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("frontdesk");
  const [submitting, setSubmitting] = useState(false);

  const [professionals, setProfessionals] = useState<ProfessionalRow[]>([]);
  const [proLoading, setProLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorForm, setEditorForm] = useState<ProfessionalForm>(EMPTY_PROFESSIONAL);
  const [editorSaving, setEditorSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProfessionalRow | null>(null);

  const load = async () => {
    if (!currentTenant) return;
    setLoading(true);
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase
        .from("tenant_memberships")
        .select("user_id, role, status, profiles:profiles!inner(full_name, avatar_url)")
        .eq("tenant_id", currentTenant.id),
      // token plaintext não é mais persistido — apenas o hash. Removemos a coluna.
      supabase
        .from("team_invitations")
        .select("id, email, role, status, expires_at, created_at")
        .eq("tenant_id", currentTenant.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false }),
    ]);
    setMembers((m ?? []) as unknown as MemberRow[]);
    setPending((p ?? []) as unknown as PendingInvite[]);
    setLoading(false);
  };

  const loadProfessionals = async () => {
    if (!currentTenant) return;
    setProLoading(true);
    // Tenta com commission_pct (owner/manager). Se falhar por GRANT, refaz sem.
    const withCommission = await supabase
      .from("professionals")
      .select("id, display_name, role_title, specialty, email, phone, commission_pct, is_active")
      .eq("tenant_id", currentTenant.id)
      .order("display_name");
    if (!withCommission.error) {
      setProfessionals((withCommission.data ?? []) as unknown as ProfessionalRow[]);
      setProLoading(false);
      return;
    }
    const fallback = await supabase
      .from("professionals")
      .select("id, display_name, role_title, specialty, email, phone, is_active")
      .eq("tenant_id", currentTenant.id)
      .order("display_name");
    if (fallback.error) {
      toast.error("Não foi possível carregar profissionais", { description: fallback.error.message });
      setProfessionals([]);
    } else {
      setProfessionals(
        (fallback.data ?? []).map((r) => ({ ...r, commission_pct: null })) as unknown as ProfessionalRow[],
      );
    }
    setProLoading(false);
  };

  useEffect(() => {
    void load();
    void loadProfessionals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id]);

  const onInvite = async () => {
    if (!currentTenant || !user) return;
    const e = email.trim().toLowerCase();
    if (!/.+@.+\..+/.test(e)) { toast.error("E-mail inválido"); return; }
    setSubmitting(true);
    try {
      const result = await inviteMember({ tenantId: currentTenant.id, email: e, role, inviterUserId: user.id });
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
        toast.success("Convite criado", { description: "Link copiado para a área de transferência." });
      } catch {
        toast.success("Convite criado", { description: "Compartilhe o link gerado com a pessoa." });
      }
      setEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao convidar");
    } finally {
      setSubmitting(false);
    }
  };

  // Link de convite só é exibido na criação (token plaintext não é mais persistido).


  const onRevokeInvite = async (id: string) => {
    try {
      await revokeInvitation(id);
      toast.success("Convite revogado");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao revogar convite");
    }
  };

  const toggleMemberStatus = async (userId: string, currentStatus: string) => {
    if (!currentTenant) return;
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const { error } = await supabase
        .from("tenant_memberships")
        .update({ status: newStatus })
        .eq("user_id", userId)
        .eq("tenant_id", currentTenant.id);
      if (error) throw error;
      toast.success(newStatus === "active" ? "Acesso desbloqueado" : "Acesso bloqueado");
      await load();
    } catch (err) {
      toast.error("Erro ao alterar status");
    }
  };

  const removeMember = async (userId: string, name: string) => {
    if (!currentTenant) return;
    if (!window.confirm(`Remover o acesso de ${name}? Ele não poderá mais acessar o sistema desta clínica.`)) return;
    try {
      const { error } = await supabase
        .from("tenant_memberships")
        .delete()
        .eq("user_id", userId)
        .eq("tenant_id", currentTenant.id);
      if (error) throw error;
      toast.success("Membro removido da equipe");
      await load();
    } catch (err) {
      toast.error("Erro ao remover membro");
    }
  };

  const openCreate = () => {
    setEditorForm(EMPTY_PROFESSIONAL);
    setEditorOpen(true);
  };

  const openEdit = (row: ProfessionalRow) => {
    setEditorForm({
      id: row.id,
      displayName: row.display_name,
      roleTitle: row.role_title ?? "",
      specialty: row.specialty ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      commissionPct:
        row.commission_pct === null || row.commission_pct === undefined
          ? ""
          : String(row.commission_pct),
      isActive: row.is_active,
    });
    setEditorOpen(true);
  };

  const saveProfessional = async () => {
    if (!currentTenant) return;
    const name = editorForm.displayName.trim();
    if (!name) {
      toast.error("Informe o apelido público.");
      return;
    }
    let commission: number | null = null;
    if (editorForm.commissionPct.trim() !== "") {
      const parsed = Number(editorForm.commissionPct.replace(",", "."));
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        toast.error("Comissão inválida", { description: "Informe um valor entre 0 e 100." });
        return;
      }
      commission = parsed;
    }
    const emailValue = editorForm.email.trim();
    if (emailValue && !/.+@.+\..+/.test(emailValue)) {
      toast.error("E-mail inválido");
      return;
    }
    setEditorSaving(true);
    try {
      const payload = {
        tenant_id: currentTenant.id,
        display_name: name,
        role_title: editorForm.roleTitle.trim() || null,
        specialty: editorForm.specialty.trim() || null,
        email: emailValue || null,
        phone: editorForm.phone.trim() || null,
        commission_pct: commission,
        is_active: editorForm.isActive,
      };
      if (editorForm.id) {
        const { error } = await supabase
          .from("professionals")
          .update(payload)
          .eq("id", editorForm.id)
          .eq("tenant_id", currentTenant.id);
        if (error) throw error;
        toast.success("Profissional atualizado");
      } else {
        const { error } = await supabase.from("professionals").insert(payload);
        if (error) throw error;
        toast.success("Profissional cadastrado");
      }
      setEditorOpen(false);
      await loadProfessionals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    } finally {
      setEditorSaving(false);
    }
  };

  const deleteProfessional = async () => {
    if (!confirmDelete || !currentTenant) return;
    const target = confirmDelete;
    setConfirmDelete(null);
    try {
      const { error } = await supabase
        .from("professionals")
        .delete()
        .eq("id", target.id)
        .eq("tenant_id", currentTenant.id);
      if (error) throw error;
      toast.success("Profissional removido");
      await loadProfessionals();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao remover", {
        description: "Profissionais com agendamentos não podem ser excluídos — desative-os.",
      });
    }
  };

  if (!currentTenant) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="surface-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold">Equipe atual</h3>
            <span className="text-xs text-muted-foreground">{members.length} {members.length === 1 ? "membro" : "membros"}</span>
          </div>

          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : members.length === 0 ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="Sem membros" description="Convide pessoas para trabalhar com você." />
          ) : (
            <ul className="divide-y divide-border/60">
              {members.map((m) => {
                const name = m.profiles?.full_name ?? "Sem nome";
                const initials = name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "??";
                return (
                  <li key={m.user_id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar className="h-9 w-9 border border-border/60">
                      <AvatarFallback className="bg-accent-soft text-accent-foreground text-xs">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{name}</p>
                      <p className="text-xs text-muted-foreground">{roleLabels[m.role]}</p>
                    </div>
                    <StatusBadge tone={m.status === "active" ? "success" : "warning"}>{m.status === "active" ? "Ativo" : m.status}</StatusBadge>
                    
                    {m.user_id !== user?.id && m.role !== "owner" && (
                      <div className="flex items-center gap-2 ml-auto">
                        <div className="flex items-center gap-2 mr-2">
                          <Switch 
                            checked={m.status === "active"} 
                            onCheckedChange={() => toggleMemberStatus(m.user_id, m.status)} 
                            aria-label="Bloquear/Desbloquear acesso"
                            title={m.status === "active" ? "Bloquear acesso" : "Desbloquear acesso"}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMember(m.user_id, name)}
                          aria-label={`Remover acesso de ${name}`}
                          title="Remover da equipe"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {pending.length > 0 && (
            <div className="mt-6">
              <h4 className="mb-2 text-sm font-medium">Convites pendentes</h4>
              <ul className="space-y-1.5">
                {pending.map((i) => {
                  const expired = new Date(i.expires_at).getTime() <= Date.now();
                  return (
                    <li
                      key={i.id}
                      className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"
                    >
                      <span className="truncate font-medium">{i.email}</span>
                      <StatusBadge tone={expired ? "danger" : "warning"} dot={false}>
                        {roleLabels[i.role]}
                      </StatusBadge>
                      <span className="text-[11px] text-muted-foreground">
                        {expired
                          ? "Expirou"
                          : `expira ${new Date(i.expires_at).toLocaleDateString()}`}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onRevokeInvite(i.id)}
                          aria-label="Revogar convite"
                          title="Revogar convite (gere um novo para reenviar o link)"
                        >
                          <XCircle className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Compartilhe o link de aceite com a pessoa convidada. Ao aceitar, ela passará a fazer parte do tenant com o papel atribuído.
              </p>
            </div>
          )}
        </section>

        <section className="surface-card p-5">
          <h3 className="font-display text-lg font-semibold">Convidar membro</h3>
          <p className="mt-1 text-sm text-muted-foreground">Envie um convite por e-mail. Ele será efetivado quando a pessoa criar a conta.</p>

          <div className="mt-5 space-y-3">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" placeholder="email@equipe.com" />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{INVITE_ROLES.map((r) => <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={onInvite} disabled={submitting} className="h-11 w-full rounded-xl bg-gradient-brand">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><UserPlus className="mr-2 h-4 w-4" /> Registrar convite</>)}
            </Button>
          </div>
        </section>
      </div>

      <section className="surface-card p-5" data-testid="professionals-section">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">Profissionais (ficha)</h3>
            <p className="text-xs text-muted-foreground">
              Cadastro operacional usado pela agenda. Inclua especialidade, contato e comissão.
            </p>
          </div>
          <Button
            onClick={openCreate}
            data-critical-action
            data-testid="professional-create-cta"
            className="rounded-xl bg-gradient-brand"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" /> Novo profissional
          </Button>
        </div>

        {proLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : professionals.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="Sem profissionais cadastrados"
            description="Cadastre quem atende para vincular aos agendamentos."
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {professionals.map((p) => {
              const initials = p.display_name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase() || "??";
              const commission =
                p.commission_pct === null || p.commission_pct === undefined
                  ? null
                  : Number(p.commission_pct);
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center gap-3 py-3"
                  data-testid="professional-row"
                >
                  <Avatar className="h-9 w-9 border border-border/60">
                    <AvatarFallback className="bg-muted text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.display_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.role_title, p.specialty].filter(Boolean).join(" · ") || "Sem função definida"}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[p.email, p.phone].filter(Boolean).join(" · ") || "Sem contato"}
                      {commission !== null ? ` · Comissão ${commission}%` : ""}
                    </p>
                  </div>
                  <StatusBadge tone={p.is_active ? "success" : "neutral"} dot={false}>
                    {p.is_active ? "Ativo" : "Inativo"}
                  </StatusBadge>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                      data-testid="professional-edit"
                      aria-label={`Editar ${p.display_name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setConfirmDelete(p)}
                      data-testid="professional-delete"
                      aria-label={`Remover ${p.display_name}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editorForm.id ? "Editar profissional" : "Novo profissional"}</DialogTitle>
            <DialogDescription>
              Os dados são usados pela agenda e ficam visíveis apenas para a equipe do tenant.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="pro-display-name">Apelido público *</Label>
              <Input
                id="pro-display-name"
                value={editorForm.displayName}
                onChange={(e) => setEditorForm((s) => ({ ...s, displayName: e.target.value }))}
                placeholder="Ex.: Diego"
                data-testid="professional-form-display-name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pro-role">Função</Label>
                <Input
                  id="pro-role"
                  value={editorForm.roleTitle}
                  onChange={(e) => setEditorForm((s) => ({ ...s, roleTitle: e.target.value }))}
                  placeholder="Barbeiro sênior"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pro-specialty">Especialidade</Label>
                <Input
                  id="pro-specialty"
                  value={editorForm.specialty}
                  onChange={(e) => setEditorForm((s) => ({ ...s, specialty: e.target.value }))}
                  placeholder="Fade, barba…"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pro-email">E-mail</Label>
                <Input
                  id="pro-email"
                  type="email"
                  value={editorForm.email}
                  onChange={(e) => setEditorForm((s) => ({ ...s, email: e.target.value }))}
                  placeholder="profissional@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pro-phone">Telefone</Label>
                <Input
                  id="pro-phone"
                  value={editorForm.phone}
                  onChange={(e) => setEditorForm((s) => ({ ...s, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pro-commission">Comissão (%)</Label>
                <Input
                  id="pro-commission"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={100}
                  step={0.1}
                  value={editorForm.commissionPct}
                  onChange={(e) =>
                    setEditorForm((s) => ({ ...s, commissionPct: e.target.value }))
                  }
                  placeholder="Ex.: 40"
                />
              </div>
              <div className="flex items-end gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2">
                  <Switch
                    checked={editorForm.isActive}
                    onCheckedChange={(v) => setEditorForm((s) => ({ ...s, isActive: v }))}
                    id="pro-active"
                  />
                  <Label htmlFor="pro-active" className="cursor-pointer text-sm">
                    {editorForm.isActive ? "Ativo na agenda" : "Inativo"}
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={editorSaving}>
              Cancelar
            </Button>
            <Button
              onClick={saveProfessional}
              disabled={editorSaving}
              data-testid="professional-form-save"
              className="bg-gradient-brand"
            >
              {editorSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete !== null} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover profissional?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete
                ? `"${confirmDelete.display_name}" será removido. Profissionais com agendamentos não podem ser excluídos — nesse caso, desative-os.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deleteProfessional} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
