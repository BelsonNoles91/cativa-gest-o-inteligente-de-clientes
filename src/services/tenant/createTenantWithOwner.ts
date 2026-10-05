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
  initialProfessionals?: string[];
  initialServices?: Array<{ name: string; price: string }>;
}

export interface CreateTenantResult {
  tenantId: string;
  unitId: string;
  slug: string;
}

export async function createTenantWithOwner(input: CreateTenantInput): Promise<CreateTenantResult> {
  const { data, error } = await supabase.rpc("create_tenant_with_owner", {
    p_name: input.name,
    p_slug: slugify(input.name),
    p_segment: input.segment,
    p_unit_name: input.unitName,
    p_timezone: input.timezone ?? "America/Sao_Paulo",
    p_currency: input.currency ?? "BRL",
    p_unit_phone: input.unitPhone ?? null,
    p_brand_primary: input.brandPrimary ?? null,
    p_brand_secondary: input.brandSecondary ?? null,
    p_brand_accent: input.brandAccent ?? null,
    p_whatsapp_phone: input.whatsappPhone ?? null,
    p_initial_professionals: (input.initialProfessionals ?? []).map((name) => ({ name })),
    p_initial_services: input.initialServices ?? [],
  });

  if (error) {
    console.error("[createTenantWithOwner] RPC transacional falhou", {
      code: error.code,
      message: error.message,
    });
    throw error;
  }

  const created = data?.[0];
  if (!created?.tenant_id || !created.unit_id || !created.slug) {
    throw new Error("O estabelecimento foi criado, mas a resposta do servidor está incompleta.");
  }

  return {
    tenantId: created.tenant_id,
    unitId: created.unit_id,
    slug: created.slug,
  };
}
