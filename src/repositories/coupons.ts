/**
 * Repositório: cupons de reativação (desconto oferecido a quem parou de vir).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ReactivationCoupon {
  id: string;
  tenantId: string;
  clientId: string;
  code: string;
  label: string | null;
  discountPercent: number;
  discountCents: number;
  expiresAt: string | null;
  status: "active" | "redeemed" | "canceled";
  createdAt: string;
}

const COLS =
  "id, tenant_id, client_id, code, label, discount_percent, discount_cents, expires_at, status, created_at";

type Row = {
  id: string;
  tenant_id: string;
  client_id: string;
  code: string;
  label: string | null;
  discount_percent: number;
  discount_cents: number;
  expires_at: string | null;
  status: string;
  created_at: string;
};

function toDomain(r: Row): ReactivationCoupon {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    clientId: r.client_id,
    code: r.code,
    label: r.label,
    discountPercent: r.discount_percent,
    discountCents: r.discount_cents,
    expiresAt: r.expires_at,
    status: (r.status as ReactivationCoupon["status"]) ?? "active",
    createdAt: r.created_at,
  };
}

/** Código curto e legível para o cliente informar na recepção. */
export function generateCouponCode(prefix = "VOLTA"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `${prefix}-${suffix}`;
}

export async function listCoupons(tenantId: string): Promise<ReactivationCoupon[]> {
  const { data, error } = await supabase
    .from("reactivation_coupons")
    .select(COLS)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toDomain);
}

export async function listMyCoupons(
  tenantId: string,
  clientId: string,
): Promise<ReactivationCoupon[]> {
  const { data, error } = await supabase
    .from("reactivation_coupons")
    .select(COLS)
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toDomain);
}

export async function createCoupon(input: {
  tenantId: string;
  clientId: string;
  code: string;
  label?: string | null;
  discountPercent?: number;
  discountCents?: number;
  expiresAt?: string | null;
  createdBy?: string | null;
}): Promise<ReactivationCoupon> {
  const { data, error } = await supabase
    .from("reactivation_coupons")
    .insert({
      tenant_id: input.tenantId,
      client_id: input.clientId,
      code: input.code,
      label: input.label ?? null,
      discount_percent: input.discountPercent ?? 0,
      discount_cents: input.discountCents ?? 0,
      expires_at: input.expiresAt ?? null,
      created_by: input.createdBy ?? null,
    })
    .select(COLS)
    .single();
  if (error) throw error;
  return toDomain(data as Row);
}

export async function redeemCoupon(id: string, appointmentId?: string | null): Promise<void> {
  const { error } = await supabase
    .from("reactivation_coupons")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      appointment_id: appointmentId ?? null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelCoupon(id: string): Promise<void> {
  const { error } = await supabase
    .from("reactivation_coupons")
    .update({ status: "canceled" })
    .eq("id", id);
  if (error) throw error;
}

export function couponDescription(c: ReactivationCoupon): string {
  if (c.discountPercent > 0) return `${c.discountPercent}% de desconto`;
  if (c.discountCents > 0) return `R$ ${(c.discountCents / 100).toFixed(2).replace(".", ",")} de desconto`;
  return c.label ?? "Condição especial";
}
