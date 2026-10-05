/**
 * Repositório do Portal do Cliente. Toda leitura/escrita do auto-atendimento
 * passa por aqui. RLS no banco já garante o escopo por (tenant_id, client_id).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  CancellationPolicySnapshot,
  ClientUserLink,
  PortalAppointmentView,
  PortalConsentPending,
  PortalMembershipView,
  PortalPackageView,
  PortalPreferences,
  PortalReviewInput,
  PortalTenantBranding,
} from "@/domain/portal";
import type {
  Appointment,
  AppointmentSource,
  AppointmentStatus,
} from "@/domain/scheduling";

const APPT_COLS = `
  id, tenant_id, unit_id, client_id, professional_id, resource_id,
  cancellation_policy_id, status, source, starts_at, ends_at,
  duration_minutes, client_reschedule_count, buffer_before_minutes, buffer_after_minutes,
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
    clientRescheduleCount: Number(r.client_reschedule_count ?? 0),
    bufferBeforeMinutes: (r.buffer_before_minutes as number) ?? 0,
    bufferAfterMinutes: (r.buffer_after_minutes as number) ?? 0,
    isWalkIn: Boolean(r.is_walk_in),
    isOverbooked: Boolean(r.is_overbooked),
    totalPriceCents: (r.total_price_cents as number) ?? 0,
    notes: (r.notes as string) ?? null,
    internalNotes: null, // nunca expor ao portal
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
// VÍNCULO USUÁRIO ↔ CLIENTE
// =============================================================================

/** Lista vínculos ativos do usuário autenticado em todos os tenants. */
export async function listMyClientLinks(userId: string): Promise<ClientUserLink[]> {
  const { data, error } = await supabase
    .from("client_users")
    .select("id, tenant_id, client_id, user_id, status, linked_at")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    tenantId: r.tenant_id as string,
    clientId: r.client_id as string,
    userId: r.user_id as string,
    status: r.status as ClientUserLink["status"],
    linkedAt: r.linked_at as string,
  }));
}

export async function claimPortalLinksForCurrentUser(): Promise<number> {
  // Cast pontual: as RPCs existem no banco (migration 20260421235500) mas
  // ainda não constam no `types.ts` gerado. Some quando os types forem regenerados.
  const { data, error } = await supabase.rpc("claim_portal_links_for_current_user" as never);
  if (error) throw error;
  return typeof data === "number" ? data : 0;
}

export async function touchPortalLink(linkId: string): Promise<void> {
  // Cast pontual: idem ao caso acima.
  const { error } = await supabase.rpc(
    "touch_portal_last_seen" as never,
    { _link_id: linkId } as never,
  );
  if (error) throw error;
}

