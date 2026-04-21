/**
 * Repositório do catálogo.
 * Concentra TODOS os queries Supabase de categorias, serviços, preços,
 * pacotes, assinaturas, protocolos e políticas de cancelamento.
 *
 * UI consome apenas estes métodos — mantém o app portável.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CancellationPolicy,
  Membership,
  MembershipBenefit,
  MembershipBillingCycle,
  Package,
  PackageItem,
  PackageKind,
  Protocol,
  ProtocolSession,
  Service,
  ServiceCategory,
  ServicePrice,
} from "@/domain/catalog";

// =============================================================================
// CATEGORIES
// =============================================================================
const CATEGORY_COLS =
  "id, tenant_id, parent_id, name, description, color, icon, position, is_active";

function toCategory(r: Record<string, unknown>): ServiceCategory {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    parentId: (r.parent_id as string) ?? null,
    name: r.name as string,
    description: (r.description as string) ?? null,
    color: (r.color as string) ?? null,
    icon: (r.icon as string) ?? null,
    position: (r.position as number) ?? 0,
    isActive: Boolean(r.is_active),
  };
}

export async function listCategories(tenantId: string): Promise<ServiceCategory[]> {
  const { data, error } = await supabase
    .from("service_categories")
    .select(CATEGORY_COLS)
    .eq("tenant_id", tenantId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map(toCategory);
}

export async function createCategory(input: {
  tenantId: string;
  name: string;
  parentId?: string | null;
  color?: string | null;
  icon?: string | null;
  description?: string | null;
  position?: number;
}): Promise<ServiceCategory> {
  const { data, error } = await supabase
    .from("service_categories")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      parent_id: input.parentId ?? null,
      color: input.color ?? null,
      icon: input.icon ?? null,
      description: input.description ?? null,
      position: input.position ?? 0,
    })
    .select(CATEGORY_COLS)
    .single();
  if (error) throw error;
  return toCategory(data);
}

export async function updateCategory(id: string, patch: Partial<{
  name: string;
  color: string | null;
  icon: string | null;
  description: string | null;
  position: number;
  isActive: boolean;
}>): Promise<ServiceCategory> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.color !== undefined) dbPatch.color = patch.color;
  if (patch.icon !== undefined) dbPatch.icon = patch.icon;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.position !== undefined) dbPatch.position = patch.position;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  const { data, error } = await supabase
    .from("service_categories")
    .update(dbPatch as never)
    .eq("id", id)
    .select(CATEGORY_COLS)
    .single();
  if (error) throw error;
  return toCategory(data);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from("service_categories").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// SERVICES
// =============================================================================
const SERVICE_COLS =
  "id, tenant_id, category_id, cancellation_policy_id, name, description, internal_code, duration_minutes, buffer_before_minutes, buffer_after_minutes, processing_minutes, min_advance_hours, max_advance_days, ideal_return_window_days, requires_resource, resource_label, eligible_for_package, eligible_for_membership, pre_appointment_instructions, post_appointment_instructions, is_active, is_featured, position";

function toService(r: Record<string, unknown>): Service {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    categoryId: (r.category_id as string) ?? null,
    cancellationPolicyId: (r.cancellation_policy_id as string) ?? null,
    name: r.name as string,
    description: (r.description as string) ?? null,
    internalCode: (r.internal_code as string) ?? null,
    durationMinutes: r.duration_minutes as number,
    bufferBeforeMinutes: r.buffer_before_minutes as number,
    bufferAfterMinutes: r.buffer_after_minutes as number,
    processingMinutes: r.processing_minutes as number,
    minAdvanceHours: r.min_advance_hours as number,
    maxAdvanceDays: r.max_advance_days as number,
    idealReturnWindowDays: (r.ideal_return_window_days as number) ?? null,
    requiresResource: Boolean(r.requires_resource),
    resourceLabel: (r.resource_label as string) ?? null,
    eligibleForPackage: Boolean(r.eligible_for_package),
    eligibleForMembership: Boolean(r.eligible_for_membership),
    preAppointmentInstructions: (r.pre_appointment_instructions as string) ?? null,
    postAppointmentInstructions: (r.post_appointment_instructions as string) ?? null,
    isActive: Boolean(r.is_active),
    isFeatured: Boolean(r.is_featured),
    position: (r.position as number) ?? 0,
  };
}

export interface ListServicesParams {
  tenantId: string;
  search?: string;
  categoryId?: string;
  activeOnly?: boolean;
}

export async function listServices(params: ListServicesParams): Promise<Service[]> {
  let q = supabase
    .from("services")
    .select(SERVICE_COLS)
    .eq("tenant_id", params.tenantId)
    .order("position", { ascending: true })
    .order("name", { ascending: true });
  if (params.search?.trim()) {
    const s = params.search.trim();
    q = q.ilike("name", `%${s}%`);
  }
  if (params.categoryId) q = q.eq("category_id", params.categoryId);
  if (params.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(toService);
}

export async function getService(id: string): Promise<Service | null> {
  const { data, error } = await supabase
    .from("services")
    .select(SERVICE_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toService(data) : null;
}

export interface CreateServiceInput {
  tenantId: string;
  name: string;
  description?: string;
  categoryId?: string | null;
  durationMinutes?: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  processingMinutes?: number;
  minAdvanceHours?: number;
  maxAdvanceDays?: number;
  idealReturnWindowDays?: number | null;
  requiresResource?: boolean;
  resourceLabel?: string | null;
  eligibleForPackage?: boolean;
  eligibleForMembership?: boolean;
  preAppointmentInstructions?: string | null;
  postAppointmentInstructions?: string | null;
  cancellationPolicyId?: string | null;
  isActive?: boolean;
  isFeatured?: boolean;
  internalCode?: string | null;
  /** Preço base em centavos. Se passado, cria registro em service_prices. */
  basePriceCents?: number;
  currency?: string;
}

