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
 *
 * Observabilidade:
 * - Toda tentativa (sucesso, falha por RLS, falha por plano ausente,
 *   falha desconhecida) é registrada em `audit_logs` com action
 *   prefixada por `trial.activation.*`. Isso alimenta o painel
 *   SuperAdmin → Logs de trial.
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

export type TrialActivationFailureReason =
  | "rls_denied"
  | "no_plan"
  | "unauthenticated"
  | "unknown";

/**
 * Categoriza um erro vindo da RPC para análise posterior no painel.
 * Mantém categorias estáveis para que o admin possa filtrar/ordenar.
 */
function classifyError(rawMessage: string, code?: string | null): TrialActivationFailureReason {
  if (/não autenticado|unauthenticated/i.test(rawMessage)) return "unauthenticated";
  if (code === "42501" || /permiss|policy|RLS|denied/i.test(rawMessage)) return "rls_denied";
  if (code === "P0002" || /Nenhum plano|no plan/i.test(rawMessage)) return "no_plan";
  return "unknown";
}

/**
 * Registra a tentativa em audit_logs. Falhas de log são silenciosas
 * (não devem mascarar a verdadeira causa para o usuário final).
 */
async function logAttempt(input: {
  tenantId: string;
  action:
    | "trial.activation.success"
    | "trial.activation.already_existed"
    | "trial.activation.failure";
  metadata: Record<string, unknown>;
}) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert([
      {
        tenant_id: input.tenantId,
        actor_id: userData?.user?.id ?? null,
        action: input.action,
        entity: "tenant_subscriptions",
        entity_id: input.tenantId,
        metadata: input.metadata as never,
      },
    ]);
  } catch {
    // Silencioso. O foco aqui é não interferir no fluxo principal.
  }
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
    const raw = error.message ?? "";
    const reason = classifyError(raw, error.code);

    // Log estruturado para o painel
    await logAttempt({
      tenantId,
      action: "trial.activation.failure",
      metadata: {
        reason,
        rls_violation: reason === "rls_denied",
        rpc: "start_default_trial",
        error_code: error.code ?? null,
        error_message: raw,
        had_previous_subscription: Boolean(existing),
        client: "web",
        recommended_action:
          reason === "rls_denied"
            ? "Verifique se o usuário tem papel owner/manager neste tenant ou é super_admin."
            : reason === "no_plan"
              ? "Configure um plano com is_default=true e status=public."
              : reason === "unauthenticated"
                ? "Reautentique o usuário e tente novamente."
                : "Investigue o erro original em error_message.",
      },
    });

    // Mapeia mensagens de banco para textos amigáveis
    if (reason === "rls_denied") {
      throw new Error("Você não tem permissão para ativar o trial neste tenant.");
    }
    if (reason === "no_plan") {
      throw new Error("Nenhum plano disponível foi configurado para iniciar o trial.");
    }
    if (reason === "unauthenticated") {
      throw new Error("Sessão expirada. Faça login novamente para ativar o trial.");
    }
    throw new Error(raw || "Não foi possível ativar o trial.");
  }

  if (!data) {
    await logAttempt({
      tenantId,
      action: "trial.activation.failure",
      metadata: {
        reason: "unknown" as TrialActivationFailureReason,
        rpc: "start_default_trial",
        error_message: "Resposta vazia da RPC",
        recommended_action:
          "Verifique se a função start_default_trial existe e está retornando a linha esperada.",
      },
    });
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
    await logAttempt({
      tenantId,
      action: "trial.activation.failure",
      metadata: {
        reason: "unknown" as TrialActivationFailureReason,
        rpc: "start_default_trial",
        error_message: "Plano da assinatura não encontrado após ativação.",
        plan_id: subscription.planId,
        recommended_action:
          "Garanta que o plano referenciado pela assinatura exista e tenha status visível.",
      },
    });
    throw new Error("Plano da assinatura não encontrado após ativação.");
  }

  await logAttempt({
    tenantId,
    action: existing
      ? "trial.activation.already_existed"
      : "trial.activation.success",
    metadata: {
      subscription_id: subscription.id,
      plan_id: plan.id,
      plan_code: plan.code,
      status: subscription.status,
      trial_ends_at: subscription.trialEndsAt,
    },
  });

  return {
    subscription,
    plan,
    alreadyExisted: Boolean(existing),
  };
}
