/**
 * Repositório: regras de autoatendimento do cliente.
 * Leitura da situação (RPC, já com contadores) e edição pelas configurações.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  defaultSelfServiceRules,
  type SelfServiceRules,
  type SelfServiceStatus,
} from "@/domain/self-service";

type Row = {
  allow_client_confirm: boolean;
  allow_client_reschedule: boolean;
  allow_client_cancel: boolean;
  min_hours_to_reschedule: number;
  min_hours_to_cancel: number;
  max_reschedules_per_appointment: number;
  max_cancellations_per_30d: number;
  max_no_shows_per_90d: number;
  block_days_after_limit: number;
  require_cancel_reason: boolean;
  policy_note: string | null;
};

function toDomain(r: Row): SelfServiceRules {
  return {
    allowConfirm: r.allow_client_confirm,
    allowReschedule: r.allow_client_reschedule,
    allowCancel: r.allow_client_cancel,
    minHoursToReschedule: r.min_hours_to_reschedule,
    minHoursToCancel: r.min_hours_to_cancel,
    maxReschedulesPerAppointment: r.max_reschedules_per_appointment,
    maxCancellationsPer30d: r.max_cancellations_per_30d,
    maxNoShowsPer90d: r.max_no_shows_per_90d,
    blockDaysAfterLimit: r.block_days_after_limit,
    requireCancelReason: r.require_cancel_reason,
    policyNote: r.policy_note,
  };
}

export async function fetchSelfServiceRules(tenantId: string): Promise<SelfServiceRules> {
  const { data, error } = await supabase
    .from("client_self_service_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...defaultSelfServiceRules };
  return toDomain(data as unknown as Row);
}

export async function saveSelfServiceRules(
  tenantId: string,
  rules: SelfServiceRules,
): Promise<void> {
  const payload = {
    tenant_id: tenantId,
    allow_client_confirm: rules.allowConfirm,
    allow_client_reschedule: rules.allowReschedule,
    allow_client_cancel: rules.allowCancel,
    min_hours_to_reschedule: rules.minHoursToReschedule,
    min_hours_to_cancel: rules.minHoursToCancel,
    max_reschedules_per_appointment: rules.maxReschedulesPerAppointment,
    max_cancellations_per_30d: rules.maxCancellationsPer30d,
    max_no_shows_per_90d: rules.maxNoShowsPer90d,
    block_days_after_limit: rules.blockDaysAfterLimit,
    require_cancel_reason: rules.requireCancelReason,
    policy_note: rules.policyNote,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("client_self_service_rules")
    .upsert(payload as never, { onConflict: "tenant_id" });
  if (error) throw error;
}

/** Situação do cliente perante as regras (inclui contadores e bloqueio). */
export async function fetchSelfServiceStatus(
  tenantId: string,
  clientId: string,
): Promise<SelfServiceStatus> {
  const { data, error } = await (supabase.rpc as never as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>)("client_self_service_status", {
    _tenant_id: tenantId,
    _client_id: clientId,
  });
  if (error) throw error;
  return data as SelfServiceStatus;
}
