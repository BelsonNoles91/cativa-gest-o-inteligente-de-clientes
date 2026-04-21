/**
 * Domínio: Tenant (estabelecimento) e Unit (unidade física).
 * Multi-tenant é regra dura. tenant_id deve aparecer em todas as
 * entidades principais. unit_id é opcional.
 */

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  segment: TenantSegment;
  createdAt: string;
}

export interface Unit {
  id: string;
  tenantId: string;
  name: string;
  isDefault?: boolean;
}

export type TenantSegment =
  | "salao"
  | "clinica_estetica"
  | "lash_brow"
  | "barbearia"
  | "esmalteria"
  | "wellness";

export const segmentLabels: Record<TenantSegment, string> = {
  salao: "Salão de beleza",
  clinica_estetica: "Clínica de estética",
  lash_brow: "Lash & Brow",
  barbearia: "Barbearia",
  esmalteria: "Esmalteria",
  wellness: "Massagem & Wellness",
};
