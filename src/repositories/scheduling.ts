/**
 * Repositório da agenda.
 * Concentra TODOS os queries Supabase de appointments, disponibilidade,
 * bloqueios, recursos e lista de espera.
 *
 * UI consome apenas estes métodos (mantém o app portável).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  Appointment,
  AppointmentItem,
  AppointmentSource,
  AppointmentStatus,
  BlockScope,
  ProfessionalAvailability,
  RecurringBlock,
  Resource,
  TimeOffBlock,
  UnitBusinessHour,
  WaitlistEntry,
  WaitlistStatus,
} from "@/domain/scheduling";

// =============================================================================
// MAPPERS
// =============================================================================
const APPOINTMENT_COLS = `
  id, tenant_id, unit_id, client_id, professional_id, resource_id,
  cancellation_policy_id, status, source, starts_at, ends_at,
  duration_minutes, buffer_before_minutes, buffer_after_minutes,
  is_walk_in, is_overbooked, total_price_cents, notes, internal_notes,
  confirmed_at, reminded_at, arrived_at, started_at, completed_at,
  canceled_at, no_show_at, canceled_reason, created_at, updated_at
`;

function toAppointment(r: Record<string, unknown>): Appointment {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    unitId: r.unit_id as string,
    clientId: r.client_id as string,
    professionalId: r.professional_id as string,
    resourceId: (r.resource_id as string) ?? null,
    cancellationPolicyId: (r.cancellation_policy_id as string) ?? null,
    status: r.status as AppointmentStatus,
    source: r.source as AppointmentSource,
    startsAt: r.starts_at as string,
    endsAt: r.ends_at as string,
    durationMinutes: r.duration_minutes as number,
    bufferBeforeMinutes: (r.buffer_before_minutes as number) ?? 0,
    bufferAfterMinutes: (r.buffer_after_minutes as number) ?? 0,
    isWalkIn: Boolean(r.is_walk_in),
    isOverbooked: Boolean(r.is_overbooked),
    totalPriceCents: (r.total_price_cents as number) ?? 0,
    notes: (r.notes as string) ?? null,
    internalNotes: (r.internal_notes as string) ?? null,
    confirmedAt: (r.confirmed_at as string) ?? null,
    remindedAt: (r.reminded_at as string) ?? null,
    arrivedAt: (r.arrived_at as string) ?? null,
    startedAt: (r.started_at as string) ?? null,
    completedAt: (r.completed_at as string) ?? null,
    canceledAt: (r.canceled_at as string) ?? null,
    noShowAt: (r.no_show_at as string) ?? null,
    canceledReason: (r.canceled_reason as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

// =============================================================================
// RESOURCES
// =============================================================================
export async function listResources(tenantId: string, unitId?: string | null): Promise<Resource[]> {
  let q = supabase
    .from("resources")
    .select("id, tenant_id, unit_id, name, description, is_active")
    .eq("tenant_id", tenantId)
    .order("name");
  if (unitId) q = q.or(`unit_id.eq.${unitId},unit_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    unitId: r.unit_id,
    name: r.name,
    description: r.description,
    isActive: r.is_active,
  }));
}

export async function createResource(input: {
  tenantId: string;
  unitId?: string | null;
  name: string;
  description?: string | null;
}): Promise<Resource> {
  const { data, error } = await supabase
    .from("resources")
    .insert({
      tenant_id: input.tenantId,
      unit_id: input.unitId ?? null,
      name: input.name,
      description: input.description ?? null,
    })
    .select("id, tenant_id, unit_id, name, description, is_active")
    .single();
  if (error) throw error;
  return {
    id: data.id, tenantId: data.tenant_id, unitId: data.unit_id,
    name: data.name, description: data.description, isActive: data.is_active,
  };
}

export async function deleteResource(id: string): Promise<void> {
  const { error } = await supabase.from("resources").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// UNIT BUSINESS HOURS
// =============================================================================
export async function listBusinessHours(tenantId: string, unitId: string): Promise<UnitBusinessHour[]> {
  const { data, error } = await supabase
    .from("unit_business_hours")
    .select("id, tenant_id, unit_id, weekday, opens_at, closes_at, is_closed")
    .eq("tenant_id", tenantId)
    .eq("unit_id", unitId)
    .order("weekday");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id, unitId: r.unit_id, weekday: r.weekday,
    opensAt: r.opens_at, closesAt: r.closes_at, isClosed: r.is_closed,
  }));
}

export async function upsertBusinessHour(input: {
  tenantId: string; unitId: string; weekday: number;
  opensAt: string; closesAt: string; isClosed?: boolean;
}): Promise<void> {
  const { error } = await supabase.from("unit_business_hours").upsert(
    {
      tenant_id: input.tenantId,
      unit_id: input.unitId,
      weekday: input.weekday,
      opens_at: input.opensAt,
      closes_at: input.closesAt,
      is_closed: input.isClosed ?? false,
    },
    { onConflict: "tenant_id,unit_id,weekday" },
  );
  if (error) throw error;
}

// =============================================================================
// PROFESSIONAL AVAILABILITY
// =============================================================================
export async function listProfessionalAvailability(
  tenantId: string,
  professionalId?: string,
): Promise<ProfessionalAvailability[]> {
  let q = supabase
    .from("professional_availability")
    .select("id, tenant_id, professional_id, unit_id, weekday, starts_at, ends_at, is_active")
    .eq("tenant_id", tenantId)
    .order("weekday")
    .order("starts_at");
  if (professionalId) q = q.eq("professional_id", professionalId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id, professionalId: r.professional_id,
    unitId: r.unit_id, weekday: r.weekday, startsAt: r.starts_at, endsAt: r.ends_at,
    isActive: r.is_active,
  }));
}

export async function createAvailability(input: {
  tenantId: string; professionalId: string; weekday: number;
  startsAt: string; endsAt: string; unitId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("professional_availability").insert({
    tenant_id: input.tenantId,
    professional_id: input.professionalId,
    weekday: input.weekday,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    unit_id: input.unitId ?? null,
  });
  if (error) throw error;
}

export async function deleteAvailability(id: string): Promise<void> {
  const { error } = await supabase.from("professional_availability").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// TIME OFF BLOCKS (pontuais) e RECURRING BLOCKS (recorrentes)
// =============================================================================
export async function listTimeOff(
  tenantId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<TimeOffBlock[]> {
  const { data, error } = await supabase
    .from("time_off_blocks")
    .select("id, tenant_id, scope, professional_id, unit_id, resource_id, starts_at, ends_at, reason")
    .eq("tenant_id", tenantId)
    .lt("starts_at", rangeEnd)
    .gt("ends_at", rangeStart)
    .order("starts_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id, scope: r.scope as BlockScope,
    professionalId: r.professional_id, unitId: r.unit_id, resourceId: r.resource_id,
    startsAt: r.starts_at, endsAt: r.ends_at, reason: r.reason,
  }));
}

export async function createTimeOff(input: {
  tenantId: string;
  scope: BlockScope;
  startsAt: string;
  endsAt: string;
  reason?: string | null;
  professionalId?: string | null;
  unitId?: string | null;
  resourceId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("time_off_blocks").insert({
    tenant_id: input.tenantId,
    scope: input.scope,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    reason: input.reason ?? null,
    professional_id: input.professionalId ?? null,
    unit_id: input.unitId ?? null,
    resource_id: input.resourceId ?? null,
  });
  if (error) throw error;
}

export async function deleteTimeOff(id: string): Promise<void> {
  const { error } = await supabase.from("time_off_blocks").delete().eq("id", id);
  if (error) throw error;
}

export async function listRecurringBlocks(tenantId: string): Promise<RecurringBlock[]> {
  const { data, error } = await supabase
    .from("recurring_blocks")
    .select("id, tenant_id, professional_id, unit_id, weekday, starts_at, ends_at, reason, is_active")
    .eq("tenant_id", tenantId)
    .order("weekday");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id, professionalId: r.professional_id,
    unitId: r.unit_id, weekday: r.weekday, startsAt: r.starts_at, endsAt: r.ends_at,
    reason: r.reason, isActive: r.is_active,
  }));
}

export async function createRecurringBlock(input: {
  tenantId: string; weekday: number; startsAt: string; endsAt: string;
  professionalId?: string | null; unitId?: string | null; reason?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("recurring_blocks").insert({
    tenant_id: input.tenantId,
    weekday: input.weekday,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    professional_id: input.professionalId ?? null,
    unit_id: input.unitId ?? null,
    reason: input.reason ?? null,
  });
  if (error) throw error;
}

export async function deleteRecurringBlock(id: string): Promise<void> {
  const { error } = await supabase.from("recurring_blocks").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// AVAILABLE SLOTS (RPC)
// =============================================================================
export async function getAvailableSlots(input: {
  tenantId: string;
  professionalId: string;
  unitId: string;
  serviceId: string;
  day: string;              // "YYYY-MM-DD"
  slotStepMinutes?: number;
}): Promise<Array<{ startsAt: string; endsAt: string }>> {
  const { data, error } = await supabase.rpc("get_available_slots", {
    _tenant_id: input.tenantId,
    _professional_id: input.professionalId,
    _unit_id: input.unitId,
    _service_id: input.serviceId,
    _day: input.day,
    _slot_step_minutes: input.slotStepMinutes ?? 15,
  });
  if (error) throw error;
  return (data ?? []).map((r: { slot_start: string; slot_end: string }) => ({
    startsAt: r.slot_start,
    endsAt: r.slot_end,
  }));
}

// =============================================================================
// APPOINTMENTS
// =============================================================================
export interface ListAppointmentsParams {
  tenantId: string;
  unitId?: string | null;
  professionalId?: string | null;
  clientId?: string | null;
  rangeStart: string;       // ISO
  rangeEnd: string;         // ISO
  excludeStatuses?: AppointmentStatus[];
}

export async function listAppointments(params: ListAppointmentsParams): Promise<Appointment[]> {
  let q = supabase
    .from("appointments")
    .select(APPOINTMENT_COLS)
    .eq("tenant_id", params.tenantId)
    .gte("starts_at", params.rangeStart)
    .lt("starts_at", params.rangeEnd)
    .order("starts_at");
  if (params.unitId) q = q.eq("unit_id", params.unitId);
  if (params.professionalId) q = q.eq("professional_id", params.professionalId);
  if (params.clientId) q = q.eq("client_id", params.clientId);
  if (params.excludeStatuses?.length) q = q.not("status", "in", `(${params.excludeStatuses.join(",")})`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => toAppointment(r as Record<string, unknown>));
}

export async function getAppointment(id: string): Promise<Appointment | null> {
  const { data, error } = await supabase
    .from("appointments")
    .select(APPOINTMENT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toAppointment(data as Record<string, unknown>) : null;
}

export interface CreateAppointmentInput {
  tenantId: string;
  unitId: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  startsAt: string;        // ISO
  endsAt: string;          // ISO
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  resourceId?: string | null;
  cancellationPolicyId?: string | null;
  source?: AppointmentSource;
  status?: AppointmentStatus;
  notes?: string | null;
  internalNotes?: string | null;
  totalPriceCents?: number;
  isWalkIn?: boolean;
  isOverbooked?: boolean;
  createdBy?: string | null;
  /** preço do item de serviço (se vazio, usa totalPriceCents). */
  itemPriceCents?: number;
}