export async function createService(input: CreateServiceInput): Promise<Service> {
  const { data, error } = await supabase
    .from("services")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      category_id: input.categoryId ?? null,
      duration_minutes: input.durationMinutes ?? 30,
      buffer_before_minutes: input.bufferBeforeMinutes ?? 0,
      buffer_after_minutes: input.bufferAfterMinutes ?? 0,
      processing_minutes: input.processingMinutes ?? 0,
      min_advance_hours: input.minAdvanceHours ?? 0,
      max_advance_days: input.maxAdvanceDays ?? 60,
      ideal_return_window_days: input.idealReturnWindowDays ?? null,
      requires_resource: input.requiresResource ?? false,
      resource_label: input.resourceLabel ?? null,
      eligible_for_package: input.eligibleForPackage ?? true,
      eligible_for_membership: input.eligibleForMembership ?? true,
      pre_appointment_instructions: input.preAppointmentInstructions ?? null,
      post_appointment_instructions: input.postAppointmentInstructions ?? null,
      cancellation_policy_id: input.cancellationPolicyId ?? null,
      is_active: input.isActive ?? true,
      is_featured: input.isFeatured ?? false,
      internal_code: input.internalCode ?? null,
    })
    .select(SERVICE_COLS)
    .single();
  if (error) throw error;
  const created = toService(data);
  if (input.basePriceCents !== undefined) {
    await supabase.from("service_prices").insert({
      tenant_id: input.tenantId,
      service_id: created.id,
      currency: input.currency ?? "BRL",
      amount_cents: input.basePriceCents,
      is_default: true,
    });
  }
  return created;
}

export type UpdateServiceInput = Partial<Omit<CreateServiceInput, "tenantId">>;

