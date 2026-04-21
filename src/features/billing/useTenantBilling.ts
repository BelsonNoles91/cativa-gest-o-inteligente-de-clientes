/**
 * useTenantBilling — visão do OWNER sobre o próprio billing.
 *
 * Carrega: assinatura atual, plano, features incluídas, limites efetivos
 * (com override) e consumo em tempo real (units, professionals, clientes ativos).
 */
import { useEffect, useState } from "react";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  calculateLiveUsage,
  getSubscriptionByTenant,
  listFeatureFlags,
  listPlanFeatures,
  listPlans,
} from "@/repositories/billing";
import {
  effectiveLimits,
  type FeatureFlag,
  type Plan,
  type PlanFeature,
  type TenantSubscription,
} from "@/domain/billing";

interface BillingState {
  loading: boolean;
  subscription: TenantSubscription | null;
  plan: Plan | null;
  features: PlanFeature[];
  flags: FeatureFlag[];
  usage: {
    unitsCount: number;
    professionalsCount: number;
    activeClientsCount: number;
    appointmentsLast30d: number;
  };
  limits: ReturnType<typeof effectiveLimits> | null;
}

export function useTenantBilling() {
  const { currentTenant } = useTenant();
  const [state, setState] = useState<BillingState>({
    loading: true,
    subscription: null,
    plan: null,
    features: [],
    flags: [],
    usage: { unitsCount: 0, professionalsCount: 0, activeClientsCount: 0, appointmentsLast30d: 0 },
    limits: null,
  });

  useEffect(() => {
    let cancel = false;
    async function load() {
      if (!currentTenant) return;
      setState((s) => ({ ...s, loading: true }));
      const sub = await getSubscriptionByTenant(currentTenant.id);
      const plans = await listPlans();
      const plan = sub ? plans.find((p) => p.id === sub.planId) ?? null : null;
      const [features, flags, usage] = await Promise.all([
        plan ? listPlanFeatures([plan.id]) : Promise.resolve([] as PlanFeature[]),
        listFeatureFlags(currentTenant.id),
        calculateLiveUsage(currentTenant.id),
      ]);
      if (cancel) return;
      setState({
        loading: false,
        subscription: sub,
        plan,
        features,
        flags,
        usage,
        limits: plan ? effectiveLimits(plan, sub?.overrideLimits ?? {}) : null,
      });
    }
    void load();
    return () => {
      cancel = true;
    };
  }, [currentTenant]);

  return state;
}