export async function insertAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const { data, error } = await supabase
    .from("appointments")
    .insert({
      tenant_id: input.tenantId,
      unit_id: input.unitId,
      client_id: input.clientId,
      professional_id: input.professionalId,
      resource_id: input.resourceId ?? null,
      cancellation_policy_id: input.cancellationPolicyId ?? null,
      status: input.status ?? "pending",
      source: input.source ?? "frontdesk",
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      duration_minutes: input.durationMinutes,
      buffer_before_minutes: input.bufferBeforeMinutes ?? 0,
      buffer_after_minutes: input.bufferAfterMinutes ?? 0,
      is_walk_in: input.isWalkIn ?? false,
      is_overbooked: input.isOverbooked ?? false,
      total_price_cents: input.totalPriceCents ?? 0,
      notes: input.notes ?? null,
      internal_notes: input.internalNotes ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(APPOINTMENT_COLS)
    .single();
  if (error) throw error;
  const created = toAppointment(data as Record<string, unknown>);

  // item de serviço (1 item por agendamento na v1)
  await supabase.from("appointment_items").insert({
    tenant_id: input.tenantId,
    appointment_id: created.id,
    service_id: input.serviceId,
    duration_minutes: input.durationMinutes,
    price_cents: input.itemPriceCents ?? input.totalPriceCents ?? 0,
    position: 0,
  });

  return created;
}

export async function updateAppointment(
  id: string,
  patch: Partial<{
    startsAt: string;
    endsAt: string;
    professionalId: string;
    resourceId: string | null;
    notes: string | null;
    internalNotes: string | null;
    isOverbooked: boolean;
  }>,
): Promise<Appointment> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.startsAt !== undefined) dbPatch.starts_at = patch.startsAt;
  if (patch.endsAt !== undefined) dbPatch.ends_at = patch.endsAt;
  if (patch.professionalId !== undefined) dbPatch.professional_id = patch.professionalId;
  if (patch.resourceId !== undefined) dbPatch.resource_id = patch.resourceId;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.internalNotes !== undefined) dbPatch.internal_notes = patch.internalNotes;
  if (patch.isOverbooked !== undefined) dbPatch.is_overbooked = patch.isOverbooked;
  const { data, error } = await supabase
    .from("appointments")
    .update(dbPatch as never)
    .eq("id", id)
    .select(APPOINTMENT_COLS)
    .single();
  if (error) throw error;
  return toAppointment(data as Record<string, unknown>);
}

