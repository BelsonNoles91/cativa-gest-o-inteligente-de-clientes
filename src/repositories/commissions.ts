/**
 * Repositório: regras de comissão e fechamentos por profissional.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CommissionRule } from "@/domain/commissions";

export interface ClosingRow {
  professionalId: string;
  periodMonth: string;
  revenueCents: number;
  commissionCents: number;
  appointmentsCount: number;
  percent: number;
  closedAt: string;
}

export async function listCommissionRules(tenantId: string): Promise<CommissionRule[]> {
  const { data, error } = await supabase
    .from("professional_commission_rules")
    .select("professional_id, percent")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    professionalId: r.professional_id,
    percent: Number(r.percent ?? 0),
  }));
}

export async function saveCommissionRule(input: {
  tenantId: string;
  professionalId: string;
  percent: number;
  updatedBy?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("professional_commission_rules").upsert(
    {
      tenant_id: input.tenantId,
      professional_id: input.professionalId,
      percent: input.percent,
      updated_at: new Date().toISOString(),
      updated_by: input.updatedBy ?? null,
    },
    { onConflict: "tenant_id,professional_id" },
  );
  if (error) throw error;
}

export async function listClosings(
  tenantId: string,
  periodMonth: string,
): Promise<ClosingRow[]> {
  const { data, error } = await supabase
    .from("professional_closings")
    .select(
      "professional_id, period_month, revenue_cents, commission_cents, appointments_count, percent, closed_at",
    )
    .eq("tenant_id", tenantId)
    .eq("period_month", periodMonth);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    professionalId: r.professional_id,
    periodMonth: r.period_month,
    revenueCents: r.revenue_cents,
    commissionCents: r.commission_cents,
    appointmentsCount: r.appointments_count,
    percent: Number(r.percent ?? 0),
    closedAt: r.closed_at,
  }));
}

export async function closeMonth(input: {
  tenantId: string;
  professionalId: string;
  periodMonth: string;
  revenueCents: number;
  commissionCents: number;
  appointmentsCount: number;
  percent: number;
  closedBy?: string | null;
  notes?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("professional_closings").upsert(
    {
      tenant_id: input.tenantId,
      professional_id: input.professionalId,
      period_month: input.periodMonth,
      revenue_cents: input.revenueCents,
      commission_cents: input.commissionCents,
      appointments_count: input.appointmentsCount,
      percent: input.percent,
      notes: input.notes ?? null,
      closed_at: new Date().toISOString(),
      closed_by: input.closedBy ?? null,
    },
    { onConflict: "tenant_id,professional_id,period_month" },
  );
  if (error) throw error;
}

export async function reopenMonth(input: {
  tenantId: string;
  professionalId: string;
  periodMonth: string;
}): Promise<void> {
  const { error } = await supabase
    .from("professional_closings")
    .delete()
    .eq("tenant_id", input.tenantId)
    .eq("professional_id", input.professionalId)
    .eq("period_month", input.periodMonth);
  if (error) throw error;
}
