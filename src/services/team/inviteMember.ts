/**
 * Service: convida um membro inicial para o tenant.
 *
 * Versão inicial (Etapa 2):
 *   - cria uma membership com status = 'invited' e invited_email
 *   - registra audit_log
 *
 * Quando o convidado se cadastrar com o mesmo e-mail, a Etapa
 * seguinte poderá fazer o "claim" da membership pelo user_id real.
 *
 * NOTA: como `tenant_memberships.user_id` é NOT NULL, mantemos o
 * membership pendente em uma tabela separada já existente? Aqui
 * vamos materializar o convite no audit_logs por enquanto e
 * deixar a criação do membership real para o momento do claim
 * (próxima etapa).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Role } from "@/domain/roles";

export interface InviteMemberInput {
  tenantId: string;
  email: string;
  role: Role;
  inviterUserId: string;
}

export async function inviteMember(input: InviteMemberInput) {
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: input.tenantId,
    actor_id: input.inviterUserId,
    action: "team.invited",
    entity: "membership",
    metadata: {
      invited_email: input.email.toLowerCase(),
      role: input.role,
    },
  });
  if (error) throw error;
}
