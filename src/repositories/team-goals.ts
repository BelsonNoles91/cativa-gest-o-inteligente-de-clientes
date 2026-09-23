import { supabase } from "@/integrations/supabase/client";
import type { ProfessionalGoal } from "@/domain/team-goals";

export async function listProfessionalGoals(
  tenantId: string,
  periodMonth: string,
): Promise<ProfessionalGoal[]> {
  const { data, error } = await supabase
    .from("professional_goals")
    .select("professional_id, period_month, revenue_goal_cents, appointments_goal")
    .eq("tenant_id", tenantId)
    .eq("period_month", periodMonth);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    professionalId: row.professional_id,
    periodMonth: row.period_month,
    revenueGoalCents: row.revenue_goal_cents,
    appointmentsGoal: row.appointments_goal,
  }));
}

export async function saveProfessionalGoal(input: {
  tenantId: string;
  professionalId: string;
  periodMonth: string;
  revenueGoalCents: number;
  appointmentsGoal: number;
  updatedBy?: string | null;
}): Promise<void> {
  const { error } = await supabase
    .from("professional_goals")
    .upsert(
      {
        tenant_id: input.tenantId,
        professional_id: input.professionalId,
        period_month: input.periodMonth,
        revenue_goal_cents: input.revenueGoalCents,
        appointments_goal: input.appointmentsGoal,
        updated_at: new Date().toISOString(),
        updated_by: input.updatedBy ?? null,
      },
      { onConflict: "tenant_id,professional_id,period_month" },
    );
  if (error) throw error;
}