export async function updateService(id: string, patch: UpdateServiceInput): Promise<Service> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.categoryId !== undefined) dbPatch.category_id = patch.categoryId;
  if (patch.durationMinutes !== undefined) dbPatch.duration_minutes = patch.durationMinutes;
  if (patch.bufferBeforeMinutes !== undefined) dbPatch.buffer_before_minutes = patch.bufferBeforeMinutes;
  if (patch.bufferAfterMinutes !== undefined) dbPatch.buffer_after_minutes = patch.bufferAfterMinutes;
  if (patch.processingMinutes !== undefined) dbPatch.processing_minutes = patch.processingMinutes;
  if (patch.minAdvanceHours !== undefined) dbPatch.min_advance_hours = patch.minAdvanceHours;
  if (patch.maxAdvanceDays !== undefined) dbPatch.max_advance_days = patch.maxAdvanceDays;
  if (patch.idealReturnWindowDays !== undefined) dbPatch.ideal_return_window_days = patch.idealReturnWindowDays;
  if (patch.requiresResource !== undefined) dbPatch.requires_resource = patch.requiresResource;
  if (patch.resourceLabel !== undefined) dbPatch.resource_label = patch.resourceLabel;
  if (patch.eligibleForPackage !== undefined) dbPatch.eligible_for_package = patch.eligibleForPackage;
  if (patch.eligibleForMembership !== undefined) dbPatch.eligible_for_membership = patch.eligibleForMembership;
  if (patch.preAppointmentInstructions !== undefined) dbPatch.pre_appointment_instructions = patch.preAppointmentInstructions;
  if (patch.postAppointmentInstructions !== undefined) dbPatch.post_appointment_instructions = patch.postAppointmentInstructions;
  if (patch.cancellationPolicyId !== undefined) dbPatch.cancellation_policy_id = patch.cancellationPolicyId;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (patch.isFeatured !== undefined) dbPatch.is_featured = patch.isFeatured;
  if (patch.internalCode !== undefined) dbPatch.internal_code = patch.internalCode;

  const { data, error } = await supabase
    .from("services")
    .update(dbPatch as never)
    .eq("id", id)
    .select(SERVICE_COLS)
    .single();
  if (error) throw error;
  const updated = toService(data);

  if (patch.basePriceCents !== undefined) {
    // upsert do preço base
    const { data: existing } = await supabase
      .from("service_prices")
      .select("id")
      .eq("service_id", id)
      .eq("is_default", true)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("service_prices")
        .update({ amount_cents: patch.basePriceCents } as never)
        .eq("id", existing.id);
    } else {
      await supabase.from("service_prices").insert({
        tenant_id: updated.tenantId,
        service_id: id,
        currency: patch.currency ?? "BRL",
        amount_cents: patch.basePriceCents,
        is_default: true,
      });
    }
  }
  return updated;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from("services").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// SERVICE PRICES (preço base + lookup)
// =============================================================================
export async function listBasePrices(tenantId: string): Promise<Map<string, ServicePrice>> {
  const { data, error } = await supabase
    .from("service_prices")
    .select("id, service_id, currency, amount_cents, is_default")
    .eq("tenant_id", tenantId)
    .eq("is_default", true);
  if (error) throw error;
  const map = new Map<string, ServicePrice>();
  (data ?? []).forEach((r) => {
    map.set(r.service_id, {
      id: r.id,
      serviceId: r.service_id,
      currency: r.currency,
      amountCents: r.amount_cents,
      isDefault: r.is_default,
    });
  });
  return map;
}

// =============================================================================
// PACKAGES
// =============================================================================
const PACKAGE_COLS =
  "id, tenant_id, kind, name, description, price_cents, validity_days, recommended_interval_days, usage_rules, notes, is_active";

function toPackage(r: Record<string, unknown>): Package {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    kind: r.kind as PackageKind,
    name: r.name as string,
    description: (r.description as string) ?? null,
    priceCents: (r.price_cents as number) ?? 0,
    validityDays: (r.validity_days as number) ?? null,
    recommendedIntervalDays: (r.recommended_interval_days as number) ?? null,
    usageRules: (r.usage_rules as string) ?? null,
    notes: (r.notes as string) ?? null,
    isActive: Boolean(r.is_active),
  };
}

export async function listPackages(tenantId: string): Promise<Package[]> {
  const { data, error } = await supabase
    .from("packages")
    .select(PACKAGE_COLS)
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(toPackage);
}

export interface CreatePackageInput {
  tenantId: string;
  name: string;
  kind?: PackageKind;
  description?: string;
  priceCents?: number;
  validityDays?: number | null;
  recommendedIntervalDays?: number | null;
  usageRules?: string;
  notes?: string;
  isActive?: boolean;
  items?: Array<{ serviceId: string; sessions: number }>;
}

export async function createPackage(input: CreatePackageInput): Promise<Package> {
  const { data, error } = await supabase
    .from("packages")
    .insert({
      tenant_id: input.tenantId,
      kind: input.kind ?? "package",
      name: input.name,
      description: input.description ?? null,
      price_cents: input.priceCents ?? 0,
      validity_days: input.validityDays ?? null,
      recommended_interval_days: input.recommendedIntervalDays ?? null,
      usage_rules: input.usageRules ?? null,
      notes: input.notes ?? null,
      is_active: input.isActive ?? true,
    })
    .select(PACKAGE_COLS)
    .single();
  if (error) throw error;
  const created = toPackage(data);
  if (input.items?.length) {
    const rows = input.items.map((it, idx) => ({
      tenant_id: input.tenantId,
      package_id: created.id,
      service_id: it.serviceId,
      sessions: it.sessions,
      position: idx,
    }));
    await supabase.from("package_items").insert(rows);
  }
  return created;
}

