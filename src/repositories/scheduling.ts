/**
 * Repositório da agenda (resources, business hours, availability,
 * blocks, appointments, waitlist). UI consome apenas estes métodos.
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
  ResourceType,
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
const RESOURCE_COLS = "id, tenant_id, unit_id, name, resource_type, color, notes, is_active";

export async function listResources(tenantId: string, unitId?: string | null): Promise<Resource[]> {
  let q = supabase
    .from("resources")
    .select(RESOURCE_COLS)
    .eq("tenant_id", tenantId)
    .order("name");
  if (unitId) q = q.and(`unit_id.eq.${unitId},unit_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id, unitId: r.unit_id, name: r.name,
    resourceType: r.resource_type as ResourceType, color: r.color, notes: r.notes,
    isActive: r.is_active,
  }));
}

export async function createResource(input: {
  tenantId: string;
  name: string;
  resourceType?: ResourceType;
  unitId?: string | null;
  color?: string | null;
  notes?: string | null;
}): Promise<Resource> {
  const { data, error } = await supabase
    .from("resources")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      resource_type: input.resourceType ?? "room",
      unit_id: input.unitId ?? null,
      color: input.color ?? null,
      notes: input.notes ?? null,
    })
    .select(RESOURCE_COLS)
    .single();
  if (error) throw error;
  return {
    id: data.id, tenantId: data.tenant_id, unitId: data.unit_id, name: data.name,
    resourceType: data.resource_type as ResourceType, color: data.color, notes: data.notes,
    isActive: data.is_active,
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
    unitId: r.unit_id, weekday: r.weekday,
    startsAt: r.starts_at, endsAt: r.ends_at, isActive: r.is_active,
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
// TIME OFF (pontuais) e RECURRING BLOCKS
// =============================================================================
export async function listTimeOff(
  tenantId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<TimeOffBlock[]> {
  const { data, error } = await supabase
    .from("time_off_blocks")
    .select("id, tenant_id, scope, professional_id, unit_id, starts_at, ends_at, reason")
    .eq("tenant_id", tenantId)
    .lt("starts_at", rangeEnd)
    .gt("ends_at", rangeStart)
    .order("starts_at");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id, scope: r.scope as BlockScope,
    professionalId: r.professional_id, unitId: r.unit_id,
    startsAt: r.starts_at, endsAt: r.ends_at, reason: r.reason,
  }));
}

export async function createTimeOff(input: {
  tenantId: string; scope: BlockScope; startsAt: string; endsAt: string;
  reason?: string | null; professionalId?: string | null; unitId?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("time_off_blocks").insert({
    tenant_id: input.tenantId,
    scope: input.scope,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    reason: input.reason ?? null,
    professional_id: input.professionalId ?? null,
    unit_id: input.unitId ?? null,
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
  if (error) {
    console.error("[SchedulingRepo:getAvailableSlots]", error);
    // Retorna array vazio em vez de estourar erro para a UI lidar com "sem horários" graciosamente
    return [];
  }
  type Slot = { slot_start: string; slot_end: string };
  return ((data ?? []) as Slot[]).map((r) => ({ startsAt: r.slot_start, endsAt: r.slot_end }));
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

export interface HydratedAppointment {
  appointment: Appointment;
  serviceId: string | null;
  serviceName: string | null;
  clientName: string | null;
  professionalName: string | null;
  unitName: string | null;
  resourceName: string | null;
}

export async function listAppointments(params: ListAppointmentsParams): Promise<Appointment[]> {
  const { tenantId, rangeStart, rangeEnd, unitId, professionalId, clientId, excludeStatuses } = params;
  let q = supabase
    .from("appointments")
    .select(APPOINTMENT_COLS)
    .eq("tenant_id", tenantId)
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .order("starts_at");
  if (unitId) q = q.eq("unit_id", unitId);
  if (professionalId) q = q.eq("professional_id", professionalId);
  if (clientId) q = q.eq("client_id", clientId);
  if (excludeStatuses?.length) q = q.not("status", "in", `(${excludeStatuses.join(",")})`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => toAppointment(r as Record<string, unknown>));
}

export async function listAppointmentsHydrated(params: ListAppointmentsParams): Promise<HydratedAppointment[]> {
  const { tenantId, rangeStart, rangeEnd, unitId, professionalId, clientId, excludeStatuses } = params;
  let q = supabase
    .from("appointments")
    .select(`
      *,
      client:clients(id, full_name),
      professional:professionals(id, display_name),
      unit:units(id, name),
      resource:resources(id, name),
      appointment_items(
        id,
        service:services(id, name)
      )
    `)
    .eq("tenant_id", tenantId)
    .gte("starts_at", rangeStart)
    .lt("starts_at", rangeEnd)
    .order("starts_at");

  if (unitId) q = q.eq("unit_id", unitId);
  if (professionalId) q = q.eq("professional_id", professionalId);
  if (clientId) q = q.eq("client_id", clientId);
  if (excludeStatuses?.length) q = q.not("status", "in", `(${excludeStatuses.join(",")})`);

  const { data, error } = await q;
  if (error) throw error;
  if (!data) return [];

  return data.map((row: any) => {
    const appointment = toAppointment(row);
    const item = row.appointment_items?.[0] ?? null;
    
    return {
      appointment,
      serviceId: item?.service?.id ?? null,
      serviceName: item?.service?.name ?? null,
      clientName: row.client?.full_name ?? null,
      professionalName: row.professional?.display_name ?? null,
      unitName: row.unit?.name ?? null,
      resourceName: row.resource?.name ?? null,
    };
  });
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

  // Item de serviço (1 item por agendamento na v1)
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
    unitId: string;
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
  if (patch.unitId !== undefined) dbPatch.unit_id = patch.unitId;
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

export async function listAppointmentItemsForAppointments(appointmentIds: string[]): Promise<AppointmentItem[]> {
  if (appointmentIds.length === 0) return [];
  const { data, error } = await supabase
    .from("appointment_items")
    .select("id, appointment_id, service_id, duration_minutes, price_cents, position, notes")
    .in("appointment_id", appointmentIds)
    .order("position");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    appointmentId: r.appointment_id,
    serviceId: r.service_id,
    durationMinutes: r.duration_minutes,
    priceCents: r.price_cents,
    position: r.position,
    notes: r.notes,
  }));
}

// =============================================================================
// WAITLIST
// =============================================================================
const WAITLIST_COLS = `
  id, tenant_id, preferred_unit_id, client_id, service_id, preferred_professional_id,
  desired_window_start, desired_window_end, notes, priority, status,
  contacted_at, scheduled_appointment_id, created_at
`;

export async function listWaitlist(tenantId: string, status?: WaitlistStatus): Promise<WaitlistEntry[]> {
  let q = supabase
    .from("waitlist_entries")
    .select(WAITLIST_COLS)
    .eq("tenant_id", tenantId)
    .order("priority", { ascending: false })
    .order("created_at");
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id,
    preferredUnitId: r.preferred_unit_id, clientId: r.client_id, serviceId: r.service_id,
    preferredProfessionalId: r.preferred_professional_id,
    desiredWindowStart: r.desired_window_start, desiredWindowEnd: r.desired_window_end,
    notes: r.notes, priority: r.priority, status: r.status as WaitlistStatus,
    contactedAt: r.contacted_at, scheduledAppointmentId: r.scheduled_appointment_id,
    createdAt: r.created_at,
  }));
}

export interface HydratedWaitlistEntry {
  entry: WaitlistEntry;
  clientName: string | null;
  serviceName: string | null;
  professionalName: string | null;
  unitName: string | null;
}

export async function listWaitlistHydrated(
  tenantId: string,
  status?: WaitlistStatus,
): Promise<HydratedWaitlistEntry[]> {
  const entries = await listWaitlist(tenantId, status);
  if (entries.length === 0) return [];

  const clientIds = Array.from(new Set(entries.map((entry) => entry.clientId)));
  const serviceIds = Array.from(
    new Set(entries.map((entry) => entry.serviceId).filter((id): id is string => Boolean(id))),
  );
  const professionalIds = Array.from(
    new Set(entries.map((entry) => entry.preferredProfessionalId).filter((id): id is string => Boolean(id))),
  );
  const unitIds = Array.from(
    new Set(entries.map((entry) => entry.preferredUnitId).filter((id): id is string => Boolean(id))),
  );

  const [clients, services, professionals, units] = await Promise.all([
    supabase.from("clients").select("id, full_name").in("id", clientIds),
    serviceIds.length
      ? supabase.from("services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    professionalIds.length
      ? supabase.from("professionals").select("id, display_name").in("id", professionalIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? supabase.from("units").select("id, name").in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (clients.error) throw clients.error;
  if (services.error) throw services.error;
  if (professionals.error) throw professionals.error;
  if (units.error) throw units.error;

  const clientMap = new Map((clients.data ?? []).map((row) => [row.id, row.full_name]));
  const serviceMap = new Map((services.data ?? []).map((row) => [row.id, row.name]));
  const professionalMap = new Map((professionals.data ?? []).map((row) => [row.id, row.display_name]));
  const unitMap = new Map((units.data ?? []).map((row) => [row.id, row.name]));

  return entries.map((entry) => ({
    entry,
    clientName: clientMap.get(entry.clientId) ?? null,
    serviceName: entry.serviceId ? (serviceMap.get(entry.serviceId) ?? null) : null,
    professionalName: entry.preferredProfessionalId
      ? (professionalMap.get(entry.preferredProfessionalId) ?? null)
      : null,
    unitName: entry.preferredUnitId ? (unitMap.get(entry.preferredUnitId) ?? null) : null,
  }));
}

export async function createWaitlistEntry(input: {
  tenantId: string;
  clientId: string;
  preferredUnitId?: string | null;
  serviceId?: string | null;
  preferredProfessionalId?: string | null;
  desiredWindowStart?: string | null;
  desiredWindowEnd?: string | null;
  notes?: string | null;
  priority?: number;
}): Promise<void> {
  const { error } = await supabase.from("waitlist_entries").insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    preferred_unit_id: input.preferredUnitId ?? null,
    service_id: input.serviceId ?? null,
    preferred_professional_id: input.preferredProfessionalId ?? null,
    desired_window_start: input.desiredWindowStart ?? null,
    desired_window_end: input.desiredWindowEnd ?? null,
    notes: input.notes ?? null,
    priority: input.priority ?? 50,
  });
  if (error) throw error;
}

export async function updateWaitlistEntry(
  id: string,
  patch: Partial<{
    preferredUnitId: string | null;
    preferredProfessionalId: string | null;
    serviceId: string | null;
    desiredWindowStart: string | null;
    desiredWindowEnd: string | null;
    notes: string | null;
    priority: number;
  }>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.preferredUnitId !== undefined) dbPatch.preferred_unit_id = patch.preferredUnitId;
  if (patch.preferredProfessionalId !== undefined) dbPatch.preferred_professional_id = patch.preferredProfessionalId;
  if (patch.serviceId !== undefined) dbPatch.service_id = patch.serviceId;
  if (patch.desiredWindowStart !== undefined) dbPatch.desired_window_start = patch.desiredWindowStart;
  if (patch.desiredWindowEnd !== undefined) dbPatch.desired_window_end = patch.desiredWindowEnd;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority;
  const { error } = await supabase.from("waitlist_entries").update(dbPatch as never).eq("id", id);
  if (error) throw error;
}

export async function setWaitlistStatus(
  id: string,
  status: WaitlistStatus,
  extras?: { scheduledAppointmentId?: string | null },
): Promise<void> {
  const dbPatch: Record<string, unknown> = { status };
  if (status === "contacted") dbPatch.contacted_at = new Date().toISOString();
  if (status === "scheduled") dbPatch.scheduled_appointment_id = extras?.scheduledAppointmentId ?? null;
  const { error } = await supabase
    .from("waitlist_entries")
    .update(dbPatch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteWaitlistEntry(id: string): Promise<void> {
  const { error } = await supabase.from("waitlist_entries").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// HELPERS para UI (combos com profissionais)
// =============================================================================
export interface ProfessionalLite {
  id: string;
  displayName: string;
  color: string | null;
  unitId: string | null;
  isActive: boolean;
}

export async function listProfessionalsLite(
  tenantId: string,
  unitId?: string | null,
): Promise<ProfessionalLite[]> {
  let q = supabase
    .from("professionals")
    .select("id, display_name, color, unit_id, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("display_name");
  if (unitId) q = q.and(`unit_id.eq.${unitId},unit_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, displayName: r.display_name, color: r.color, unitId: r.unit_id,
    isActive: r.is_active,
  }));
}
