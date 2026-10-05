/**
 * Service: regras do auto-agendamento pelo cliente.
 *
 * - createBookingFromPortal: cria appointment com source=client_portal,
 *   status=pending, valida slot via RPC e respeita min_advance_hours.
 * - rescheduleFromPortal: reagenda validando as regras no servidor (RPC).
 * - cancelFromPortal: cancela validando as regras no servidor (RPC).
 * - confirmFromPortal: o cliente confirma o próprio horário.
 */
import {
  getAvailableSlots,
  insertAppointment,
} from "@/repositories/scheduling";
import { supabase } from "@/integrations/supabase/client";
import type { CancellationPolicySnapshot } from "@/domain/portal";
import { dateKeyInTimeZone, DEFAULT_TIMEZONE } from "@/lib/date-time";

function parseBookingStart(value: string): Date {
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value);
  if (!dateParts) throw new Error("Informe um horário válido para o agendamento.");

  const [, yearText, monthText, dayText] = dateParts;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const calendarDate = new Date(0);
  calendarDate.setUTCHours(0, 0, 0, 0);
  calendarDate.setUTCFullYear(year, month - 1, day);
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new Error("Informe um horário válido para o agendamento.");
  }

  const startsAt = new Date(value);
  if (!Number.isFinite(startsAt.getTime())) {
    throw new Error("Informe um horário válido para o agendamento.");
  }
  return startsAt;
}

function validateDuration(durationMinutes: number): void {
  if (!Number.isSafeInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error("A duração do serviço está inválida. Atualize o catálogo antes de continuar.");
  }
}

function bookingDay(startsAt: Date, timezone?: string): string {
  try {
    const day = dateKeyInTimeZone(startsAt, timezone ?? DEFAULT_TIMEZONE);
    if (day) return day;
  } catch {
    // Converte timezone ausente/corrompido em erro de domínio sem consultar o backend.
  }
  throw new Error("O fuso horário do estabelecimento está inválido.");
}

export interface CreateBookingInput {
  tenantId: string;
  unitId: string;
  clientId: string;
  professionalId: string;
  serviceId: string;
  startsAt: string;       // ISO
  durationMinutes: number;
  cancellationPolicyId: string | null;
  notes?: string | null;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  totalPriceCents?: number;
  minAdvanceHours?: number;
  createdBy?: string | null;
  tenantTimezone?: string;
}

export async function createBookingFromPortal(input: CreateBookingInput): Promise<string> {
  const startsAt = parseBookingStart(input.startsAt);
  validateDuration(input.durationMinutes);
  const minAdvanceHours = input.minAdvanceHours ?? 0;
  if (!Number.isFinite(minAdvanceHours) || minAdvanceHours < 0) {
    throw new Error("A antecedência mínima do serviço está inválida.");
  }

  const now = Date.now();
  const minAdvanceMs = minAdvanceHours * 36e5;
  if (startsAt.getTime() - now < minAdvanceMs) {
    throw new Error(
      `Este serviço exige pelo menos ${minAdvanceHours}h de antecedência.`,
    );
  }

  // re-valida o slot via RPC
  const day = bookingDay(startsAt, input.tenantTimezone);
  const slots = await getAvailableSlots({
    tenantId: input.tenantId,
    professionalId: input.professionalId,
    unitId: input.unitId,
    serviceId: input.serviceId,
    day,
  });
  const targetIso = startsAt.toISOString();
  const slotMatch = slots.find(
    (s) => Math.abs(new Date(s.startsAt).getTime() - startsAt.getTime()) < 60_000,
  );
  if (!slotMatch) {
    throw new Error("Esse horário acabou de ficar indisponível. Escolha outro, por favor.");
  }

  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000).toISOString();

  const created = await insertAppointment({
    tenantId: input.tenantId,
    unitId: input.unitId,
    clientId: input.clientId,
    professionalId: input.professionalId,
    serviceId: input.serviceId,
    startsAt: targetIso,
    endsAt,
    durationMinutes: input.durationMinutes,
    bufferBeforeMinutes: input.bufferBeforeMinutes ?? 0,
    bufferAfterMinutes: input.bufferAfterMinutes ?? 0,
    cancellationPolicyId: input.cancellationPolicyId ?? null,
    source: "client_portal",
    status: "pending",
    notes: input.notes ?? null,
    totalPriceCents: input.totalPriceCents ?? 0,
    createdBy: input.createdBy ?? null,
  });

  return created.id;
}

export interface RescheduleInput {
  appointmentId: string;
  tenantId: string;
  unitId: string;
  professionalId: string;
  serviceId: string;
  startsAt: string;
  durationMinutes: number;
  policy?: CancellationPolicySnapshot | null;
  currentStartsAt: string;
  tenantTimezone?: string;
}

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ error: unknown }>;

export async function rescheduleFromPortal(input: RescheduleInput): Promise<void> {
  // valida o novo slot
  const startsAt = parseBookingStart(input.startsAt);
  validateDuration(input.durationMinutes);
  const day = bookingDay(startsAt, input.tenantTimezone);
  const slots = await getAvailableSlots({
    tenantId: input.tenantId,
    professionalId: input.professionalId,
    unitId: input.unitId,
    serviceId: input.serviceId,
    day,
  });
  const slotMatch = slots.find(
    (s) => Math.abs(new Date(s.startsAt).getTime() - startsAt.getTime()) < 60_000,
  );
  if (!slotMatch) {
    throw new Error("Esse horário acabou de ficar indisponível. Escolha outro, por favor.");
  }
  const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60_000).toISOString();

  // As regras de autoatendimento são validadas no servidor.
  const { error } = await (supabase.rpc as never as RpcFn)("portal_reschedule_appointment", {
    _appointment_id: input.appointmentId,
    _starts_at: startsAt.toISOString(),
    _ends_at: endsAt,
    _professional_id: input.professionalId,
  });
  if (error) throw new Error((error as { message?: string }).message ?? "Erro ao reagendar");
}

export async function cancelFromPortal(input: {
  appointmentId: string;
  reason?: string | null;
  policy?: CancellationPolicySnapshot | null;
  startsAt?: string;
}): Promise<void> {
  const { error } = await (supabase.rpc as never as RpcFn)("portal_cancel_appointment", {
    _appointment_id: input.appointmentId,
    _reason: input.reason ?? null,
  });
  if (error) throw new Error((error as { message?: string }).message ?? "Erro ao cancelar");
}

export async function confirmFromPortal(appointmentId: string): Promise<void> {
  const { error } = await supabase.rpc("portal_confirm_appointment", {
    _appointment_id: appointmentId,
  });
  if (error) throw new Error(error.message ?? "Erro ao confirmar agendamento");
  // Avisa a recepção e devolve o aviso de confirmação ao cliente.
  // Falhas aqui não podem impedir a confirmação em si.
  try {
    await supabase.functions.invoke("push-dispatch", {
      body: { action: "confirmed", appointmentId },
    });
  } catch {
    /* aviso é secundário */
  }
}


/** Lê uma política de cancelamento por id (snapshot). */
export async function fetchCancellationPolicy(
  policyId: string,
): Promise<CancellationPolicySnapshot | null> {
  const { data, error } = await supabase
    .from("cancellation_policies")
    .select("id, name, description, hours_before_no_charge, late_cancel_fee_pct, no_show_fee_pct")
    .eq("id", policyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    name: data.name as string,
    description: (data.description as string) ?? null,
    hoursBeforeNoCharge: data.hours_before_no_charge as number,
    lateCancelFeePct: data.late_cancel_fee_pct as number,
    noShowFeePct: data.no_show_fee_pct as number,
  };
}
