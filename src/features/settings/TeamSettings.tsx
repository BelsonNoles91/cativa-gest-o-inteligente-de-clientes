/**
 * TeamSettings — equipe atual + registrar convites iniciais.
 */
import { useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
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
import { EmptyState } from "@/components/feedback/EmptyState";
import { StatusBadge } from "@/components/feedback/StatusBadge";
import { ROLES, roleLabels, type Role } from "@/domain/roles";
import { inviteMember } from "@/services/team/inviteMember";

const INVITE_ROLES: Role[] = ROLES.filter((r) => r !== "super_admin" && r !== "client");

interface MemberRow {
  user_id: string;
  role: Role;
  status: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

interface PendingInvite {
  id: string;
  metadata: { invited_email?: string; role?: Role };
  created_at: string;
}

export function TeamSettings() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pending, setPending] = useState<PendingInvite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("frontdesk");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!currentTenant) return;
    setLoading(true);
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase
        .from("tenant_memberships")
        .select("user_id, role, status, profiles:profiles!inner(full_name, avatar_url)")
        .eq("tenant_id", currentTenant.id),
      supabase
        .from("audit_logs")
        .select("id, metadata, created_at")
        .eq("tenant_id", currentTenant.id)
        .eq("action", "team.invited")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setMembers((m ?? []) as unknown as MemberRow[]);
    setPending((p ?? []) as unknown as PendingInvite[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [currentTenant?.id]);

  const onInvite = async () => {
    if (!currentTenant || !user) return;
    const e = email.trim().toLowerCase();
    if (!/.+@.+\..+/.test(e)) { toast.error("E-mail inválido"); return; }
    setSubmitting(true);
    try {
      await inviteMember({ tenantId: currentTenant.id, email: e, role, inviterUserId: user.id });
      toast.success("Convite registrado", { description: "Compartilhe o link de cadastro com a pessoa." });
      setEmail("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao convidar");
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentTenant) return null;

  return (
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
                <li key={m.user_id} className="flex items-center gap-3 py-3">
                  <Avatar className="h-9 w-9 border border-border/60">
                    <AvatarFallback className="bg-accent-soft text-accent-foreground text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{name}</p>
                    <p className="text-xs text-muted-foreground">{roleLabels[m.role]}</p>
                  </div>
                  <StatusBadge tone={m.status === "active" ? "success" : "warning"}>{m.status === "active" ? "Ativo" : m.status}</StatusBadge>
                </li>
              );
            })}
          </ul>
        )}

        {pending.length > 0 && (
          <div className="mt-6">
            <h4 className="mb-2 text-sm font-medium">Convites registrados</h4>
            <ul className="space-y-1.5">
              {pending.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <span>{i.metadata?.invited_email}</span>
                  <StatusBadge tone="warning" dot={false}>{i.metadata?.role ? roleLabels[i.metadata.role as Role] : "—"}</StatusBadge>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Os convites ficam registrados aqui. Quando o convidado se cadastrar com este e-mail, a vinculação ao tenant será feita na próxima etapa.
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
  );
}
