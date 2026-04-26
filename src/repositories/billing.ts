/**
 * Repositório de billing SaaS administrativo.
 *
 * Acessa as tabelas plans / plan_features / tenant_subscriptions /
 * subscription_events / feature_flags / usage_snapshots / segment_templates.
 *
 * Tudo aqui é desacoplado de provider de pagamento. Mutações sensíveis
 * exigem super admin (RLS já garante).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  FeatureFlag,
  Plan,
  PlanFeature,
  SegmentTemplate,
  SubscriptionEvent,
  SubscriptionEventType,
  SubscriptionStatus,
  TenantSubscription,
  UsageSnapshot,
} from "@/domain/billing";
import type { TenantSegment } from "@/domain/tenant";

// ---------- mappers ----------
function rowToPlan(r: Record<string, unknown>): Plan {
  return {
    id: r.id as string,
    code: r.code as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    billingPeriod: r.billing_period as Plan["billingPeriod"],
    priceCents: r.price_cents as number,
    currency: (r.currency as string) ?? "BRL",
    trialDays: r.trial_days as number,
    gracePeriodDays: r.grace_period_days as number,
    maxUnits: (r.max_units as number) ?? null,
    maxProfessionals: (r.max_professionals as number) ?? null,
    maxActiveClients: (r.max_active_clients as number) ?? null,
    maxStorageMb: (r.max_storage_mb as number) ?? null,
    maxAppointmentsMonth: (r.max_appointments_month as number) ?? null,
    status: r.status as Plan["status"],
    isDefault: Boolean(r.is_default),
    features: (r.features as Record<string, boolean>) ?? {},
    displayOrder: r.display_order as number,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function rowToFeature(r: Record<string, unknown>): PlanFeature {
  return {
    id: r.id as string,
    planId: r.plan_id as string,
    featureKey: r.feature_key as string,
    label: r.label as string,
    valueType: r.value_type as PlanFeature["valueType"],
    value: r.value,
    displayOrder: r.display_order as number,
  };
}

function rowToSub(r: Record<string, unknown>): TenantSubscription {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    planId: r.plan_id as string,
    status: r.status as SubscriptionStatus,
    trialStartedAt: (r.trial_started_at as string) ?? null,
    trialEndsAt: (r.trial_ends_at as string) ?? null,
    currentPeriodStart: r.current_period_start as string,
    currentPeriodEnd: (r.current_period_end as string) ?? null,
    canceledAt: (r.canceled_at as string) ?? null,
    suspendedAt: (r.suspended_at as string) ?? null,
    overdueSince: (r.overdue_since as string) ?? null,
    discountCents: (r.discount_cents as number) ?? 0,
    discountReason: (r.discount_reason as string) ?? null,
    overrideLimits: ((r.override_limits as Record<string, number | null>) ?? {}),
    notes: (r.notes as string) ?? null,
  };
}

function rowToEvent(r: Record<string, unknown>): SubscriptionEvent {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    subscriptionId: (r.subscription_id as string) ?? null,
    eventType: r.event_type as SubscriptionEventType,
    fromPlanId: (r.from_plan_id as string) ?? null,
    toPlanId: (r.to_plan_id as string) ?? null,
    fromStatus: (r.from_status as SubscriptionStatus) ?? null,
    toStatus: (r.to_status as SubscriptionStatus) ?? null,
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
  };
}

function rowToFlag(r: Record<string, unknown>): FeatureFlag {
  return {
    id: r.id as string,
    tenantId: (r.tenant_id as string) ?? null,
    flagKey: r.flag_key as string,
    label: r.label as string,
    description: (r.description as string) ?? null,
    valueType: r.value_type as FeatureFlag["valueType"],
    value: r.value,
    isGlobal: Boolean(r.is_global),
  };
}

function rowToTemplate(r: Record<string, unknown>): SegmentTemplate {
  return {
    id: r.id as string,
    segment: r.segment as TenantSegment,
    name: r.name as string,
    description: (r.description as string) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    isDefault: Boolean(r.is_default),
    isActive: Boolean(r.is_active),
    displayOrder: r.display_order as number,
  };
}

// ---------- plans ----------
export async function listPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("display_order");
  if (error) throw error;
  return (data ?? []).map(rowToPlan);
}

export async function listPlanFeatures(planIds: string[]): Promise<PlanFeature[]> {
  if (planIds.length === 0) return [];
  const { data, error } = await supabase
    .from("plan_features")
    .select("*")
    .in("plan_id", planIds)
    .order("display_order");
  if (error) throw error;
  return (data ?? []).map(rowToFeature);
}

export async function upsertPlan(plan: Partial<Plan> & { code: string; name: string }) {
  const { error } = await supabase.from("plans").upsert(
    {
      code: plan.code,
      name: plan.name,
      description: plan.description ?? null,
      billing_period: plan.billingPeriod ?? "monthly",
      price_cents: plan.priceCents ?? 0,
      trial_days: plan.trialDays ?? 14,
      grace_period_days: plan.gracePeriodDays ?? 7,
      max_units: plan.maxUnits ?? null,
      max_professionals: plan.maxProfessionals ?? null,
      max_active_clients: plan.maxActiveClients ?? null,
      max_storage_mb: plan.maxStorageMb ?? null,
      max_appointments_month: plan.maxAppointmentsMonth ?? null,
      status: plan.status ?? "public",
      is_default: plan.isDefault ?? false,
      display_order: plan.displayOrder ?? 0,
    },
    { onConflict: "code" },
  );
  if (error) throw error;
}

export async function archivePlan(planId: string) {
  const { error } = await supabase.from("plans").update({ status: "archived" }).eq("id", planId);
  if (error) throw error;
}

export async function upsertPlanFeature(feature: {
  id?: string;
  planId: string;
  featureKey: string;
  label: string;
  valueType: PlanFeature["valueType"];
  value: unknown;
  displayOrder?: number;
}) {
  if (feature.id) {
    const { error } = await supabase
      .from("plan_features")
      .update({
        feature_key: feature.featureKey,
        label: feature.label,
        value_type: feature.valueType,
        value: feature.value as never,
        display_order: feature.displayOrder ?? 0,
      })
      .eq("id", feature.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("plan_features").insert({
    plan_id: feature.planId,
    feature_key: feature.featureKey,
    label: feature.label,
    value_type: feature.valueType,
    value: feature.value as never,
    display_order: feature.displayOrder ?? 0,
  });
  if (error) throw error;
}

export async function deletePlanFeature(featureId: string) {
  const { error } = await supabase.from("plan_features").delete().eq("id", featureId);
  if (error) throw error;
}

// ---------- subscriptions ----------
export async function listAllSubscriptions(): Promise<TenantSubscription[]> {
  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToSub);
}

export async function getSubscriptionByTenant(tenantId: string): Promise<TenantSubscription | null> {
  const { data, error } = await supabase
    .from("tenant_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSub(data) : null;
}

export async function listSubscriptionEvents(subscriptionId: string): Promise<SubscriptionEvent[]> {
  const { data, error } = await supabase
    .from("subscription_events")
    .select("*")
    .eq("subscription_id", subscriptionId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map(rowToEvent);
}

export async function setSubscriptionStatus(input: {
  subscriptionId: string;
  tenantId: string;
  newStatus: SubscriptionStatus;
  fromStatus: SubscriptionStatus;
  notes?: string;
}) {
  const now = new Date().toISOString();
  const patch: {
    status: SubscriptionStatus;
    canceled_at?: string | null;
    suspended_at?: string | null;
    overdue_since?: string | null;
  } = { status: input.newStatus };
  if (input.newStatus === "canceled") patch.canceled_at = now;
  if (input.newStatus === "suspended") patch.suspended_at = now;
  if (input.newStatus === "overdue") patch.overdue_since = now;
  if (input.newStatus === "active") {
    patch.canceled_at = null;
    patch.suspended_at = null;
    patch.overdue_since = null;
  }
  const { error } = await supabase
    .from("tenant_subscriptions")
    .update(patch)
    .eq("id", input.subscriptionId);
  if (error) throw error;

  await supabase.from("subscription_events").insert({
    tenant_id: input.tenantId,
    subscription_id: input.subscriptionId,
    event_type:
      input.newStatus === "canceled"
        ? "canceled"
        : input.newStatus === "suspended"
        ? "suspended"
        : input.newStatus === "active"
        ? input.fromStatus === "suspended"
          ? "reactivated"
          : "activated"
        : input.newStatus === "overdue"
        ? "overdue"
        : "note",
    from_status: input.fromStatus,
    to_status: input.newStatus,
    notes: input.notes ?? null,
  });
}

export async function changeSubscriptionPlan(input: {
  subscriptionId: string;
  tenantId: string;
  fromPlanId: string;
  toPlanId: string;
  isUpgrade: boolean;
  notes?: string;
}) {
  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({ plan_id: input.toPlanId })
    .eq("id", input.subscriptionId);
  if (error) throw error;

  await supabase.from("subscription_events").insert({
    tenant_id: input.tenantId,
    subscription_id: input.subscriptionId,
    event_type: input.isUpgrade ? "upgraded" : "downgraded",
    from_plan_id: input.fromPlanId,
    to_plan_id: input.toPlanId,
    notes: input.notes ?? null,
  });
}

export async function extendTrial(input: {
  subscriptionId: string;
  tenantId: string;
  newTrialEndsAt: string;
  notes?: string;
}) {
  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({ trial_ends_at: input.newTrialEndsAt, status: "trialing" })
    .eq("id", input.subscriptionId);
  if (error) throw error;
  await supabase.from("subscription_events").insert({
    tenant_id: input.tenantId,
    subscription_id: input.subscriptionId,
    event_type: "trial_extended",
    notes: input.notes ?? null,
  });
}

export async function setOverrideLimits(input: {
  subscriptionId: string;
  tenantId: string;
  override: Record<string, number | null>;
}) {
  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({ override_limits: input.override })
    .eq("id", input.subscriptionId);
  if (error) throw error;
  await supabase.from("subscription_events").insert({
    tenant_id: input.tenantId,
    subscription_id: input.subscriptionId,
    event_type: "note",
    notes: `Override de limites atualizado: ${JSON.stringify(input.override)}`,
  });
}

export async function setDiscount(input: {
  subscriptionId: string;
  tenantId: string;
  discountCents: number;
  discountReason: string | null;
}) {
  const { error } = await supabase
    .from("tenant_subscriptions")
    .update({ discount_cents: input.discountCents, discount_reason: input.discountReason })
    .eq("id", input.subscriptionId);
  if (error) throw error;
  await supabase.from("subscription_events").insert({
    tenant_id: input.tenantId,
    subscription_id: input.subscriptionId,
    event_type: "note",
    notes: `Desconto aplicado: ${input.discountCents / 100} (${input.discountReason ?? "sem motivo"})`,
  });
}

// ---------- feature flags ----------
export async function listFeatureFlags(tenantId: string | null): Promise<FeatureFlag[]> {
  let query = supabase.from("feature_flags").select("*").order("flag_key");
  if (tenantId === null) {
    query = query.is("tenant_id", null);
  } else {
    query = query.eq("tenant_id", tenantId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToFlag);
}

export async function listAllFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase
    .from("feature_flags")
    .select("*")
    .order("is_global", { ascending: false })
    .order("flag_key");
  if (error) throw error;
  return (data ?? []).map(rowToFlag);
}

export async function setFeatureFlagValue(flagId: string, value: unknown) {
  const { error } = await supabase
    .from("feature_flags")
    .update({ value: value as never })
    .eq("id", flagId);
  if (error) throw error;
}

export async function upsertFeatureFlag(flag: {
  id?: string;
  tenantId: string | null;
  flagKey: string;
  label: string;
  description?: string | null;
  valueType: FeatureFlag["valueType"];
  value: unknown;
  isGlobal: boolean;
}) {
  if (flag.id) {
    const { error } = await supabase
      .from("feature_flags")
      .update({
        tenant_id: flag.tenantId,
        flag_key: flag.flagKey,
        label: flag.label,
        description: flag.description ?? null,
        value_type: flag.valueType,
        value: flag.value as never,
        is_global: flag.isGlobal,
      })
      .eq("id", flag.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("feature_flags").insert({
    tenant_id: flag.tenantId,
    flag_key: flag.flagKey,
    label: flag.label,
    description: flag.description ?? null,
    value_type: flag.valueType,
    value: flag.value as never,
    is_global: flag.isGlobal,
  });
  if (error) throw error;
}

export async function deleteFeatureFlag(flagId: string) {
  const { error } = await supabase.from("feature_flags").delete().eq("id", flagId);
  if (error) throw error;
}

// ---------- usage ----------
export async function latestUsage(tenantId: string): Promise<UsageSnapshot | null> {
  const { data, error } = await supabase
    .from("usage_snapshots")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    tenantId: data.tenant_id as string,
    capturedAt: data.captured_at as string,
    unitsCount: data.units_count as number,
    professionalsCount: data.professionals_count as number,
    activeClientsCount: data.active_clients_count as number,
    storageMb: Number(data.storage_mb ?? 0),
    appointmentsLast30d: data.appointments_last_30d as number,
  };
}

/**
 * Calcula uso atual do tenant em tempo real (sem snapshot pronto).
 * Usado quando ainda não há snapshot para mostrar algo verdadeiro.
 */