/** Lê branding do tenant (+ unidade preferida do cliente, se houver). */
export async function getPortalBranding(
  tenantId: string,
  preferredUnitId: string | null,
): Promise<PortalTenantBranding | null> {
  const [{ data: tenant }, { data: settings }, { data: unit }] = await Promise.all([
    supabase.from("tenants").select("id, name, slug, segment, timezone").eq("id", tenantId).maybeSingle(),
    supabase.from("tenant_settings").select("logo_url").eq("tenant_id", tenantId).maybeSingle(),
    preferredUnitId
      ? supabase
          .from("units")
          .select("id, name, phone, address_line1, address_line2, city, state")
          .eq("id", preferredUnitId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!tenant) return null;

  const u = unit as Record<string, unknown> | null;
  const addr =
    u
      ? [u.address_line1, u.address_line2, u.city, u.state].filter(Boolean).join(", ")
      : null;

  return {
    tenantId: tenant.id as string,
    tenantName: tenant.name as string,
    tenantSlug: tenant.slug as string,
    segment: tenant.segment as string,
    timezone: (tenant.timezone as string) || "America/Sao_Paulo",
    logoUrl: (settings?.logo_url as string) ?? null,
    unitName: (u?.name as string) ?? null,
    unitPhone: (u?.phone as string) ?? null,
    unitAddress: addr || null,
  };
}

/**
 * Tenta vincular o usuário autenticado a um cliente existente do tenant
 * usando o e-mail verificado da sessão. Cria o cliente se não existir.
 *
 * Idempotente: se já houver vínculo ativo, apenas retorna.
 */
export async function ensureClientUserLink(input: {
  userId: string;
  email: string;
  fullName: string;
  phone?: string | null;
  tenantId: string;
}): Promise<ClientUserLink> {
  // 1) já existe vínculo?
  const existing = await supabase
    .from("client_users")
    .select("id, tenant_id, client_id, user_id, status, linked_at")
    .eq("user_id", input.userId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) {
    const r = existing.data;
    return {
      id: r.id as string,
      tenantId: r.tenant_id as string,
      clientId: r.client_id as string,
      userId: r.user_id as string,
      status: r.status as ClientUserLink["status"],
      linkedAt: r.linked_at as string,
    };
  }

  // 2) procurar cliente por email
  let clientId: string | null = null;
  if (input.email) {
    const { data: byEmail, error: emailErr } = await supabase
      .from("clients")
      .select("id")
      .eq("tenant_id", input.tenantId)
      .ilike("email", input.email)
      .maybeSingle();
    if (emailErr) throw emailErr;
    clientId = (byEmail?.id as string) ?? null;
  }

  // 3) NÃO criamos cliente nem vínculo a partir do client. Esse caminho
  //    self-service é vulnerável (qualquer um pode reivindicar qualquer
  //    cliente). A criação fica restrita à equipe (RLS), e o auto-vínculo
  //    legítimo é feito pela RPC `claim_portal_links_for_current_user`,
  //    que valida o e-mail do JWT contra clients.email server-side.
  if (!clientId) {
    throw new Error(
      "Não encontramos seu cadastro neste estabelecimento. Peça à recepção para criar seu acesso.",
    );
  }

  // 4) Tenta reivindicar via RPC segura. Se o e-mail do JWT bater com algum
  //    cliente do tenant, a RPC cria o vínculo. Senão, devolve 0 e pedimos
  //    que a recepção crie o acesso manualmente.
  const claimed = await claimPortalLinksForCurrentUser();
  if (!claimed) {
    throw new Error(
      "Seu e-mail ainda não está vinculado a um cadastro. Peça à recepção para confirmar seu acesso.",
    );
  }

  // 5) Recarrega o vínculo recém-criado para devolver ao chamador.
  const { data: link, error: linkErr } = await supabase
    .from("client_users")
    .select("id, tenant_id, client_id, user_id, status, linked_at")
    .eq("user_id", input.userId)
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (linkErr) throw linkErr;
  if (!link) {
    throw new Error("Vínculo não encontrado após reivindicação. Tente novamente.");
  }
  return {
    id: link.id as string,
    tenantId: link.tenant_id as string,
    clientId: link.client_id as string,
    userId: link.user_id as string,
    status: link.status as ClientUserLink["status"],
    linkedAt: link.linked_at as string,
  };
}

// =============================================================================
// AGENDAMENTOS DO CLIENTE
// =============================================================================

export async function listMyAppointments(input: {
  tenantId: string;
  clientId: string;
  rangeStart?: string;
  rangeEnd?: string;
  excludeStatuses?: AppointmentStatus[];
}): Promise<PortalAppointmentView[]> {
  let q = supabase
    .from("appointments")
    .select(APPT_COLS)
    .eq("tenant_id", input.tenantId)
    .eq("client_id", input.clientId)
    .order("starts_at", { ascending: false });
  if (input.rangeStart) q = q.gte("starts_at", input.rangeStart);
  if (input.rangeEnd) q = q.lt("starts_at", input.rangeEnd);
  if (input.excludeStatuses?.length) {
    q = q.not("status", "in", `(${input.excludeStatuses.join(",")})`);
  }
  const { data, error } = await q;
  if (error) throw error;

  const appts = (data ?? []).map((r) => toAppointment(r as Record<string, unknown>));
  if (appts.length === 0) return [];

  const apptIds = appts.map((a) => a.id);
  const proIds = Array.from(new Set(appts.map((a) => a.professionalId).filter(Boolean)));
  const unitIds = Array.from(new Set(appts.map((a) => a.unitId).filter(Boolean)));
  const polIds = Array.from(
    new Set(appts.map((a) => a.cancellationPolicyId).filter((x): x is string => Boolean(x))),
  );

  const [itemsRes, prosRes, unitsRes, polsRes] = await Promise.all([
    supabase
      .from("appointment_items")
      .select("appointment_id, service_id, position")
      .in("appointment_id", apptIds)
      .order("position"),
    proIds.length
      ? supabase.from("professionals").select("id, display_name").in("id", proIds)
      : Promise.resolve({ data: [], error: null }),
    unitIds.length
      ? supabase.from("units").select("id, name").in("id", unitIds)
      : Promise.resolve({ data: [], error: null }),
    polIds.length
      ? supabase
          .from("cancellation_policies")
          .select("id, name, description, hours_before_no_charge, late_cancel_fee_pct, no_show_fee_pct")
          .in("id", polIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsRes.error) throw itemsRes.error;
  if (prosRes.error) throw prosRes.error;
  if (unitsRes.error) throw unitsRes.error;
  if (polsRes.error) throw polsRes.error;

  const svcIds = Array.from(
    new Set((itemsRes.data ?? []).map((i) => i.service_id as string).filter(Boolean)),
  );
  const svcRes = svcIds.length
    ? await supabase.from("services").select("id, name").in("id", svcIds)
    : { data: [], error: null };
  if (svcRes.error) throw svcRes.error;

  const proMap = new Map((prosRes.data ?? []).map((p) => [p.id as string, p.display_name as string]));
  const unitMap = new Map((unitsRes.data ?? []).map((u) => [u.id as string, u.name as string]));
  const polMap = new Map(
    (polsRes.data ?? []).map((p) => [
      p.id as string,
      {
        id: p.id as string,
        name: p.name as string,
        description: (p.description as string) ?? null,
        hoursBeforeNoCharge: p.hours_before_no_charge as number,
        lateCancelFeePct: p.late_cancel_fee_pct as number,
        noShowFeePct: p.no_show_fee_pct as number,
      } as CancellationPolicySnapshot,
    ]),
  );
  const svcMap = new Map((svcRes.data ?? []).map((s) => [s.id as string, s.name as string]));

  const firstSvcByAppt = new Map<string, string>();
  for (const it of itemsRes.data ?? []) {
    const k = it.appointment_id as string;
    if (!firstSvcByAppt.has(k) && it.service_id)
      firstSvcByAppt.set(k, it.service_id as string);
  }

  return appts.map((a) => ({
    appointment: a,
    serviceName: (() => {
      const sid = firstSvcByAppt.get(a.id);
      return sid ? svcMap.get(sid) ?? null : null;
    })(),
    professionalName: proMap.get(a.professionalId) ?? null,
    unitName: unitMap.get(a.unitId) ?? null,
    policy: a.cancellationPolicyId ? polMap.get(a.cancellationPolicyId) ?? null : null,
  }));
}

// =============================================================================
// CATÁLOGO PARA AUTOATENDIMENTO
// =============================================================================

export interface PortalServiceOption {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  bufferBeforeMinutes: number;
  bufferAfterMinutes: number;
  processingMinutes: number;
  minAdvanceHours: number;
  maxAdvanceDays: number;
  isFeatured: boolean;
  cancellationPolicyId: string | null;
}

export async function listPortalServices(tenantId: string): Promise<PortalServiceOption[]> {
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, name, description, duration_minutes, buffer_before_minutes, buffer_after_minutes, processing_minutes, min_advance_hours, max_advance_days, is_featured, cancellation_policy_id",
    )
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_featured", { ascending: false })
    .order("position", { ascending: true })
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    durationMinutes: r.duration_minutes as number,
    bufferBeforeMinutes: (r.buffer_before_minutes as number) ?? 0,
    bufferAfterMinutes: (r.buffer_after_minutes as number) ?? 0,
    processingMinutes: (r.processing_minutes as number) ?? 0,
    minAdvanceHours: (r.min_advance_hours as number) ?? 0,
    maxAdvanceDays: (r.max_advance_days as number) ?? 60,
    isFeatured: Boolean(r.is_featured),
    cancellationPolicyId: (r.cancellation_policy_id as string) ?? null,
  }));
}

