/**
 * Repositório: fidelidade (pontos e recompensas).
 */
import { supabase } from "@/integrations/supabase/client";

export interface LoyaltySettings {
  enabled: boolean;
  pointsPerVisit: number;
  pointsPerReal: number;
  rewardThresholdPoints: number;
  rewardDescription: string | null;
}

export interface LoyaltyEntry {
  id: string;
  clientId: string;
  points: number;
  reason: string;
  createdAt: string;
}

export const defaultLoyaltySettings: LoyaltySettings = {
  enabled: false,
  pointsPerVisit: 10,
  pointsPerReal: 0,
  rewardThresholdPoints: 100,
  rewardDescription: null,
};

export async function fetchLoyaltySettings(tenantId: string): Promise<LoyaltySettings> {
  const { data, error } = await supabase
    .from("loyalty_settings")
    .select("enabled, points_per_visit, points_per_real, reward_threshold_points, reward_description")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...defaultLoyaltySettings };
  return {
    enabled: data.enabled,
    pointsPerVisit: data.points_per_visit,
    pointsPerReal: data.points_per_real,
    rewardThresholdPoints: data.reward_threshold_points,
    rewardDescription: data.reward_description,
  };
}

export async function saveLoyaltySettings(
  tenantId: string,
  s: LoyaltySettings,
  updatedBy?: string | null,
): Promise<void> {
  const { error } = await supabase.from("loyalty_settings").upsert(
    {
      tenant_id: tenantId,
      enabled: s.enabled,
      points_per_visit: s.pointsPerVisit,
      points_per_real: s.pointsPerReal,
      reward_threshold_points: s.rewardThresholdPoints,
      reward_description: s.rewardDescription,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw error;
}

export async function listLoyaltyEntries(
  tenantId: string,
  clientId: string,
): Promise<LoyaltyEntry[]> {
  const { data, error } = await supabase
    .from("loyalty_ledger")
    .select("id, client_id, points, reason, created_at")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    clientId: r.client_id,
    points: r.points,
    reason: r.reason,
    createdAt: r.created_at,
  }));
}

export async function addLoyaltyPoints(input: {
  tenantId: string;
  clientId: string;
  points: number;
  reason: string;
  appointmentId?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("loyalty_ledger").insert({
    tenant_id: input.tenantId,
    client_id: input.clientId,
    points: input.points,
    reason: input.reason,
    appointment_id: input.appointmentId ?? null,
    created_by: input.createdBy ?? null,
  });
  if (error) throw error;
}

export function loyaltyBalance(entries: LoyaltyEntry[]): number {
  return entries.reduce((sum, e) => sum + e.points, 0);
}