export async function calculateLiveUsage(
  tenantId: string,
): Promise<
  Pick<
    UsageSnapshot,
    "unitsCount" | "professionalsCount" | "activeClientsCount" | "appointmentsLast30d" | "storageMb"
  >
> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [u, p, c, a, storageUsage] = await Promise.all([
    supabase.from("units").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("is_active", true),
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "active"),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).gte("starts_at", since),
    supabase.rpc("tenant_storage_bytes_used", { _tenant_id: tenantId }),
  ]);

  if (storageUsage.error) throw storageUsage.error;

  const storageBytes = Number(storageUsage.data ?? 0);
  const storageMb = Math.round((storageBytes / (1024 * 1024)) * 100) / 100;

  return {
    unitsCount: u.count ?? 0,
    professionalsCount: p.count ?? 0,
    activeClientsCount: c.count ?? 0,
    appointmentsLast30d: a.count ?? 0,
    storageMb,
  };
}

// ---------- segment templates ----------
export async function listSegmentTemplates(segment?: TenantSegment): Promise<SegmentTemplate[]> {
  let q = supabase.from("segment_templates").select("*").order("display_order");
  if (segment) q = q.eq("segment", segment);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(rowToTemplate);
}

export async function upsertSegmentTemplate(t: Partial<SegmentTemplate> & { segment: TenantSegment; name: string }) {
  const payload = {
    segment: t.segment,
    name: t.name,
    description: t.description ?? null,
    payload: (t.payload as never) ?? {},
    is_default: t.isDefault ?? false,
    is_active: t.isActive ?? true,
    display_order: t.displayOrder ?? 0,
  };
  const query = t.id
    ? supabase.from("segment_templates").update(payload).eq("id", t.id)
    : supabase.from("segment_templates").insert(payload);
  const { error } = await query;
  if (error) throw error;
}

