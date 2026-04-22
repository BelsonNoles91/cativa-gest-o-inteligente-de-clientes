import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTenant } from "@/features/tenant/TenantProvider";
import {
  calculateLiveUsage,
  getSubscriptionByTenant,
  listFeatureFlags,
  listPlanFeatures,
  listPlans,
  listSubscriptionEvents,
} from "@/repositories/billing";
import {
  effectiveLimits,
  isBooleanFeatureEnabled,
  type FeatureFlag,
  type Plan,
  type PlanFeature,
  type SubscriptionEvent,
  type TenantSubscription,
} from "@/domain/billing";

interface TenantBillingContextValue {
  loading: boolean;
  subscription: TenantSubscription | null;
  plan: Plan | null;
  allPlans: Plan[];
  features: PlanFeature[];
  flags: FeatureFlag[];
  events: SubscriptionEvent[];
  usage: {
    unitsCount: number;
    professionalsCount: number;
    activeClientsCount: number;
    appointmentsLast30d: number;
  };
  limits: ReturnType<typeof effectiveLimits> | null;
  hasFeature: (featureKey: string) => boolean;
  flagValue: (flagKey: string) => unknown;
  refresh: () => Promise<void>;
}

const TenantBillingContext = createContext<TenantBillingContextValue | undefined>(undefined);

export function TenantBillingProvider({ children }: { children: ReactNode }) {
  const { currentTenant } = useTenant();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<TenantSubscription | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [events, setEvents] = useState<SubscriptionEvent[]>([]);
  const [usage, setUsage] = useState({
    unitsCount: 0,
    professionalsCount: 0,
    activeClientsCount: 0,
    appointmentsLast30d: 0,
  });

  const load = useCallback(async () => {
    if (!currentTenant) {
      setLoading(false);
      setSubscription(null);
      setPlan(null);
      setAllPlans([]);
      setFeatures([]);
      setFlags([]);
      setEvents([]);
      setUsage({
        unitsCount: 0,
        professionalsCount: 0,
        activeClientsCount: 0,
        appointmentsLast30d: 0,
      });
      return;
    }

    setLoading(true);
    const sub = await getSubscriptionByTenant(currentTenant.id);
    const plans = await listPlans();
    const currentPlan = sub ? plans.find((item) => item.id === sub.planId) ?? null : null;
    const [planFeatures, tenantFlags, globalFlags, liveUsage, subEvents] = await Promise.all([
      currentPlan ? listPlanFeatures([currentPlan.id]) : Promise.resolve([] as PlanFeature[]),
      listFeatureFlags(currentTenant.id),
      listFeatureFlags(null),
      calculateLiveUsage(currentTenant.id),
      sub ? listSubscriptionEvents(sub.id) : Promise.resolve([] as SubscriptionEvent[]),
    ]);

    setSubscription(sub);
    setPlan(currentPlan);
    setAllPlans(plans);
    setFeatures(planFeatures);
    setFlags(mergeFlags(globalFlags, tenantFlags));
    setEvents(subEvents);
    setUsage(liveUsage);
    setLoading(false);
  }, [currentTenant]);

  useEffect(() => {
    void load();
  }, [load]);

  const featureMap = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const feature of features) map.set(feature.featureKey, feature.value);
    return map;
  }, [features]);

  const flagMap = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const flag of flags) map.set(flag.flagKey, flag.value);
    return map;
  }, [flags]);

  const limits = useMemo(
    () => (plan ? effectiveLimits(plan, subscription?.overrideLimits ?? {}) : null),
    [plan, subscription?.overrideLimits],
  );

  const value = useMemo<TenantBillingContextValue>(() => ({
    loading,
    subscription,
    plan,
    allPlans,
    features,
    flags,
    events,
    usage,
    limits,
    hasFeature: (featureKey: string) => {
      const flagOverride = flagMap.get(featureKey);
      if (flagOverride !== undefined) return isBooleanFeatureEnabled(flagOverride);
      return isBooleanFeatureEnabled(featureMap.get(featureKey));
    },
    flagValue: (flagKey: string) => flagMap.get(flagKey),
    refresh: load,
  }), [loading, subscription, plan, allPlans, features, flags, events, usage, limits, flagMap, featureMap, load]);

  return <TenantBillingContext.Provider value={value}>{children}</TenantBillingContext.Provider>;
}

export function useTenantBillingContext() {
  const ctx = useContext(TenantBillingContext);
  if (!ctx) throw new Error("useTenantBillingContext deve ser usado dentro de <TenantBillingProvider />");
  return ctx;
}

function mergeFlags(globalFlags: FeatureFlag[], tenantFlags: FeatureFlag[]) {
  const map = new Map<string, FeatureFlag>();
  for (const flag of globalFlags) map.set(flag.flagKey, flag);
  for (const flag of tenantFlags) map.set(flag.flagKey, flag);
  return Array.from(map.values()).sort((a, b) => a.flagKey.localeCompare(b.flagKey));
}