export async function setAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  extras?: { reason?: string | null },
): Promise<void> {
  const stamp = new Date().toISOString();
  const dbPatch: Record<string, unknown> = { status };
  if (status === "confirmed") dbPatch.confirmed_at = stamp;
  if (status === "reminded") dbPatch.reminded_at = stamp;
  if (status === "arrived") dbPatch.arrived_at = stamp;
  if (status === "in_service") dbPatch.started_at = stamp;
  if (status === "completed") dbPatch.completed_at = stamp;
  if (status === "canceled") {
    dbPatch.canceled_at = stamp;
    dbPatch.canceled_reason = extras?.reason ?? null;
  }
  if (status === "no_show") dbPatch.no_show_at = stamp;

  const { error } = await supabase
    .from("appointments")
    .update(dbPatch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function listAppointmentItems(appointmentId: string): Promise<AppointmentItem[]> {
  const { data, error } = await supabase
    .from("appointment_items")
    .select("id, appointment_id, service_id, duration_minutes, price_cents, position, notes")
    .eq("appointment_id", appointmentId)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, appointmentId: r.appointment_id, serviceId: r.service_id,
    durationMinutes: r.duration_minutes, priceCents: r.price_cents,
    position: r.position, notes: r.notes,
  }));
}

// =============================================================================
// WAITLIST
// =============================================================================
export async function listWaitlist(tenantId: string, status?: WaitlistStatus): Promise<WaitlistEntry[]> {
  let q = supabase
    .from("waitlist_entries")
    .select(`
      id, tenant_id, unit_id, client_id, service_id, preferred_professional_id,
      desired_from, desired_to, preferred_weekdays, notes, priority, status, created_at
    `)
    .eq("tenant_id", tenantId)
    .order("priority", { ascending: false })
    .order("created_at");
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id, unitId: r.unit_id, clientId: r.client_id,
    serviceId: r.service_id, preferredProfessionalId: r.preferred_professional_id,
    desiredFrom: r.desired_from, desiredTo: r.desired_to,
    preferredWeekdays: (r.preferred_weekdays ?? []) as number[],
    notes: r.notes, priority: r.priority, status: r.status as WaitlistStatus,
    createdAt: r.created_at,
  }));
}