export async function deleteSegmentTemplate(templateId: string) {
  const { error } = await supabase.from("segment_templates").delete().eq("id", templateId);
  if (error) throw error;
}

// ---------- listagem de tenants p/ super admin ----------
export interface TenantWithSub {
  id: string;
  name: string;
  slug: string;
  segment: TenantSegment;
  status: string;
  createdAt: string;
  subscription: TenantSubscription | null;
  planName: string | null;
}

export async function listTenantsWithSubscriptions(): Promise<TenantWithSub[]> {
  const [tenantsRes, subsRes, plansRes] = await Promise.all([
    supabase.from("tenants").select("id, name, slug, segment, status, created_at").order("created_at", { ascending: false }),
    supabase.from("tenant_subscriptions").select("*"),
    supabase.from("plans").select("id, name"),
  ]);
  if (tenantsRes.error) throw tenantsRes.error;
  if (subsRes.error) throw subsRes.error;
  if (plansRes.error) throw plansRes.error;

  const planMap = new Map((plansRes.data ?? []).map((p) => [p.id as string, p.name as string]));
  const subMap = new Map((subsRes.data ?? []).map((s) => [s.tenant_id as string, rowToSub(s)]));

  return (tenantsRes.data ?? []).map((t) => {
    const sub = subMap.get(t.id as string) ?? null;
    return {
      id: t.id as string,
      name: t.name as string,
      slug: t.slug as string,
      segment: t.segment as TenantSegment,
      status: t.status as string,
      createdAt: t.created_at as string,
      subscription: sub,
      planName: sub ? planMap.get(sub.planId) ?? null : null,
    };
  });
}

