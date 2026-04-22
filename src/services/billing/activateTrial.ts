/**
 * Ativa um trial padrão para o tenant.
 *
 * Estratégia:
 * - Chama a RPC `start_default_trial(_tenant_id)` no banco. A função roda
 *   como SECURITY DEFINER, valida o papel do usuário (owner/manager do
 *   tenant ou super_admin) e cria a assinatura de forma idempotente,
 *   contornando a RLS de INSERT que só permite super_admin.
 * - Se já existir assinatura, a função retorna a assinatura existente
 *   sem erros (idempotência server-side).
 * - O cliente em seguida apenas resolve o objeto Plan correspondente.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  getSubscriptionByTenant,
  listPlans,
} from "@/repositories/billing";
import type { Plan, TenantSubscription } from "@/domain/billing";

export interface ActivateTrialResult {
  subscription: TenantSubscription;
  plan: Plan;
  alreadyExisted: boolean;
}

export async function activateDefaultTrial(tenantId: string): Promise<ActivateTrialResult> {
  if (!tenantId) {
    throw new Error("Tenant inválido para ativar o trial.");
  }

  // 1. Detecta estado prévio (para sinalizar alreadyExisted ao toast).
  const existing = await getSubscriptionByTenant(tenantId);

  // 2. Chama RPC que respeita RLS via SECURITY DEFINER.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("start_default_trial", {
    _tenant_id: tenantId,
  });

  if (error) {
    // Mapeia mensagens de banco para textos amigáveis
    const raw = error.message ?? "";
    if (/Sem permissão/i.test(raw) || error.code === "42501") {
      throw new Error("Você não tem permissão para ativar o trial neste tenant.");
    }
    if (/Nenhum plano disponível/i.test(raw)) {
      throw new Error("Nenhum plano disponível foi configurado para iniciar o trial.");
    }
    throw new Error(raw || "Não foi possível ativar o trial.");
  }

  if (!data) {
    throw new Error("Resposta vazia do servidor ao ativar o trial.");
  }

  // RPC retorna a linha de tenant_subscriptions
  const row = data as Record<string, unknown>;

  const subscription: TenantSubscription = {
    id: row.id as string,
    tenantId: row.tenant_id as string,
    planId: row.plan_id as string,
    status: row.status as TenantSubscription["status"],
    trialStartedAt: (row.trial_started_at as string) ?? null,
    trialEndsAt: (row.trial_ends_at as string) ?? null,
    currentPeriodStart: row.current_period_start as string,
    currentPeriodEnd: (row.current_period_end as string) ?? null,
    canceledAt: (row.canceled_at as string) ?? null,
    suspendedAt: (row.suspended_at as string) ?? null,
    overdueSince: (row.overdue_since as string) ?? null,
    discountCents: (row.discount_cents as number) ?? 0,
    discountReason: (row.discount_reason as string) ?? null,
    overrideLimits:
      (row.override_limits as Record<string, number | null>) ?? {},
    notes: (row.notes as string) ?? null,
  };

  // 3. Resolve o plano correspondente
  const plans = await listPlans();
  const plan = plans.find((p) => p.id === subscription.planId);
  if (!plan) {
    throw new Error("Plano da assinatura não encontrado após ativação.");
  }

  return {
    subscription,
    plan,
    alreadyExisted: Boolean(existing),
  };
}
