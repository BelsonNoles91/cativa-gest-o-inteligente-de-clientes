/**
 * Service: gera itens da Central de Confirmação a partir dos
 * agendamentos e regras configuradas. Manual / sob demanda.
 *
 * Cria entradas em `confirmation_queue` para cada agendamento elegível
 * no horizonte (default: próximos 7 dias) que ainda não tenha um item
 * de fila aberto. Calcula prioridade via RPC `calculate_queue_priority`.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ConfirmationStage } from "@/domain/confirmation";

interface RuleRow {
  id: string;
  stage: ConfirmationStage;
  hours_before_appointment: number;
  base_priority: number;
  applies_to_vip: boolean;
  applies_to_protocol: boolean;
  applies_to_high_risk: boolean;
  min_appointment_value_cents: number | null;
  skip_if_already_confirmed: boolean;
  is_active: boolean;
  unit_id: string | null;
}

interface ApptRow {
  id: string;
  client_id: string;
  unit_id: string;
  starts_at: string;
  status: string;
  total_price_cents: number;
}

interface ClientRow {
  id: string;
  is_vip: boolean;
  risk_level: string;
}

function pickStageForAppointment(starts: Date, now: Date): ConfirmationStage | null {
  const diffH = (starts.getTime() - now.getTime()) / 36e5;
  if (diffH < 0) return null;
  if (diffH <= 24) return "today";
  if (diffH <= 48) return "tomorrow";
  if (diffH <= 24 * 7) return "upcoming";
  return null;
}

export interface GenerateQueueResult {
  created: number;
  skipped: number;
  total: number;
}

export async function generateQueueForTenant(
  tenantId: string,
  options?: { horizonDays?: number },
): Promise<GenerateQueueResult> {
  const horizonDays = options?.horizonDays ?? 7;
  const now = new Date();
  const until = new Date(now.getTime() + horizonDays * 86400000);

  // Carrega regras ativas
  const { data: rulesData, error: rulesErr } = await supabase
    .from("confirmation_rules")
    .select("id, stage, hours_before_appointment, base_priority, applies_to_vip, applies_to_protocol, applies_to_high_risk, min_appointment_value_cents, skip_if_already_confirmed, is_active, unit_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);
  if (rulesErr) throw rulesErr;
  const rules = (rulesData ?? []) as RuleRow[];

  // Agendamentos elegíveis
  const { data: apptsData, error: apptsErr } = await supabase
    .from("appointments")
    .select("id, client_id, unit_id, starts_at, status, total_price_cents")
    .eq("tenant_id", tenantId)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", until.toISOString())
    .not("status", "in", "(canceled,no_show,completed)");
  if (apptsErr) throw apptsErr;
  const appts = (apptsData ?? []) as ApptRow[];
  if (appts.length === 0) return { created: 0, skipped: 0, total: 0 };

  // Carrega clients para flags VIP / risk
  const clientIds = Array.from(new Set(appts.map((a) => a.client_id)));
  const { data: clientsData, error: cliErr } = await supabase
    .from("clients")
    .select("id, is_vip, risk_level")
    .in("id", clientIds);
  if (cliErr) throw cliErr;
  const cliMap = new Map<string, ClientRow>();
  for (const c of clientsData ?? []) cliMap.set(c.id as string, c as ClientRow);

  // Itens já existentes (para deduplicar por appointment_id + stage)
  const apptIds = appts.map((a) => a.id);
  const { data: existing, error: exErr } = await supabase
    .from("confirmation_queue")
    .select("appointment_id, stage, status")
    .in("appointment_id", apptIds);
  if (exErr) throw exErr;
  const existingKey = new Set(
    (existing ?? [])
      .filter((e) => !["closed", "confirmed", "canceled"].includes(e.status as string))
      .map((e) => `${e.appointment_id}:${e.stage}`),
  );

  let created = 0;
  let skipped = 0;

  for (const appt of appts) {
    const startsAt = new Date(appt.starts_at);
    const baseStage = pickStageForAppointment(startsAt, now);
    const cli = cliMap.get(appt.client_id);

    // Etapas extras (high_risk / premium) podem coexistir
    const stages: ConfirmationStage[] = [];
    if (baseStage) stages.push(baseStage);
    if (cli?.risk_level === "high") stages.push("high_risk");
    if (cli?.is_vip || appt.total_price_cents >= 50000) stages.push("premium");

    for (const stage of stages) {
      const key = `${appt.id}:${stage}`;
      if (existingKey.has(key)) {
        skipped++;
        continue;
      }
      // Pega regra mais específica (unidade igual) ou genérica
      const rule =
        rules.find((r) => r.stage === stage && r.unit_id === appt.unit_id) ??
        rules.find((r) => r.stage === stage && r.unit_id == null);

      // Calcula prioridade via RPC
      let priority = rule?.base_priority ?? 50;
      try {
        const { data: prioData } = await supabase.rpc("calculate_queue_priority", {
          _tenant_id: tenantId,
          _client_id: appt.client_id,
          _appointment_id: appt.id,
          _stage: stage,
          _base_priority: priority,
        });
        if (typeof prioData === "number") priority = prioData;
      } catch {
        // mantém base_priority em caso de falha
      }

      const { error: insErr } = await supabase.from("confirmation_queue").insert({
        tenant_id: tenantId,
        appointment_id: appt.id,
        client_id: appt.client_id,
        appointment_starts_at: appt.starts_at,
        stage,
        rule_id: rule?.id ?? null,
        priority,
      });
      if (insErr) {
        skipped++;
      } else {
        created++;
        existingKey.add(key);
      }
    }
  }

  return { created, skipped, total: created + skipped };
}