// ---------- logs de ativação de trial ----------

export type TrialLogStatus = "success" | "already_existed" | "failure";
export type TrialLogReason =
  | "rls_denied"
  | "no_plan"
  | "unauthenticated"
  | "unknown"
  | null;

export interface TrialActivationLog {
  id: string;
  createdAt: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  status: TrialLogStatus;
  reason: TrialLogReason;
  errorMessage: string | null;
  errorCode: string | null;
  recommendedAction: string | null;
  metadata: Record<string, unknown>;
}

/**
 * Lista as últimas tentativas de ativação de trial registradas em
 * audit_logs. RLS garante que apenas owner/manager do tenant ou
 * super_admin enxergam essas linhas.
 */
export async function listTrialActivationLogs(opts: {
  limit?: number;
  status?: TrialLogStatus | "all";
  tenantId?: string | null;
} = {}): Promise<TrialActivationLog[]> {
  const limit = opts.limit ?? 100;
  let q = supabase
    .from("audit_logs")
    .select("id, created_at, tenant_id, actor_id, action, metadata")
    .like("action", "trial.activation.%")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts.status && opts.status !== "all") {
    q = q.eq("action", `trial.activation.${opts.status}`);
  }
  if (opts.tenantId) {
    q = q.eq("tenant_id", opts.tenantId);
  }

  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];

  // Carrega tenants e profiles dos atores em paralelo para enriquecer.
  const tenantIds = Array.from(
    new Set(rows.map((r) => r.tenant_id).filter((v): v is string => Boolean(v))),
  );
  const actorIds = Array.from(
    new Set(rows.map((r) => r.actor_id).filter((v): v is string => Boolean(v))),
  );

  const tenantMap = new Map<string, { name: string; slug: string }>();
  if (tenantIds.length > 0) {
    const { data: tenantsData } = await supabase
      .from("tenants")
      .select("id, name, slug")
      .in("id", tenantIds);
    for (const t of tenantsData ?? []) {
      tenantMap.set(t.id as string, { name: t.name as string, slug: t.slug as string });
    }
  }

  const profileMap = new Map<string, { name: string | null }>();
  if (actorIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds);
    for (const p of profilesData ?? []) {
      profileMap.set(p.id as string, {
        name: (p.full_name as string) ?? null,
      });
    }
  }

  return rows.map<TrialActivationLog>((r) => {
    const meta = (r.metadata ?? {}) as Record<string, unknown>;
    const action = r.action as string;
    const status: TrialLogStatus = action.endsWith("success")
      ? "success"
      : action.endsWith("already_existed")
        ? "already_existed"
        : "failure";
    const tenant = r.tenant_id ? tenantMap.get(r.tenant_id) ?? null : null;
    const profile = r.actor_id ? profileMap.get(r.actor_id) ?? null : null;
    return {
      id: r.id as string,
      createdAt: r.created_at as string,
      tenantId: (r.tenant_id as string) ?? null,
      tenantName: tenant?.name ?? null,
      tenantSlug: tenant?.slug ?? null,
      actorId: (r.actor_id as string) ?? null,
      actorEmail: null,
      actorName: profile?.name ?? null,
      status,
      reason: (meta.reason as TrialLogReason) ?? null,
      errorMessage: (meta.error_message as string) ?? null,
      errorCode: (meta.error_code as string) ?? null,
      recommendedAction: (meta.recommended_action as string) ?? null,
      metadata: meta,
    };
  });
}

