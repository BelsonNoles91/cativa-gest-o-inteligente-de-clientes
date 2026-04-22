/**
 * Ativa um trial padrão para o tenant.
 *
 * Estratégia:
 * - Procura o plano marcado como `is_default` (ou o primeiro `public` por `display_order`).
 * - Se já existir uma assinatura para o tenant, retorna ela (idempotente).
 * - Caso contrário, cria uma `tenant_subscription` com status `trialing`,
 *   `trial_started_at = now()` e `trial_ends_at = now() + plan.trial_days`.
 * - Registra um `subscription_event` `trial_started`.
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
  // 1. Idempotência — já existe assinatura?
  const existing = await getSubscriptionByTenant(tenantId);
  const plans = await listPlans();

  if (existing) {
    const currentPlan = plans.find((p) => p.id === existing.planId);
    if (!currentPlan) throw new Error("Plano da assinatura atual não encontrado.");
    return { subscription: existing, plan: currentPlan, alreadyExisted: true };
  }

  // 2. Escolher plano default
  const defaultPlan =
    plans.find((p) => p.isDefault && p.status === "public") ??
    plans.find((p) => p.status === "public") ??
    plans[0];

  if (!defaultPlan) {
    throw new Error("Nenhum plano disponível para iniciar o trial.");
  }

  // 3. Calcular janela de trial
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() + defaultPlan.trialDays * 86_400_000);

  // 4. Criar assinatura
  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .insert({
      tenant_id: tenantId,
      plan_id: defaultPlan.id,
      status: "trialing",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEndsAt.toISOString(),
      current_period_start: now.toISOString(),
      current_period_end: trialEndsAt.toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  // 5. Registrar evento (best-effort — não falha se a tabela negar)
  await supabase.from("subscription_events").insert({
    tenant_id: tenantId,
    subscription_id: data.id,
    event_type: "trial_started",
    to_status: "trialing",
    to_plan_id: defaultPlan.id,
    notes: `Trial padrão de ${defaultPlan.trialDays} dias iniciado pelo próprio tenant.`,
  });

  const subscription: TenantSubscription = {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    planId: data.plan_id as string,
    status: data.status as TenantSubscription["status"],
    trialStartedAt: data.trial_started_at as string,
    trialEndsAt: data.trial_ends_at as string,
    currentPeriodStart: data.current_period_start as string,
    currentPeriodEnd: (data.current_period_end as string) ?? null,
    canceledAt: null,
    suspendedAt: null,
    overdueSince: null,
    discountCents: 0,
    discountReason: null,
    overrideLimits: {},
    notes: null,
  };

  return { subscription, plan: defaultPlan, alreadyExisted: false };
}