export async function createWaitlistEntry(input: {
  tenantId: string;
  clientId: string;
  unitId?: string | null;
  serviceId?: string | null;
  preferredProfessionalId?: string | null;
  desiredFrom?: string | null;
  desiredTo?: string | null;
  preferredWeekdays?: number[];
  notes?: string | null;
  priority?: number;
}): Promise<void> {
  const { error } = await supabase.from("waitlist_entries").insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    unit_id: input.unitId ?? null,
    service_id: input.serviceId ?? null,
    preferred_professional_id: input.preferredProfessionalId ?? null,
    desired_from: input.desiredFrom ?? null,
    desired_to: input.desiredTo ?? null,
    preferred_weekdays: input.preferredWeekdays ?? [],
    notes: input.notes ?? null,
    priority: input.priority ?? 50,
  });
  if (error) throw error;
}

export async function setWaitlistStatus(id: string, status: WaitlistStatus): Promise<void> {
  const { error } = await supabase
    .from("waitlist_entries")
    .update({ status } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  const { error } = await supabase.from("waitlist_entries").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// HELPERS para UI (combos com clientes/profissionais/serviços)
// =============================================================================
export interface ProfessionalLite {
  id: string;
  displayName: string;
  color: string | null;
  unitId: string | null;
  isActive: boolean;
}

export async function listProfessionalsLite(tenantId: string, unitId?: string | null): Promise<ProfessionalLite[]> {
  let q = supabase
    .from("professionals")
    .select("id, display_name, color, unit_id, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("display_name");
  if (unitId) q = q.or(`unit_id.eq.${unitId},unit_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, displayName: r.display_name, color: r.color, unitId: r.unit_id, isActive: r.is_active,
  }));
}
