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
import {
  getQueueScheduledFor,
  matchesConfirmationRule,
} from "./queueRules";

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
  confirmed_at: string | null;
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
  warning?: string;
}

async function syncReactivationTasks(tenantId: string): Promise<string | undefined> {
  try {
    const { error } = await supabase.rpc("generate_reactivation_tasks", {
      _tenant_id: tenantId,
    });
    if (error) return `Falha ao sincronizar tarefas de recuperação: ${error.message}`;
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro inesperado";
    return `Falha ao sincronizar tarefas de recuperação: ${message}`;
  }
  return undefined;
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
  const invalidRule = rules.find(
    (rule) => !Number.isInteger(rule.hours_before_appointment) || rule.hours_before_appointment < 0,
  );
  if (invalidRule) {
    throw new Error(`A regra ${invalidRule.id} tem antecedência inválida; use horas inteiras não negativas.`);
  }

  // Agendamentos elegíveis
  const { data: apptsData, error: apptsErr } = await supabase
    .from("appointments")
    .select("id, client_id, unit_id, starts_at, status, total_price_cents, confirmed_at")
    .eq("tenant_id", tenantId)
    .gte("starts_at", now.toISOString())
    .lte("starts_at", until.toISOString())
    .not("status", "in", "(canceled,no_show,completed)");
  if (apptsErr) throw apptsErr;
  const appts = (apptsData ?? []) as ApptRow[];
  if (appts.length === 0) {
    const warning = await syncReactivationTasks(tenantId);
    return { created: 0, skipped: 0, total: 0, ...(warning ? { warning } : {}) };
  }

  // Carrega clients para flags VIP / risk
  const clientIds = Array.from(new Set(appts.map((a) => a.client_id)));
  const { data: clientsData, error: cliErr } = await supabase
    .from("clients")
    .select("id, is_vip, risk_level")
    .in("id", clientIds);
  if (cliErr) throw cliErr;
  const cliMap = new Map<string, ClientRow>();
  for (const c of clientsData ?? []) cliMap.set(c.id as string, c as ClientRow);

  // Protocol appointments are derived from booked appointment_items whose
  // services belong to a configured protocol session in this tenant.
  const protocolAppointmentIds = new Set<string>();
  if (rules.some((rule) => rule.applies_to_protocol)) {
    const [appointmentItemsRes, protocolSessionsRes] = await Promise.all([
      supabase
        .from("appointment_items")
        .select("appointment_id, service_id")
        .eq("tenant_id", tenantId)
        .in("appointment_id", appts.map((appointment) => appointment.id)),
      supabase
        .from("protocol_sessions")
        .select("service_id")
        .eq("tenant_id", tenantId),
    ]);
    if (appointmentItemsRes.error) throw appointmentItemsRes.error;
    if (protocolSessionsRes.error) throw protocolSessionsRes.error;

    const protocolServiceIds = new Set(
      (protocolSessionsRes.data ?? []).map((session) => session.service_id as string),
    );
    for (const item of appointmentItemsRes.data ?? []) {
      if (protocolServiceIds.has(item.service_id as string)) {
        protocolAppointmentIds.add(item.appointment_id as string);
      }
    }
  }

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

      if (rule) {
        if (!matchesConfirmationRule(
          {
            appliesToVip: rule.applies_to_vip,
            appliesToHighRisk: rule.applies_to_high_risk,
            appliesToProtocol: rule.applies_to_protocol,
            minAppointmentValueCents: rule.min_appointment_value_cents,
            skipIfAlreadyConfirmed: rule.skip_if_already_confirmed,
          },
          {
            status: appt.status,
            confirmedAt: appt.confirmed_at,
            totalPriceCents: appt.total_price_cents,
          },
          cli ? { isVip: cli.is_vip, riskLevel: cli.risk_level } : null,
          protocolAppointmentIds.has(appt.id),
        )) {
          skipped++;
          continue;
        }
      } else if (appt.status === "confirmed" || appt.confirmed_at !== null) {
        // Even without custom rules, already-confirmed appointments should not
        // produce a new manual contact task.
        skipped++;
        continue;
      }

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
        scheduled_for: rule
          ? getQueueScheduledFor(appt.starts_at, rule.hours_before_appointment)
          : now.toISOString(),
      });
      if (insErr) {
        skipped++;
      } else {
        created++;
        existingKey.add(key);
      }
    }
  }

  // Gera também tarefas de reativação (Recovery) mesmo quando esta execução
  // não encontra novos agendamentos. Erros são apresentados sem apagar o
  // resultado parcial da geração principal.
  const warning = await syncReactivationTasks(tenantId);

  return { created, skipped, total: created + skipped, ...(warning ? { warning } : {}) };
}
