/**
 * Repositório da Central de Confirmação. UI consome apenas estes métodos.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CallLog,
  CallOutcome,
  ChannelPreference,
  ConfirmationQueueItem,
  ConfirmationQueueStatus,
  ConfirmationRule,
  ConfirmationStage,
  ContactAttempt,
  ContactAttemptResult,
  MessageChannel,
  MessageTemplate,
  MessageTemplateStage,
} from "@/domain/confirmation";

// =============================================================================
// QUEUE
// =============================================================================
const QUEUE_COLS = `
  id, tenant_id, appointment_id, client_id, rule_id, stage, status, priority,
  scheduled_for, appointment_starts_at, assigned_to, last_attempt_at,
  attempts_count, follow_up_at, closed_at, notes, created_at, updated_at
`;

function toQueueItem(r: Record<string, unknown>): ConfirmationQueueItem {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    appointmentId: r.appointment_id as string,
    clientId: r.client_id as string,
    ruleId: (r.rule_id as string) ?? null,
    stage: r.stage as ConfirmationStage,
    status: r.status as ConfirmationQueueStatus,
    priority: r.priority as number,
    scheduledFor: r.scheduled_for as string,
    appointmentStartsAt: r.appointment_starts_at as string,
    assignedTo: (r.assigned_to as string) ?? null,
    lastAttemptAt: (r.last_attempt_at as string) ?? null,
    attemptsCount: (r.attempts_count as number) ?? 0,
    followUpAt: (r.follow_up_at as string) ?? null,
    closedAt: (r.closed_at as string) ?? null,
    notes: (r.notes as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export interface ListQueueParams {
  tenantId: string;
  stage?: ConfirmationStage;
  status?: ConfirmationQueueStatus;
  excludeClosed?: boolean;
  offset?: number;
  limit?: number;
}

export interface ListQueuePage {
  items: ConfirmationQueueItem[];
  total: number;
  hasMore: boolean;
}

export const QUEUE_PAGE_SIZE_DEFAULT = 50;

export async function listQueue(params: ListQueueParams): Promise<ListQueuePage> {
  const limit = params.limit ?? QUEUE_PAGE_SIZE_DEFAULT;
  const offset = params.offset ?? 0;
  let q = supabase
    .from("confirmation_queue")
    .select(QUEUE_COLS, { count: "exact" })
    .eq("tenant_id", params.tenantId)
    .order("priority", { ascending: false })
    .order("appointment_starts_at", { ascending: true })
    .range(offset, offset + limit - 1);
  if (params.stage) q = q.eq("stage", params.stage);
  if (params.status) q = q.eq("status", params.status);
  if (params.excludeClosed) q = q.not("status", "in", "(closed,confirmed,canceled)");
  const { data, error, count } = await q;
  if (error) throw error;
  const items = (data ?? []).map((r) => toQueueItem(r as Record<string, unknown>));
  const total = count ?? items.length;
  return {
    items,
    total,
    hasMore: offset + items.length < total,
  };
}

export async function countQueueByStage(tenantId: string): Promise<Record<ConfirmationStage, number>> {
  const { data, error } = await supabase
    .from("confirmation_queue")
    .select("stage")
    .eq("tenant_id", tenantId)
    .not("status", "in", "(closed,confirmed,canceled)");
  
  if (error) throw error;
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    counts[row.stage as string] = (counts[row.stage as string] ?? 0) + 1;
  }
  return counts as Record<ConfirmationStage, number>;
}

export async function createQueueItem(input: {
  tenantId: string;
  appointmentId: string;
  clientId: string;
  appointmentStartsAt: string;
  stage: ConfirmationStage;
  ruleId?: string | null;
  priority?: number;
  scheduledFor?: string;
  assignedTo?: string | null;
  notes?: string | null;
}): Promise<ConfirmationQueueItem> {
  const { data, error } = await supabase
    .from("confirmation_queue")
    .insert({
      tenant_id: input.tenantId,
      appointment_id: input.appointmentId,
      client_id: input.clientId,
      appointment_starts_at: input.appointmentStartsAt,
      stage: input.stage,
      rule_id: input.ruleId ?? null,
      priority: input.priority ?? 50,
      scheduled_for: input.scheduledFor ?? new Date().toISOString(),
      assigned_to: input.assignedTo ?? null,
      notes: input.notes ?? null,
    })
    .select(QUEUE_COLS)
    .single();
  if (error) throw error;
  return toQueueItem(data as Record<string, unknown>);
}

export async function updateQueueStatus(
  id: string,
  status: ConfirmationQueueStatus,
  extras?: { notes?: string | null; followUpAt?: string | null },
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === "closed" || status === "confirmed" || status === "canceled") {
    patch.closed_at = new Date().toISOString();
  }
  if (extras?.notes !== undefined) patch.notes = extras.notes;
  if (extras?.followUpAt !== undefined) patch.follow_up_at = extras.followUpAt;
  const { error } = await supabase
    .from("confirmation_queue")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function bumpQueueAttempt(id: string): Promise<void> {
  const { data: cur, error: e1 } = await supabase
    .from("confirmation_queue")
    .select("attempts_count")
    .eq("id", id)
    .single();
  if (e1) throw e1;
  const next = ((cur?.attempts_count as number) ?? 0) + 1;
  const { error } = await supabase
    .from("confirmation_queue")
    .update({
      attempts_count: next,
      last_attempt_at: new Date().toISOString(),
      status: "in_progress",
    } as never)
    .eq("id", id);
  if (error) throw error;
}

export async function assignQueueItem(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("confirmation_queue")
    .update({ assigned_to: userId } as never)
    .eq("id", id);
  if (error) throw error;
}

// =============================================================================
// MESSAGE TEMPLATES
// =============================================================================
const TEMPLATE_COLS = `
  id, tenant_id, unit_id, service_id, stage, channel, name, body,
  variables, is_default, is_active, created_at, updated_at
`;

function toTemplate(r: Record<string, unknown>): MessageTemplate {
  const rawVars = r.variables;
  let vars: string[] = [];
  if (Array.isArray(rawVars)) vars = rawVars as string[];
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    unitId: (r.unit_id as string) ?? null,
    serviceId: (r.service_id as string) ?? null,
    stage: r.stage as MessageTemplateStage,
    channel: r.channel as MessageChannel,
    name: r.name as string,
    body: r.body as string,
    variables: vars,
    isDefault: Boolean(r.is_default),
    isActive: Boolean(r.is_active),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function listTemplates(
  tenantId: string,
  filters?: { stage?: MessageTemplateStage; channel?: MessageChannel; activeOnly?: boolean },
): Promise<MessageTemplate[]> {
  let q = supabase
    .from("message_templates")
    .select(TEMPLATE_COLS)
    .eq("tenant_id", tenantId)
    .order("stage")
    .order("name");
  if (filters?.stage) q = q.eq("stage", filters.stage);
  if (filters?.channel) q = q.eq("channel", filters.channel);
  if (filters?.activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => toTemplate(r as Record<string, unknown>));
}

export async function createTemplate(input: {
  tenantId: string;
  name: string;
  body: string;
  stage: MessageTemplateStage;
  channel?: MessageChannel;
  unitId?: string | null;
  serviceId?: string | null;
  variables?: string[];
  isDefault?: boolean;
}): Promise<MessageTemplate> {
  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      tenant_id: input.tenantId,
      name: input.name,
      body: input.body,
      stage: input.stage,
      channel: input.channel ?? "whatsapp",
      unit_id: input.unitId ?? null,
      service_id: input.serviceId ?? null,
      variables: input.variables ?? [],
      is_default: input.isDefault ?? false,
    })
    .select(TEMPLATE_COLS)
    .single();
  if (error) throw error;
  return toTemplate(data as Record<string, unknown>);
}

export async function updateTemplate(
  id: string,
  patch: Partial<{ name: string; body: string; isActive: boolean; isDefault: boolean }>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.body !== undefined) dbPatch.body = patch.body;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  if (patch.isDefault !== undefined) dbPatch.is_default = patch.isDefault;
  const { error } = await supabase
    .from("message_templates")
    .update(dbPatch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// CONFIRMATION RULES
// =============================================================================
const RULE_COLS = `
  id, tenant_id, unit_id, name, stage, hours_before_appointment, base_priority,
  applies_to_vip, applies_to_protocol, applies_to_high_risk,
  min_appointment_value_cents, skip_if_already_confirmed, is_active
`;

function toRule(r: Record<string, unknown>): ConfirmationRule {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    unitId: (r.unit_id as string) ?? null,
    name: r.name as string,
    stage: r.stage as ConfirmationStage,
    hoursBeforeAppointment: r.hours_before_appointment as number,
    basePriority: r.base_priority as number,
    appliesToVip: Boolean(r.applies_to_vip),
    appliesToProtocol: Boolean(r.applies_to_protocol),
    appliesToHighRisk: Boolean(r.applies_to_high_risk),
    minAppointmentValueCents: (r.min_appointment_value_cents as number) ?? null,
    skipIfAlreadyConfirmed: Boolean(r.skip_if_already_confirmed),
    isActive: Boolean(r.is_active),
  };
}

export async function listRules(tenantId: string): Promise<ConfirmationRule[]> {
  const { data, error } = await supabase
    .from("confirmation_rules")
    .select(RULE_COLS)
    .eq("tenant_id", tenantId)
    .order("stage");
  if (error) throw error;
  return (data ?? []).map((r) => toRule(r as Record<string, unknown>));
}

export async function createRule(input: {
  tenantId: string;
  name: string;
  stage: ConfirmationStage;
  hoursBeforeAppointment?: number;
  basePriority?: number;
  unitId?: string | null;
  appliesToVip?: boolean;
  appliesToProtocol?: boolean;
  appliesToHighRisk?: boolean;
  minAppointmentValueCents?: number | null;
  skipIfAlreadyConfirmed?: boolean;
  isActive?: boolean;
}): Promise<void> {
  const { error } = await supabase.from("confirmation_rules").insert({
    tenant_id: input.tenantId,
    name: input.name,
    stage: input.stage,
    hours_before_appointment: input.hoursBeforeAppointment ?? 24,
    base_priority: input.basePriority ?? 50,
    unit_id: input.unitId ?? null,
    applies_to_vip: input.appliesToVip ?? false,
    applies_to_protocol: input.appliesToProtocol ?? false,
    applies_to_high_risk: input.appliesToHighRisk ?? false,
    min_appointment_value_cents: input.minAppointmentValueCents ?? null,
    skip_if_already_confirmed: input.skipIfAlreadyConfirmed ?? true,
    is_active: input.isActive ?? true,
  });
  if (error) throw error;
}

export async function updateRule(
  id: string,
  patch: Partial<{
    name: string;
    stage: ConfirmationStage;
    hoursBeforeAppointment: number;
    basePriority: number;
    unitId: string | null;
    appliesToVip: boolean;
    appliesToProtocol: boolean;
    appliesToHighRisk: boolean;
    minAppointmentValueCents: number | null;
    skipIfAlreadyConfirmed: boolean;
    isActive: boolean;
  }>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.stage !== undefined) dbPatch.stage = patch.stage;
  if (patch.hoursBeforeAppointment !== undefined) dbPatch.hours_before_appointment = patch.hoursBeforeAppointment;
  if (patch.basePriority !== undefined) dbPatch.base_priority = patch.basePriority;
  if (patch.unitId !== undefined) dbPatch.unit_id = patch.unitId;
  if (patch.appliesToVip !== undefined) dbPatch.applies_to_vip = patch.appliesToVip;
  if (patch.appliesToProtocol !== undefined) dbPatch.applies_to_protocol = patch.appliesToProtocol;
  if (patch.appliesToHighRisk !== undefined) dbPatch.applies_to_high_risk = patch.appliesToHighRisk;
  if (patch.minAppointmentValueCents !== undefined) dbPatch.min_appointment_value_cents = patch.minAppointmentValueCents;
  if (patch.skipIfAlreadyConfirmed !== undefined) dbPatch.skip_if_already_confirmed = patch.skipIfAlreadyConfirmed;
  if (patch.isActive !== undefined) dbPatch.is_active = patch.isActive;
  const { error } = await supabase
    .from("confirmation_rules")
    .update(dbPatch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRule(id: string): Promise<void> {
  const { error } = await supabase.from("confirmation_rules").delete().eq("id", id);
  if (error) throw error;
}

// =============================================================================
// CONTACT ATTEMPTS
// =============================================================================
const ATTEMPT_COLS = `
  id, tenant_id, queue_id, appointment_id, client_id, template_id, channel, result,
  message_preview, notes, attempted_by, attempted_at, follow_up_at
`;

function toAttempt(r: Record<string, unknown>): ContactAttempt {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    queueId: (r.queue_id as string) ?? null,
    appointmentId: (r.appointment_id as string) ?? null,
    clientId: r.client_id as string,
    templateId: (r.template_id as string) ?? null,
    channel: r.channel as MessageChannel,
    result: r.result as ContactAttemptResult,
    messagePreview: (r.message_preview as string) ?? null,
    notes: (r.notes as string) ?? null,
    attemptedBy: (r.attempted_by as string) ?? null,
    attemptedAt: r.attempted_at as string,
    followUpAt: (r.follow_up_at as string) ?? null,
  };
}

export async function listAttempts(input: {
  tenantId: string;
  queueId?: string | null;
  clientId?: string | null;
  appointmentId?: string | null;
  limit?: number;
}): Promise<ContactAttempt[]> {
  let q = supabase
    .from("contact_attempts")
    .select(ATTEMPT_COLS)
    .eq("tenant_id", input.tenantId)
    .order("attempted_at", { ascending: false });
  if (input.queueId) q = q.eq("queue_id", input.queueId);
  if (input.clientId) q = q.eq("client_id", input.clientId);
  if (input.appointmentId) q = q.eq("appointment_id", input.appointmentId);
  if (input.limit) q = q.limit(input.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => toAttempt(r as Record<string, unknown>));
}

export async function recordAttempt(input: {
  tenantId: string;
  clientId: string;
  channel: MessageChannel;
  result: ContactAttemptResult;
  queueId?: string | null;
  appointmentId?: string | null;
  templateId?: string | null;
  messagePreview?: string | null;
  notes?: string | null;
  attemptedBy?: string | null;
  followUpAt?: string | null;
}): Promise<ContactAttempt> {
  const { data, error } = await supabase
    .from("contact_attempts")
    .insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      channel: input.channel,
      result: input.result,
      queue_id: input.queueId ?? null,
      appointment_id: input.appointmentId ?? null,
      template_id: input.templateId ?? null,
      message_preview: input.messagePreview ?? null,
      notes: input.notes ?? null,
      attempted_by: input.attemptedBy ?? null,
      follow_up_at: input.followUpAt ?? null,
    })
    .select(ATTEMPT_COLS)
    .single();
  if (error) throw error;
  return toAttempt(data as Record<string, unknown>);
}

// =============================================================================
// CALL LOGS
// =============================================================================
const CALL_COLS = `
  id, tenant_id, client_id, appointment_id, queue_id, outcome,
  duration_seconds, notes, called_by, called_at
`;

function toCallLog(r: Record<string, unknown>): CallLog {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    clientId: r.client_id as string,
    appointmentId: (r.appointment_id as string) ?? null,
    queueId: (r.queue_id as string) ?? null,
    outcome: r.outcome as CallOutcome,
    durationSeconds: (r.duration_seconds as number) ?? null,
    notes: (r.notes as string) ?? null,
    calledBy: (r.called_by as string) ?? null,
    calledAt: r.called_at as string,
  };
}

export async function listCallLogs(input: {
  tenantId: string;
  clientId?: string | null;
  queueId?: string | null;
  limit?: number;
}): Promise<CallLog[]> {
  let q = supabase
    .from("call_logs")
    .select(CALL_COLS)
    .eq("tenant_id", input.tenantId)
    .order("called_at", { ascending: false });
  if (input.clientId) q = q.eq("client_id", input.clientId);
  if (input.queueId) q = q.eq("queue_id", input.queueId);
  if (input.limit) q = q.limit(input.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => toCallLog(r as Record<string, unknown>));
}

export async function recordCall(input: {
  tenantId: string;
  clientId: string;
  outcome: CallOutcome;
  appointmentId?: string | null;
  queueId?: string | null;
  durationSeconds?: number | null;
  notes?: string | null;
  calledBy?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("call_logs").insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    outcome: input.outcome,
    appointment_id: input.appointmentId ?? null,
    queue_id: input.queueId ?? null,
    duration_seconds: input.durationSeconds ?? null,
    notes: input.notes ?? null,
    called_by: input.calledBy ?? null,
  });
  if (error) throw error;
}

// =============================================================================
// CHANNEL PREFERENCES
// =============================================================================
const PREF_COLS = `
  id, tenant_id, client_id, preferred_channel, fallback_channel,
  preferred_window_start, preferred_window_end, do_not_disturb, notes
`;

function toPref(r: Record<string, unknown>): ChannelPreference {
  return {
    id: r.id as string,
    tenantId: r.tenant_id as string,
    clientId: r.client_id as string,
    preferredChannel: r.preferred_channel as MessageChannel,
    fallbackChannel: (r.fallback_channel as MessageChannel) ?? null,
    preferredWindowStart: (r.preferred_window_start as string) ?? null,
    preferredWindowEnd: (r.preferred_window_end as string) ?? null,
    doNotDisturb: Boolean(r.do_not_disturb),
    notes: (r.notes as string) ?? null,
  };
}

export async function getChannelPreference(
  tenantId: string,
  clientId: string,
): Promise<ChannelPreference | null> {
  const { data, error } = await supabase
    .from("channel_preferences")
    .select(PREF_COLS)
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data ? toPref(data as Record<string, unknown>) : null;
}

export async function upsertChannelPreference(input: {
  tenantId: string;
  clientId: string;
  preferredChannel: MessageChannel;
  fallbackChannel?: MessageChannel | null;
  preferredWindowStart?: string | null;
  preferredWindowEnd?: string | null;
  doNotDisturb?: boolean;
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("channel_preferences")
    .upsert(
      {
        tenant_id: input.tenantId,
        client_id: input.clientId,
        preferred_channel: input.preferredChannel,
        fallback_channel: input.fallbackChannel ?? null,
        preferred_window_start: input.preferredWindowStart ?? null,
        preferred_window_end: input.preferredWindowEnd ?? null,
        do_not_disturb: input.doNotDisturb ?? false,
        notes: input.notes ?? null,
      },
      { onConflict: "tenant_id,client_id" },
    );
  if (error) throw error;
}

// =============================================================================
// HYDRATION HELPERS (junções leves para a UI)
// =============================================================================

export interface QueueItemHydrated extends ConfirmationQueueItem {
  clientName: string;
  clientPhone: string | null;
  clientWhatsapp: string | null;
  clientIsVip: boolean;
  clientRiskLevel: string;
  serviceName: string | null;
  professionalName: string | null;
  unitName: string | null;
}

export async function listQueueHydrated(params: ListQueueParams): Promise<QueueItemHydrated[]> {
  const { items } = await listQueue(params);
  if (items.length === 0) return [];
  const clientIds = Array.from(new Set(items.map((i) => i.clientId)));
  const apptIds = Array.from(new Set(items.map((i) => i.appointmentId)));

  const [clientsRes, apptsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("id, full_name, phone, whatsapp_phone, is_vip, risk_level")
      .in("id", clientIds),
    supabase
      .from("appointments")
      .select("id, professional_id, unit_id")
      .in("id", apptIds),
  ]);

  if (clientsRes.error) throw clientsRes.error;
  if (apptsRes.error) throw apptsRes.error;

  const proIds = Array.from(new Set((apptsRes.data ?? []).map((a) => a.professional_id).filter(Boolean)));
  const unitIds = Array.from(new Set((apptsRes.data ?? []).map((a) => a.unit_id).filter(Boolean)));

  const [prosRes, unitsRes, itemsRes] = await Promise.all([
    proIds.length
      ? supabase.from("professionals").select("id, display_name").in("id", proIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? supabase.from("units").select("id, name").in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("appointment_items")
      .select("appointment_id, service_id, position")
      .in("appointment_id", apptIds)
      .order("position"),
  ]);

  if (prosRes.error) throw prosRes.error;
  if (unitsRes.error) throw unitsRes.error;
  if (itemsRes.error) throw itemsRes.error;

  const svcIds = Array.from(new Set((itemsRes.data ?? []).map((i) => i.service_id).filter(Boolean)));
  const svcRes = svcIds.length
    ? await supabase.from("services").select("id, name").in("id", svcIds)
    : { data: [], error: null };
  if (svcRes.error) throw svcRes.error;

  const cliMap = new Map(
    (clientsRes.data ?? []).map((c) => [
      c.id as string,
      {
        full_name: c.full_name as string,
        phone: c.phone as string | null,
        whatsapp_phone: c.whatsapp_phone as string | null,
        is_vip: Boolean(c.is_vip),
        risk_level: c.risk_level as string,
      },
    ]),
  );
  const apptMap = new Map(
    (apptsRes.data ?? []).map((a) => [
      a.id as string,
      { professional_id: a.professional_id as string, unit_id: a.unit_id as string },
    ]),
  );
  const proMap = new Map((prosRes.data ?? []).map((p) => [p.id as string, p.display_name as string]));
  const unitMap = new Map((unitsRes.data ?? []).map((u) => [u.id as string, u.name as string]));
  const svcMap = new Map((svcRes.data ?? []).map((s) => [s.id as string, s.name as string]));
  // primeiro item de serviço por appointment
  const firstItemByAppt = new Map<string, string>();
  for (const it of itemsRes.data ?? []) {
    const key = it.appointment_id as string;
    if (!firstItemByAppt.has(key) && it.service_id) firstItemByAppt.set(key, it.service_id as string);
  }

  return items.map((q) => {
    const cli = cliMap.get(q.clientId);
    const ap = apptMap.get(q.appointmentId);
    const svcId = firstItemByAppt.get(q.appointmentId);
    return {
      ...q,
      clientName: cli?.full_name ?? "—",
      clientPhone: cli?.phone ?? null,
      clientWhatsapp: cli?.whatsapp_phone ?? cli?.phone ?? null,
      clientIsVip: cli?.is_vip ?? false,
      clientRiskLevel: cli?.risk_level ?? "low",
      serviceName: svcId ? svcMap.get(svcId) ?? null : null,
      professionalName: ap ? proMap.get(ap.professional_id) ?? null : null,
      unitName: ap ? unitMap.get(ap.unit_id) ?? null : null,
    };
  });
}
