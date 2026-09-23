/**
 * Repositório da página pública de divulgação (/e/:slug).
 *
 * Toda leitura pública passa por RPCs SECURITY DEFINER que expõem apenas
 * campos de vitrine. Nada aqui lê tabelas internas diretamente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface PublicTenantPage {
  tenantId: string;
  name: string;
  slug: string;
  segment: string | null;
  headline: string | null;
  about: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
}

export interface PublicBusinessHour {
  weekday: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface PublicUnit {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  hours: PublicBusinessHour[];
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number;
  isFeatured: boolean;
}

export interface PublicProfessional {
  id: string;
  displayName: string;
  roleTitle: string | null;
  specialty: string | null;
  bio: string | null;
  unitId: string | null;
}

export interface PublicSlot {
  professionalId: string;
  professionalName: string;
  startsAt: string;
  endsAt: string;
}

export async function getPublicTenantPage(slug: string): Promise<PublicTenantPage | null> {
  const { data, error } = await supabase.rpc("get_public_tenant_page", { _slug: slug });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    name: row.name,
    slug: row.slug,
    segment: row.segment ?? null,
    headline: row.headline ?? null,
    about: row.about ?? null,
    coverUrl: row.cover_url ?? null,
    logoUrl: row.logo_url ?? null,
    whatsapp: row.whatsapp ?? null,
    instagram: row.instagram ?? null,
    website: row.website ?? null,
  };
}

export async function listPublicUnits(slug: string): Promise<PublicUnit[]> {
  const { data, error } = await supabase.rpc("get_public_units", { _slug: slug });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? null,
    address: r.address ?? null,
    city: r.city ?? null,
    state: r.state ?? null,
    hours: Array.isArray(r.hours) ? (r.hours as unknown as PublicBusinessHour[]) : [],
  }));
}

export async function listPublicServices(slug: string): Promise<PublicService[]> {
  const { data, error } = await supabase.rpc("get_public_services", { _slug: slug });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    durationMinutes: r.duration_minutes,
    priceCents: r.price_cents ?? 0,
    isFeatured: Boolean(r.is_featured),
  }));
}

export async function listPublicProfessionals(
  slug: string,
  unitId?: string | null,
): Promise<PublicProfessional[]> {
  const { data, error } = await supabase.rpc("get_public_professionals", {
    _slug: slug,
    _unit_id: unitId ?? undefined,
  });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    roleTitle: r.role_title ?? null,
    specialty: r.specialty ?? null,
    bio: r.bio ?? null,
    unitId: r.unit_id ?? null,
  }));
}

export async function listPublicAvailability(input: {
  slug: string;
  unitId: string;
  serviceId: string;
  day: string; // yyyy-mm-dd
  professionalId?: string | null;
}): Promise<PublicSlot[]> {
  const { data, error } = await supabase.rpc("get_public_availability", {
    _slug: input.slug,
    _unit_id: input.unitId,
    _service_id: input.serviceId,
    _day: input.day,
    _professional_id: input.professionalId ?? undefined,
  });
  if (error) throw error;
  return (data ?? [])
    .map((r) => ({
      professionalId: r.professional_id,
      professionalName: r.professional_name,
      startsAt: r.slot_start,
      endsAt: r.slot_end,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export async function createPublicAppointment(input: {
  slug: string;
  unitId: string;
  serviceId: string;
  professionalId: string;
  startsAt: string;
  fullName?: string | null;
  phone?: string | null;
  notes?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_public_appointment", {
    _slug: input.slug,
    _unit_id: input.unitId,
    _service_id: input.serviceId,
    _professional_id: input.professionalId,
    _starts_at: input.startsAt,
    _full_name: input.fullName ?? undefined,
    _phone: input.phone ?? undefined,
    _notes: input.notes ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

// =============================================================================
// ADMINISTRAÇÃO DA PÁGINA (owner/manager)
// =============================================================================

export interface TenantPublicPageSettings {
  isPublished: boolean;
  headline: string | null;
  about: string | null;
  coverUrl: string | null;
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
}

export async function getTenantPublicPageSettings(
  tenantId: string,
): Promise<TenantPublicPageSettings | null> {
  const { data, error } = await supabase
    .from("tenant_public_pages")
    .select("is_published, headline, about, cover_url, whatsapp, instagram, website")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    isPublished: Boolean(data.is_published),
    headline: data.headline ?? null,
    about: data.about ?? null,
    coverUrl: data.cover_url ?? null,
    whatsapp: data.whatsapp ?? null,
    instagram: data.instagram ?? null,
    website: data.website ?? null,
  };
}

export async function saveTenantPublicPageSettings(
  tenantId: string,
  input: TenantPublicPageSettings,
): Promise<void> {
  const { error } = await supabase.from("tenant_public_pages").upsert(
    {
      tenant_id: tenantId,
      is_published: input.isPublished,
      headline: input.headline,
      about: input.about,
      cover_url: input.coverUrl,
      whatsapp: input.whatsapp,
      instagram: input.instagram,
      website: input.website,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw error;
}

export interface PublicVisibilityItem {
  id: string;
  name: string;
  isPublic: boolean;
}

export async function listUnitsVisibility(tenantId: string): Promise<PublicVisibilityItem[]> {
  const { data, error } = await supabase
    .from("units")
    .select("id, name, is_public")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, isPublic: Boolean(r.is_public) }));
}

export async function listServicesVisibility(tenantId: string): Promise<PublicVisibilityItem[]> {
  const { data, error } = await supabase
    .from("services")
    .select("id, name, is_public")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => ({ id: r.id, name: r.name, isPublic: Boolean(r.is_public) }));
}

export async function setUnitVisibility(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from("units").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}

export async function setServiceVisibility(id: string, isPublic: boolean): Promise<void> {
  const { error } = await supabase.from("services").update({ is_public: isPublic }).eq("id", id);
  if (error) throw error;
}