export interface PortalProfessionalOption {
  id: string;
  displayName: string;
  roleTitle: string | null;
  bio: string | null;
  unitId: string | null;
  color: string | null;
}

export async function listPortalProfessionals(
  tenantId: string,
  unitId?: string | null,
): Promise<PortalProfessionalOption[]> {
  let q = supabase
    .from("professionals")
    .select("id, display_name, role_title, bio, unit_id, color")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("display_name");
  if (unitId) q = q.or(`unit_id.eq.${unitId},unit_id.is.null`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    roleTitle: (r.role_title as string) ?? null,
    bio: (r.bio as string) ?? null,
    unitId: (r.unit_id as string) ?? null,
    color: (r.color as string) ?? null,
  }));
}

export interface PortalUnitOption {
  id: string;
  name: string;
  isDefault: boolean;
}

export async function listPortalUnits(tenantId: string): Promise<PortalUnitOption[]> {
  const { data, error } = await supabase
    .from("units")
    .select("id, name, is_default")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    isDefault: Boolean(r.is_default),
  }));
}

// =============================================================================
// PACOTES & MEMBERSHIPS DO CLIENTE
// =============================================================================

export async function listMyPackages(
  tenantId: string,
  clientId: string,
): Promise<PortalPackageView[]> {
  const { data, error } = await supabase
    .from("client_package_balances")
    .select(
      "id, package_id, service_id, sessions_total, sessions_used, status, expires_at, purchased_at",
    )
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .order("purchased_at", { ascending: false });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const pkgIds = Array.from(new Set(rows.map((r) => r.package_id as string)));
  const svcIds = Array.from(
    new Set(rows.map((r) => r.service_id as string).filter(Boolean)),
  );

  const [pkgRes, svcRes] = await Promise.all([
    supabase.from("packages").select("id, name").in("id", pkgIds),
    svcIds.length
      ? supabase.from("services").select("id, name").in("id", svcIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (pkgRes.error) throw pkgRes.error;
  if (svcRes.error) throw svcRes.error;

  const pkgMap = new Map((pkgRes.data ?? []).map((p) => [p.id as string, p.name as string]));
  const svcMap = new Map((svcRes.data ?? []).map((s) => [s.id as string, s.name as string]));

  return rows.map((r) => ({
    id: r.id as string,
    packageName: pkgMap.get(r.package_id as string) ?? "Pacote",
    serviceName: r.service_id ? svcMap.get(r.service_id as string) ?? null : null,
    sessionsTotal: r.sessions_total as number,
    sessionsUsed: r.sessions_used as number,
    status: r.status as string,
    expiresAt: (r.expires_at as string) ?? null,
    purchasedAt: r.purchased_at as string,
  }));
}

export async function listMyMemberships(
  tenantId: string,
  clientId: string,
): Promise<PortalMembershipView[]> {
  const { data, error } = await supabase
    .from("client_membership_subscriptions")
    .select(
      "id, membership_id, status, started_at, current_cycle_end",
    )
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .order("started_at", { ascending: false });
  if (error) throw error;
  const subs = data ?? [];
  if (subs.length === 0) return [];

  const memIds = Array.from(new Set(subs.map((s) => s.membership_id as string)));
  const [memRes, benRes] = await Promise.all([
    supabase.from("memberships").select("id, name").in("id", memIds),
    supabase
      .from("membership_benefits")
      .select("membership_id, service_id, sessions_per_cycle, discount_pct")
      .in("membership_id", memIds),
  ]);
  if (memRes.error) throw memRes.error;
  if (benRes.error) throw benRes.error;

  const svcIds = Array.from(
    new Set((benRes.data ?? []).map((b) => b.service_id as string).filter(Boolean)),
  );
  const svcRes = svcIds.length
    ? await supabase.from("services").select("id, name").in("id", svcIds)
    : { data: [], error: null };
  if (svcRes.error) throw svcRes.error;

  const memMap = new Map((memRes.data ?? []).map((m) => [m.id as string, m.name as string]));
  const svcMap = new Map((svcRes.data ?? []).map((s) => [s.id as string, s.name as string]));

  return subs.map((s) => {
    const benefits = (benRes.data ?? [])
      .filter((b) => b.membership_id === s.membership_id)
      .map((b) => ({
        serviceName: b.service_id ? svcMap.get(b.service_id as string) ?? null : null,
        sessionsPerCycle: b.sessions_per_cycle as number,
        discountPct: b.discount_pct as number,
      }));
    return {
      id: s.id as string,
      membershipName: memMap.get(s.membership_id as string) ?? "Plano",
      status: s.status as string,
      startedAt: s.started_at as string,
      currentCycleEnd: (s.current_cycle_end as string) ?? null,
      benefits,
    };
  });
}

// =============================================================================
// PERFIL & PREFERÊNCIAS
// =============================================================================

export interface ClientProfile {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  whatsappPhone: string | null;
  birthDate: string | null;
  preferredUnitId: string | null;
  preferredProfessionalId: string | null;
  preferences: string | null;
  allergies: string | null;
  contraindications: string | null;
  city: string | null;
  state: string | null;
}

export async function getClientProfile(clientId: string): Promise<ClientProfile | null> {
  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, full_name, email, phone, whatsapp_phone, birth_date, preferred_unit_id, preferred_professional_id, preferences, allergies, contraindications, city, state",
    )
    .eq("id", clientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    fullName: data.full_name as string,
    email: (data.email as string) ?? null,
    phone: (data.phone as string) ?? null,
    whatsappPhone: (data.whatsapp_phone as string) ?? null,
    birthDate: (data.birth_date as string) ?? null,
    preferredUnitId: (data.preferred_unit_id as string) ?? null,
    preferredProfessionalId: (data.preferred_professional_id as string) ?? null,
    preferences: (data.preferences as string) ?? null,
    allergies: (data.allergies as string) ?? null,
    contraindications: (data.contraindications as string) ?? null,
    city: (data.city as string) ?? null,
    state: (data.state as string) ?? null,
  };
}

export async function updateClientProfile(
  clientId: string,
  patch: Partial<{
    fullName: string;
    phone: string | null;
    whatsappPhone: string | null;
    birthDate: string | null;
    preferences: string | null;
    allergies: string | null;
    contraindications: string | null;
    city: string | null;
    state: string | null;
  }>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.fullName !== undefined) dbPatch.full_name = patch.fullName;
  if (patch.phone !== undefined) dbPatch.phone = patch.phone;
  if (patch.whatsappPhone !== undefined) dbPatch.whatsapp_phone = patch.whatsappPhone;
  if (patch.birthDate !== undefined) dbPatch.birth_date = patch.birthDate;
  if (patch.preferences !== undefined) dbPatch.preferences = patch.preferences;
  if (patch.allergies !== undefined) dbPatch.allergies = patch.allergies;
  if (patch.contraindications !== undefined) dbPatch.contraindications = patch.contraindications;
  if (patch.city !== undefined) dbPatch.city = patch.city;
  if (patch.state !== undefined) dbPatch.state = patch.state;
  const { error } = await supabase.from("clients").update(dbPatch as never).eq("id", clientId);
  if (error) throw error;
}

export async function updateClientPreferences(
  clientId: string,
  prefs: PortalPreferences,
): Promise<void> {
  const { error } = await supabase
    .from("clients")
    .update({
      preferred_unit_id: prefs.preferredUnitId,
      preferred_professional_id: prefs.preferredProfessionalId,
    } as never)
    .eq("id", clientId);
  if (error) throw error;
}

// =============================================================================
// REVIEWS
// =============================================================================

export async function submitReview(input: {
  tenantId: string;
  clientId: string;
  professionalId: string | null;
  review: PortalReviewInput;
}): Promise<void> {
  const { error } = await supabase.from("client_reviews").insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    appointment_id: input.review.appointmentId,
    professional_id: input.professionalId,
    rating: input.review.rating,
    comment: input.review.comment ?? null,
    would_recommend: input.review.wouldRecommend ?? null,
  });
  if (error) throw error;
}

