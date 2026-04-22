/**
 * Service: convite real de equipe.
 *
 * Bloco B (Lovable): substitui o registro em audit_logs pela materialização
 * em `team_invitations`. O convite gera um token único e é aceito pelo
 * convidado via RPC `accept_team_invitation(token)` (em /auth/aceite-convite).
 *
 * Compatível com:
 *   - multi-tenant (RLS por tenant_id)
 *   - enforcement de `max_professionals` no momento do aceite
 *   - papéis (exceto super_admin/client)
 */
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/domain/roles";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export interface InviteMemberInput {
  tenantId: string;
  email: string;
  role: Role;
  inviterUserId: string;
  message?: string | null;
  expiresInDays?: number;
}

export interface InviteMemberResult {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
}

function buildInviteUrl(token: string): string {
  if (typeof window === "undefined") return `/auth/aceite-convite?token=${token}`;
  return `${window.location.origin}/auth/aceite-convite?token=${token}`;
}

export async function inviteMember(input: InviteMemberInput): Promise<InviteMemberResult> {
  const email = input.email.trim().toLowerCase();
  if (!/.+@.+\..+/.test(email)) {
    throw new Error("E-mail inválido.");
  }
  if (input.role === "super_admin" || input.role === "client") {
    throw new Error("Papel inválido para convite de equipe.");
  }

  const expiresAt = new Date(
    Date.now() + (input.expiresInDays ?? 14) * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("team_invitations")
    .insert({
      tenant_id: input.tenantId,
      email,
      role: input.role as AppRole,
      invited_by: input.inviterUserId,
      message: input.message ?? null,
      expires_at: expiresAt,
    })
    .select("id, token, expires_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("Já existe um convite pendente para este e-mail neste tenant.");
    }
    throw error;
  }

  // Auditoria informativa (não bloqueante)
  try {
    await supabase.from("audit_logs").insert({
      tenant_id: input.tenantId,
      actor_id: input.inviterUserId,
      action: "team.invitation_created",
      entity: "team_invitation",
      entity_id: data.id,
      metadata: { invited_email: email, role: input.role },
    });
  } catch {
    // ignore — RLS/connection issues não devem invalidar o convite criado
  }

  return {
    id: data.id,
    token: data.token,
    inviteUrl: buildInviteUrl(data.token),
    expiresAt: data.expires_at,
  };
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase.rpc("revoke_team_invitation", {
    _invitation_id: invitationId,
  });
  if (error) throw error;
}

export async function acceptInvitation(token: string) {
  const { data, error } = await supabase.rpc("accept_team_invitation", { _token: token });
  if (error) throw error;
  return data;
}

export async function listPendingInvitationsForCurrentUser() {
  const { data, error } = await supabase.rpc("list_pending_invitations_for_current_user");
  if (error) throw error;
  return data ?? [];
}