export async function updatePackage(id: string, patch: Partial<CreatePackageInput>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.kind !== undefined) dbPatch.kind = patch.kind;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.priceCents !== undefined) dbPatch.price_cents = patch.priceCents;
  if (patch.validityDays !== undefined) dbPatch.validity_days = patch.validityDays;
  if (patch.recommendedIntervalDays !== undefined) dbPatch.recommended_interval_days = patch.recommendedIntervalDays;
  if (patch.usageRules !== undefined) dbPatch.usage_rules = patch.usageRules;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (Object.keys(dbPatch).length) {
    const { error } = await supabase.from("packages").update(dbPatch as never).eq("id", id);
    if (error) throw error;
  }
}

export async function deletePackage(id: string): Promise<void> {
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;
}

export async function listPackageItems(packageId: string): Promise<PackageItem[]> {
  const { data, error } = await supabase
    .from("package_items")
    .select("id, package_id, service_id, sessions, position")
    .eq("package_id", packageId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    packageId: r.package_id,
    serviceId: r.service_id,
    sessions: r.sessions,
    position: r.position,
  }));
}

// =============================================================================
// MEMBERSHIPS
// =============================================================================
const MEMBERSHIP_COLS =
  "id, tenant_id, name, description, price_cents, billing_cycle, is_active, notes";

function toMembership(r: Record<string, unknown>): Membership {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    priceCents: (r.price_cents as number) ?? 0,
    billingCycle: r.billing_cycle as MembershipBillingCycle,
    isActive: Boolean(r.is_active),
    notes: (r.notes as string) ?? null,
  };
}

export async function listMemberships(tenantId: string): Promise<Membership[]> {
  const { data, error } = await supabase
    .from("memberships")
    .select(MEMBERSHIP_COLS)
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(toMembership);
}

export interface CreateMembershipInput {
  tenantId: string;
  name: string;
  description?: string;
  priceCents?: number;
  billingCycle?: MembershipBillingCycle;
  isActive?: boolean;
  notes?: string;
  benefits?: Array<{ serviceId: string; sessionsPerCycle: number; discountPct?: number }>;
}

export async function createMembership(input: CreateMembershipInput): Promise<Membership> {
  const { data, error } = await supabase
    .from("memberships")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      price_cents: input.priceCents ?? 0,
      billing_cycle: input.billingCycle ?? "monthly",
      is_active: input.isActive ?? true,
      notes: input.notes ?? null,
    })
    .select(MEMBERSHIP_COLS)
    .single();
  if (error) throw error;
  const created = toMembership(data);
  if (input.benefits?.length) {
    const rows = input.benefits.map((b) => ({
      tenant_id: input.tenantId,
      membership_id: created.id,
      service_id: b.serviceId,
      sessions_per_cycle: b.sessionsPerCycle,
      discount_pct: b.discountPct ?? 0,
    }));
    await supabase.from("membership_benefits").insert(rows);
  }
  return created;
}

export async function updateMembership(id: string, patch: Partial<CreateMembershipInput>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.priceCents !== undefined) dbPatch.price_cents = patch.priceCents;
  if (patch.billingCycle !== undefined) dbPatch.billing_cycle = patch.billingCycle;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (Object.keys(dbPatch).length) {
    const { error } = await supabase.from("memberships").update(dbPatch as never).eq("id", id);
    if (error) throw error;
  }
}

export async function deleteMembership(id: string): Promise<void> {
  const { error } = await supabase.from("memberships").delete().eq("id", id);
  if (error) throw error;
}

export async function listMembershipBenefits(membershipId: string): Promise<MembershipBenefit[]> {
  const { data, error } = await supabase
    .from("membership_benefits")
    .select("id, membership_id, service_id, sessions_per_cycle, discount_pct")
    .eq("membership_id", membershipId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    membershipId: r.membership_id,
    serviceId: r.service_id,
    sessionsPerCycle: r.sessions_per_cycle,
    discountPct: r.discount_pct,
  }));
}

// =============================================================================
// PROTOCOLS
// =============================================================================
const PROTOCOL_COLS =
  "id, tenant_id, name, description, total_sessions, recommended_interval_days, total_price_cents, pre_instructions, post_instructions, is_active";

