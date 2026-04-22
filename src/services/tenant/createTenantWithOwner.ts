/**
 * Service: cria um tenant completo (estabelecimento + unidade default
 * + membership owner + tenant_settings + unit_settings).
 *
 * Toda regra de negócio fica aqui (não na UI).
 */
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/utils/slug";
import type { TenantSegment } from "@/domain/tenant";

export interface CreateTenantInput {
  ownerUserId: string;
  name: string;
  segment: TenantSegment;
  timezone?: string;
  currency?: string;
  unitName: string;
  unitPhone?: string;
  brandPrimary?: string;
  brandSecondary?: string;
  brandAccent?: string;
  whatsappPhone?: string;
  logoUrl?: string | null;
}

export interface CreateTenantResult {
  tenantId: string;
  unitId: string;
  slug: string;
}

async function uniqueSlug(base: string): Promise<string> {
  const candidate = slugify(base) || `cativa-${Date.now()}`;
  const { data } = await supabase
    .from("tenants")
    .select("slug")
    .ilike("slug", `${candidate}%`);
  const taken = new Set((data ?? []).map((r) => r.slug));
  if (!taken.has(candidate)) return candidate;
  for (let i = 2; i < 1000; i++) {
    const next = `${candidate}-${i}`;
    if (!taken.has(next)) return next;
  }
  return `${candidate}-${Date.now()}`;
}

export async function createTenantWithOwner(input: CreateTenantInput): Promise<CreateTenantResult> {
  const slug = await uniqueSlug(input.name);
  const tenantId = crypto.randomUUID();
  const unitId = crypto.randomUUID();

  // Sanity check: a sessão atual precisa bater com o ownerUserId,
  // caso contrário a RLS de INSERT em "tenants" rejeita (created_by = auth.uid()).
  const { data: sessionData } = await supabase.auth.getSession();
  const sessionUserId = sessionData.session?.user?.id;
  if (!sessionUserId) {
    throw new Error("Sessão não encontrada. Faça login novamente.");
  }
  if (sessionUserId !== input.ownerUserId) {
    throw new Error(
      `Usuário da sessão (${sessionUserId}) não bate com o solicitante (${input.ownerUserId}). Faça login novamente.`,
    );
  }

  // 1) tenant
  const { error: tErr } = await supabase
    .from("tenants")
    .insert({
      id: tenantId,
      name: input.name,
      slug,
      segment: input.segment,
      timezone: input.timezone ?? "America/Sao_Paulo",
      currency: input.currency ?? "BRL",
      created_by: sessionUserId,
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    });
  if (tErr) {
    console.error("[createTenantWithOwner] insert tenants falhou", { tErr, sessionUserId });
    throw tErr ?? new Error("Falha ao criar estabelecimento");
  }

  // 2) membership owner (necessário antes das demais inserções por causa da RLS)
  const { error: mErr } = await supabase.from("tenant_memberships").insert({
    tenant_id: tenantId,
    user_id: input.ownerUserId,
    role: "owner",
    status: "active",
    accepted_at: new Date().toISOString(),
  });
  if (mErr) throw mErr;

  // 3) unidade default
  const { error: uErr } = await supabase
    .from("units")
    .insert({
      id: unitId,
      tenant_id: tenantId,
      name: input.unitName,
      is_default: true,
      phone: input.unitPhone ?? null,
    });
  if (uErr) throw uErr ?? new Error("Falha ao criar unidade");

  // 4) tenant_settings
  const { error: tsErr } = await supabase.from("tenant_settings").insert({
    tenant_id: tenantId,
    brand_primary: input.brandPrimary ?? null,
    brand_secondary: input.brandSecondary ?? null,
    brand_accent: input.brandAccent ?? null,
    logo_url: input.logoUrl ?? null,
    whatsapp_phone: input.whatsappPhone ?? null,
    default_unit_id: unitId,
  });
  if (tsErr) throw tsErr;

  // 5) unit_settings
  const { error: usErr } = await supabase.from("unit_settings").insert({
    unit_id: unitId,
    tenant_id: tenantId,
  });
  if (usErr) throw usErr;

  // 6) audit log
  await supabase.from("audit_logs").insert({
    tenant_id: tenantId,
    actor_id: input.ownerUserId,
    action: "tenant.created",
    entity: "tenant",
    entity_id: tenantId,
    metadata: { name: input.name, segment: input.segment },
  });

  return { tenantId, unitId, slug };
}
