/**
 * Repositório de clientes.
 * Concentra TODOS os queries Supabase relacionados ao CRM.
 * UI consome apenas estes métodos (portabilidade futura para outro backend).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  Client,
  ClientFile,
  ClientNote,
  ClientPhoto,
  ClientStatus,
  ClientRiskLevel,
  ClientTag,
  TimelineEvent,
  CustomFieldDefinition,
  ConsentTemplate,
  ConsentResponse,
} from "@/domain/client";

// Re-export para conveniência das páginas que importam tipos a partir do repositório.
export type { Client } from "@/domain/client";

// -----------------------------------------------------------------------------
// Mappers DB → domínio
// -----------------------------------------------------------------------------
type DbClient = {
  id: string;
  tenant_id: string;
  preferred_unit_id: string | null;
  preferred_professional_id: string | null;
  referred_by_client_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  birth_date: string | null;
  origin: string | null;
  notes: string | null;
  allergies: string | null;
  contraindications: string | null;
  preferences: string | null;
  status: ClientStatus;
  is_vip: boolean;
  risk_level: ClientRiskLevel;
  needs_reactivation: boolean;
  last_visit_at: string | null;
  next_visit_at: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
};

function toClient(r: DbClient): Client {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    preferredUnitId: r.preferred_unit_id,
    preferredProfessionalId: r.preferred_professional_id,
    referredByClientId: r.referred_by_client_id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    whatsappPhone: r.whatsapp_phone,
    birthDate: r.birth_date,
    origin: r.origin,
    notes: r.notes,
    allergies: r.allergies,
    contraindications: r.contraindications,
    preferences: r.preferences,
    status: r.status,
    isVip: r.is_vip,
    riskLevel: r.risk_level,
    needsReactivation: r.needs_reactivation,
    lastVisitAt: r.last_visit_at,
    nextVisitAt: r.next_visit_at,
    city: r.city,
    state: r.state,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const CLIENT_COLUMNS =
  "id, tenant_id, preferred_unit_id, preferred_professional_id, referred_by_client_id, full_name, email, phone, whatsapp_phone, birth_date, origin, notes, allergies, contraindications, preferences, status, is_vip, risk_level, needs_reactivation, last_visit_at, next_visit_at, city, state, created_at, updated_at";

// -----------------------------------------------------------------------------
// CLIENTS
// -----------------------------------------------------------------------------
export interface ListClientsParams {
  tenantId: string;
  search?: string;
  status?: ClientStatus | "all";
  vipOnly?: boolean;
  inactiveOnly?: boolean;
  highRiskOnly?: boolean;
  needsReactivationOnly?: boolean;
  birthdayMonth?: number;
  preferredUnitId?: string;
  preferredProfessionalId?: string;
  origin?: string;
  tagId?: string;
  limit?: number;
}

export async function listClients(params: ListClientsParams): Promise<Client[]> {
  if (!params.tenantId) {
    throw new Error("tenantId é obrigatório para listClients");
  }
  let q = supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("tenant_id", params.tenantId)

    .order("full_name", { ascending: true })
    .limit(params.limit ?? 200);

  if (params.search?.trim()) {
    const s = params.search.trim().replace(/[,()]/g, " ");
    q = q.or(`full_name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
  }
  if (params.status && params.status !== "all") q = q.eq("status", params.status);
  if (params.vipOnly) q = q.eq("is_vip", true);
  if (params.inactiveOnly) q = q.eq("status", "inactive");
  if (params.highRiskOnly) q = q.eq("risk_level", "high");
  if (params.needsReactivationOnly) q = q.eq("needs_reactivation", true);
  if (params.preferredUnitId) q = q.eq("preferred_unit_id", params.preferredUnitId);
  if (params.preferredProfessionalId) q = q.eq("preferred_professional_id", params.preferredProfessionalId);
  if (params.origin) q = q.eq("origin", params.origin);

  const { data, error } = await q;
  if (error) throw error;
  let list = (data ?? []).map(toClient);

  if (params.birthdayMonth) {
    list = list.filter((c) => {
      if (!c.birthDate) return false;
      return new Date(c.birthDate).getMonth() + 1 === params.birthdayMonth;
    });
  }

  if (params.tagId) {
    const { data: rels } = await supabase
      .from("client_tag_relations")
      .select("client_id")
      .eq("tenant_id", params.tenantId)
      .eq("tag_id", params.tagId);
    const ids = new Set((rels ?? []).map((r) => r.client_id));
    list = list.filter((c) => ids.has(c.id));
  }

  return list;
}

export async function getClient(clientId: string): Promise<Client | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(CLIENT_COLUMNS)
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data ? toClient(data) : null;
}

export interface CreateClientInput {
  tenantId: string;
  createdBy: string;
  fullName: string;
  phone?: string;
  email?: string;
  birthDate?: string;
  origin?: string;
  notes?: string;
  allergies?: string;
  contraindications?: string;
  preferences?: string;
  isVip?: boolean;
  riskLevel?: ClientRiskLevel;
  preferredUnitId?: string;
  preferredProfessionalId?: string;
  whatsappPhone?: string;
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      tenant_id: input.tenantId,
      created_by: input.createdBy,
      full_name: input.fullName,
      phone: input.phone ?? null,
      email: input.email ?? null,
      birth_date: input.birthDate ?? null,
      origin: input.origin ?? null,
      notes: input.notes ?? null,
      allergies: input.allergies ?? null,
      contraindications: input.contraindications ?? null,
      preferences: input.preferences ?? null,
      is_vip: input.isVip ?? false,
      risk_level: input.riskLevel ?? "low",
      preferred_unit_id: input.preferredUnitId ?? null,
      preferred_professional_id: input.preferredProfessionalId ?? null,
      whatsapp_phone: input.whatsappPhone ?? null,
    })
    .select(CLIENT_COLUMNS)
    .single();
  if (error) throw error;
  return toClient(data);
}

export type UpdateClientInput = Partial<Omit<CreateClientInput, "tenantId" | "createdBy">>;

export async function updateClient(clientId: string, input: UpdateClientInput): Promise<Client> {
  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.phone !== undefined) patch.phone = input.phone || null;
  if (input.email !== undefined) patch.email = input.email || null;
  if (input.birthDate !== undefined) patch.birth_date = input.birthDate || null;
  if (input.origin !== undefined) patch.origin = input.origin || null;
  if (input.notes !== undefined) patch.notes = input.notes || null;
  if (input.allergies !== undefined) patch.allergies = input.allergies || null;
  if (input.contraindications !== undefined) patch.contraindications = input.contraindications || null;
  if (input.preferences !== undefined) patch.preferences = input.preferences || null;
  if (input.isVip !== undefined) patch.is_vip = input.isVip;
  if (input.riskLevel !== undefined) patch.risk_level = input.riskLevel;
  if (input.preferredUnitId !== undefined) patch.preferred_unit_id = input.preferredUnitId || null;
  if (input.preferredProfessionalId !== undefined) patch.preferred_professional_id = input.preferredProfessionalId || null;
  if (input.whatsappPhone !== undefined) patch.whatsapp_phone = input.whatsappPhone || null;

  const { data, error } = await supabase
    .from("clients")
    // cast: types Supabase ainda serão regenerados após esta migration
    .update(patch as never)
    .eq("id", clientId)
    .select(CLIENT_COLUMNS)
    .single();
  if (error) throw error;
  return toClient(data);
}

export async function deleteClient(clientId: string): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", clientId);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// TAGS
// -----------------------------------------------------------------------------
export async function listTags(tenantId: string): Promise<ClientTag[]> {
  const { data, error } = await supabase
    .from("client_tags")
    .select("id, tenant_id, name, color")
    .eq("tenant_id", tenantId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((t) => ({ id: t.id, tenantId: t.tenant_id, name: t.name, color: t.color }));
}

export async function listClientTagIds(clientId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("client_tag_relations")
    .select("tag_id")
    .eq("client_id", clientId);
  if (error) throw error;
  return (data ?? []).map((r) => r.tag_id);
}

export async function setClientTags(tenantId: string, clientId: string, tagIds: string[]): Promise<void> {
  await supabase.from("client_tag_relations").delete().eq("client_id", clientId);
  if (tagIds.length === 0) return;
  const rows = tagIds.map((tag_id) => ({ tag_id, client_id: clientId, tenant_id: tenantId }));
  const { error } = await supabase.from("client_tag_relations").insert(rows);
  if (error) throw error;
}

export async function createTag(tenantId: string, name: string, color?: string): Promise<ClientTag> {
  const { data, error } = await supabase
    .from("client_tags")
    .insert({ tenant_id: tenantId, name, color: color ?? null })
    .select("id, tenant_id, name, color")
    .single();
  if (error) throw error;
  return { id: data.id, tenantId: data.tenant_id, name: data.name, color: data.color };
}

// -----------------------------------------------------------------------------
// NOTES
// -----------------------------------------------------------------------------
export async function listNotes(clientId: string): Promise<ClientNote[]> {
  const { data, error } = await supabase
    .from("client_notes")
    .select("id, client_id, author_id, body, is_pinned, created_at")
    .eq("client_id", clientId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((n) => ({
    id: n.id,
    clientId: n.client_id,
    authorId: n.author_id,
    body: n.body,
    isPinned: n.is_pinned,
    createdAt: n.created_at,
  }));
}

export async function createNote(input: {
  tenantId: string;
  clientId: string;
  authorId: string;
  body: string;
  isPinned?: boolean;
}): Promise<ClientNote> {
  const { data, error } = await supabase
    .from("client_notes")
    .insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      author_id: input.authorId,
      body: input.body,
      is_pinned: input.isPinned ?? false,
    })
    .select("id, client_id, author_id, body, is_pinned, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    clientId: data.client_id,
    authorId: data.author_id,
    body: data.body,
    isPinned: data.is_pinned,
    createdAt: data.created_at,
  };
}

export async function deleteNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("client_notes").delete().eq("id", noteId);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// FILES
// -----------------------------------------------------------------------------
export async function listFiles(clientId: string): Promise<ClientFile[]> {
  const { data, error } = await supabase
    .from("client_files")
    .select("id, client_id, storage_path, file_name, mime_type, size_bytes, description, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    id: f.id,
    clientId: f.client_id,
    storagePath: f.storage_path,
    fileName: f.file_name,
    mimeType: f.mime_type,
    sizeBytes: f.size_bytes,
    description: f.description,
    createdAt: f.created_at,
  }));
}

export async function deleteFile(fileId: string, storagePath: string): Promise<void> {
  await supabase.storage.from("client-media").remove([storagePath]);
  const { error } = await supabase.from("client_files").delete().eq("id", fileId);
  if (error) throw error;
}

export async function uploadClientFile(input: {
  tenantId: string;
  clientId: string;
  uploadedBy: string | null;
  file: File;
  description?: string | null;
}): Promise<ClientFile> {
  const safeName = input.file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `${input.tenantId}/${input.clientId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("client-media")
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.file.type || undefined,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("client_files")
    .insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      uploaded_by: input.uploadedBy,
      storage_path: storagePath,
      file_name: input.file.name,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
      description: input.description ?? null,
    })
    .select("id, client_id, storage_path, file_name, mime_type, size_bytes, description, created_at")
    .single();
  if (error) throw error;

  await addTimelineEvent({
    tenantId: input.tenantId,
    clientId: input.clientId,
    actorId: input.uploadedBy,
    eventType: "file",
    title: "Arquivo anexado",
    description: input.file.name,
    referenceId: data.id,
  });

  return {
    id: data.id,
    clientId: data.client_id,
    storagePath: data.storage_path,
    fileName: data.file_name,
    mimeType: data.mime_type,
    sizeBytes: data.size_bytes,
    description: data.description,
    createdAt: data.created_at,
  };
}

// -----------------------------------------------------------------------------
// PHOTOS
// -----------------------------------------------------------------------------
export async function listPhotos(clientId: string): Promise<ClientPhoto[]> {
  const { data, error } = await supabase
    .from("client_photos")
    .select("id, client_id, storage_path, photo_type, pair_id, caption, taken_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    clientId: p.client_id,
    storagePath: p.storage_path,
    photoType: p.photo_type,
    pairId: p.pair_id,
    caption: p.caption,
    takenAt: p.taken_at,
    createdAt: p.created_at,
  }));
}

export async function deletePhoto(photoId: string, storagePath: string): Promise<void> {
  await supabase.storage.from("client-media").remove([storagePath]);
  const { error } = await supabase.from("client_photos").delete().eq("id", photoId);
  if (error) throw error;
}

export async function createClientMediaSignedUrl(
  storagePath: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("client-media")
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw error;
  return data?.signedUrl ?? null;
}

export async function uploadClientPhoto(input: {
  tenantId: string;
  clientId: string;
  uploadedBy: string | null;
  file: File;
  photoType?: ClientPhoto["photoType"];
  pairId?: string | null;
  caption?: string | null;
  takenAt?: string | null;
}): Promise<ClientPhoto> {
  const safeName = input.file.name.replace(/[^\w.-]+/g, "_");
  const storagePath = `${input.tenantId}/${input.clientId}/${crypto.randomUUID()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("client-media")
    .upload(storagePath, input.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: input.file.type || undefined,
    });
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from("client_photos")
    .insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      uploaded_by: input.uploadedBy,
      storage_path: storagePath,
      photo_type: input.photoType ?? "general",
      pair_id: input.pairId ?? null,
      caption: input.caption ?? null,
      taken_at: input.takenAt ?? null,
    })
    .select("id, client_id, storage_path, photo_type, pair_id, caption, taken_at, created_at")
    .single();
  if (error) throw error;

  await addTimelineEvent({
    tenantId: input.tenantId,
    clientId: input.clientId,
    actorId: input.uploadedBy,
    eventType: "photo",
    title: "Foto adicionada",
    description: input.caption ?? input.file.name,
    referenceId: data.id,
  });

  return {
    id: data.id,
    clientId: data.client_id,
    storagePath: data.storage_path,
    photoType: data.photo_type,
    pairId: data.pair_id,
    caption: data.caption,
    takenAt: data.taken_at,
    createdAt: data.created_at,
  };
}

// -----------------------------------------------------------------------------
// TIMELINE
// -----------------------------------------------------------------------------
export async function listTimeline(clientId: string, limit = 100): Promise<TimelineEvent[]> {
  const { data, error } = await supabase
    .from("client_timeline_events")
    .select("id, client_id, actor_id, event_type, title, description, reference_id, metadata, occurred_at")
    .eq("client_id", clientId)
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((e) => ({
    id: e.id,
    clientId: e.client_id,
    actorId: e.actor_id,
    eventType: e.event_type,
    title: e.title,
    description: e.description,
    referenceId: e.reference_id,
    metadata: (e.metadata ?? {}) as Record<string, unknown>,
    occurredAt: e.occurred_at,
  }));
}

export async function addTimelineEvent(input: {
  tenantId: string;
  clientId: string;
  actorId: string | null;
  eventType: TimelineEvent["eventType"];
  title: string;
  description?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // cast: types Supabase ainda serão regenerados após esta migration
  const { error } = await supabase.from("client_timeline_events").insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    actor_id: input.actorId,
    event_type: input.eventType,
    title: input.title,
    description: input.description ?? null,
    reference_id: input.referenceId ?? null,
    metadata: input.metadata ?? {},
  } as never);
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// CUSTOM FIELDS
// -----------------------------------------------------------------------------
export async function listCustomFieldDefs(tenantId: string): Promise<CustomFieldDefinition[]> {
  const { data, error } = await supabase
    .from("custom_field_definitions")
    .select("id, tenant_id, entity, key, label, field_type, options, is_required, position")
    .eq("tenant_id", tenantId)
    .eq("entity", "client")
    .order("position");
  if (error) throw error;
  return (data ?? []).map((d) => ({
    id: d.id,
    tenantId: d.tenant_id,
    entity: d.entity,
    key: d.key,
    label: d.label,
    fieldType: d.field_type,
    options: Array.isArray(d.options) ? (d.options as string[]) : [],
    isRequired: d.is_required,
    position: d.position,
  }));
}

export async function listClientCustomValues(clientId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("client_custom_field_values")
    .select("definition_id, value")
    .eq("client_id", clientId);
  if (error) throw error;
  const map: Record<string, unknown> = {};
  (data ?? []).forEach((r) => (map[r.definition_id] = r.value));
  return map;
}

export async function upsertCustomValue(input: {
  tenantId: string;
  clientId: string;
  definitionId: string;
  value: unknown;
}): Promise<void> {
  const { error } = await supabase.from("client_custom_field_values").upsert(
    {
      tenant_id: input.tenantId,
      client_id: input.clientId,
      definition_id: input.definitionId,
      value: input.value as never,
    },
    { onConflict: "client_id,definition_id" },
  );
  if (error) throw error;
}

// -----------------------------------------------------------------------------
// CONSENTS
// -----------------------------------------------------------------------------
export async function listConsentTemplates(tenantId: string, activeOnly = false): Promise<ConsentTemplate[]> {
  let q = supabase
    .from("consent_form_templates")
    .select("id, tenant_id, title, body, is_active, version, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((t) => ({
    id: t.id,
    tenantId: t.tenant_id,
    title: t.title,
    body: t.body,
    isActive: t.is_active,
    version: t.version,
    createdAt: t.created_at,
  }));
}

export async function createConsentTemplate(input: {
  tenantId: string;
  createdBy: string;
  title: string;
  body: string;
}): Promise<ConsentTemplate> {
  const { data, error } = await supabase
    .from("consent_form_templates")
    .insert({
      tenant_id: input.tenantId,
      created_by: input.createdBy,
      title: input.title,
      body: input.body,
    })
    .select("id, tenant_id, title, body, is_active, version, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    tenantId: data.tenant_id,
    title: data.title,
    body: data.body,
    isActive: data.is_active,
    version: data.version,
    createdAt: data.created_at,
  };
}

export async function listConsentResponses(clientId: string): Promise<ConsentResponse[]> {
  const { data, error } = await supabase
    .from("consent_form_responses")
    .select("id, client_id, template_id, template_version, status, signed_name, signed_at, created_at")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    templateId: r.template_id,
    templateVersion: r.template_version,
    status: r.status,
    signedName: r.signed_name,
    signedAt: r.signed_at,
    createdAt: r.created_at,
  }));
}

export async function createConsentResponse(input: {
  tenantId: string;
  clientId: string;
  templateId: string;
  templateVersion?: number;
}): Promise<ConsentResponse> {
  const { data, error } = await supabase
    .from("consent_form_responses")
    .insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      template_id: input.templateId,
      template_version: input.templateVersion ?? 1,
      status: "pending",
    })
    .select("id, client_id, template_id, template_version, status, signed_name, signed_at, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    clientId: data.client_id,
    templateId: data.template_id,
    templateVersion: data.template_version,
    status: data.status,
    signedName: data.signed_name,
    signedAt: data.signed_at,
    createdAt: data.created_at,
  };
}