export async function listMyReviews(
  tenantId: string,
  clientId: string,
): Promise<Array<{ appointmentId: string; rating: number; comment: string | null }>> {
  const { data, error } = await supabase
    .from("client_reviews")
    .select("appointment_id, rating, comment")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    appointmentId: r.appointment_id as string,
    rating: r.rating as number,
    comment: (r.comment as string) ?? null,
  }));
}

// =============================================================================
// CONSENT FORMS
// =============================================================================

export async function listMyPendingConsents(
  tenantId: string,
  clientId: string,
): Promise<PortalConsentPending[]> {
  const { data, error } = await supabase
    .from("consent_form_responses")
    .select(
      "id, template_id, template_version, status, created_at, consent_form_templates(id, title, body)",
    )
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw error;
  type Row = {
    id: string;
    template_id: string;
    template_version: number;
    status: string;
    created_at: string;
    consent_form_templates: { id: string; title: string; body: string } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    responseId: r.id,
    templateId: r.template_id,
    templateVersion: r.template_version,
    templateTitle: r.consent_form_templates?.title ?? "Termo",
    templateBody: r.consent_form_templates?.body ?? "",
    status: "pending",
    createdAt: r.created_at,
  }));
}

export async function signConsent(input: {
  responseId: string;
  signedName: string;
  signedText: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("consent_form_responses")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_by: input.userId,
      signed_name: input.signedName,
      signed_text: input.signedText,
    } as never)
    .eq("id", input.responseId);
  if (error) throw error;
}