function toProtocol(r: Record<string, unknown>): Protocol {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    totalSessions: (r.total_sessions as number) ?? 1,
    recommendedIntervalDays: (r.recommended_interval_days as number) ?? null,
    totalPriceCents: (r.total_price_cents as number) ?? null,
    preInstructions: (r.pre_instructions as string) ?? null,
    postInstructions: (r.post_instructions as string) ?? null,
    isActive: Boolean(r.is_active),
  };
}

export async function listProtocols(tenantId: string): Promise<Protocol[]> {
  const { data, error } = await supabase
    .from("protocols")
    .select(PROTOCOL_COLS)
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(toProtocol);
}

export interface CreateProtocolInput {
  tenantId: string;
  name: string;
  description?: string;
  totalSessions?: number;
  recommendedIntervalDays?: number | null;
  totalPriceCents?: number | null;
  preInstructions?: string;
  postInstructions?: string;
  isActive?: boolean;
  steps?: Array<{ serviceId: string; intervalDays?: number; notes?: string }>;
}

export async function createProtocol(input: CreateProtocolInput): Promise<Protocol> {
  const { data, error } = await supabase
    .from("protocols")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      description: input.description ?? null,
      total_sessions: input.totalSessions ?? input.steps?.length ?? 1,
      recommended_interval_days: input.recommendedIntervalDays ?? null,
      total_price_cents: input.totalPriceCents ?? null,
      pre_instructions: input.preInstructions ?? null,
      post_instructions: input.postInstructions ?? null,
      is_active: input.isActive ?? true,
    })
    .select(PROTOCOL_COLS)
    .single();
  if (error) throw error;
  const created = toProtocol(data);
  if (input.steps?.length) {
    const rows = input.steps.map((s, idx) => ({
      tenant_id: input.tenantId,
      protocol_id: created.id,
      service_id: s.serviceId,
      step: idx + 1,
      interval_days: s.intervalDays ?? null,
      notes: s.notes ?? null,
    }));
    await supabase.from("protocol_sessions").insert(rows);
  }
  return created;
}

export async function updateProtocol(id: string, patch: Partial<CreateProtocolInput>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.description !== undefined) dbPatch.description = patch.description;
  if (patch.totalSessions !== undefined) dbPatch.total_sessions = patch.totalSessions;
  if (patch.recommendedIntervalDays !== undefined) dbPatch.recommended_interval_days = patch.recommendedIntervalDays;
  if (patch.totalPriceCents !== undefined) dbPatch.total_price_cents = patch.totalPriceCents;
  if (patch.preInstructions !== undefined) dbPatch.pre_instructions = patch.preInstructions;
  if (patch.postInstructions !== undefined) dbPatch.post_instructions = patch.postInstructions;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (Object.keys(dbPatch).length) {
    const { error } = await supabase.from("protocols").update(dbPatch as never).eq("id", id);
    if (error) throw error;
  }
}

export async function deleteProtocol(id: string): Promise<void> {
  const { error } = await supabase.from("protocols").delete().eq("id", id);
  if (error) throw error;
}

export async function listProtocolSessions(protocolId: string): Promise<ProtocolSession[]> {
  const { data, error } = await supabase
    .from("protocol_sessions")
    .select("id, protocol_id, service_id, step, interval_days, notes")
    .eq("protocol_id", protocolId)
    .order("step");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    protocolId: r.protocol_id,
    serviceId: r.service_id,
    step: r.step,
    intervalDays: r.interval_days,
    notes: r.notes,
  }));
}

// =============================================================================
// CANCELLATION POLICIES
// =============================================================================
const POLICY_COLS =
  "id, tenant_id, name, description, hours_before_no_charge, late_cancel_fee_pct, no_show_fee_pct, is_default";

function toPolicy(r: Record<string, unknown>): CancellationPolicy {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    hoursBeforeNoCharge: r.hours_before_no_charge as number,
    lateCancelFeePct: r.late_cancel_fee_pct as number,
    noShowFeePct: r.no_show_fee_pct as number,
    isDefault: Boolean(r.is_default),
  };
}

export async function listCancellationPolicies(tenantId: string): Promise<CancellationPolicy[]> {
  const { data, error } = await supabase
    .from("cancellation_policies")
    .select(POLICY_COLS)
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map(toPolicy);
}
