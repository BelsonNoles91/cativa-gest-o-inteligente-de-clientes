/**
 * Service: regras do auto-agendamento pelo cliente.
 *
 * - createBookingFromPortal: cria appointment com source=client_portal,
 *   status=pending, valida slot via RPC e respeita min_advance_hours.
 * - rescheduleFromPortal: reagenda respeitando política e disponibilidade.
 * - cancelFromPortal: cancela respeitando política (sem multa OU com aviso).
 * - confirmFromPortal: o cliente confirma o próprio horário.
 */
import {
  getAvailableSlots,
  insertAppointment,
  updateAppointment,
  setAppointmentStatus,
} from "@/repositories/scheduling";
import { supabase } from "@/integrations/supabase/client";
import type { CancellationPolicySnapshot } from "@/domain/portal";
import { canCancelWithoutFee } from "@/domain/portal";

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
}

export async function createBookingFromPortal(input: CreateBookingInput): Promise<string> {
  const startsAt = new Date(input.startsAt);
  const now = Date.now();
  const minAdvanceMs = (input.minAdvanceHours ?? 0) * 36e5;
  if (startsAt.getTime() - now < minAdvanceMs) {
    throw new Error(
      `Este serviço exige pelo menos ${input.minAdvanceHours ?? 0}h de antecedência.`,
    );
  }

  // re-valida o slot via RPC
  const day = startsAt.toISOString().slice(0, 10);
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
  policy: CancellationPolicySnapshot | null;
  currentStartsAt: string;
}

export async function rescheduleFromPortal(input: RescheduleInput): Promise<void> {
  const check = canCancelWithoutFee(input.currentStartsAt, input.policy);
  if (!check.allowed && check.willChargeFee) {
    // Permitimos reagendar mesmo dentro da janela, mas o cliente já viu o aviso
    // na UI. Aqui não bloqueamos — apenas registramos como solicitação.
  }

  // valida o novo slot
  const startsAt = new Date(input.startsAt);
  const day = startsAt.toISOString().slice(0, 10);
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

  await updateAppointment(input.appointmentId, {
    startsAt: startsAt.toISOString(),
    endsAt,
    professionalId: input.professionalId,
  });
  // volta para pendente para a recepção reconfirmar
  await setAppointmentStatus(input.appointmentId, "pending");
}

export async function cancelFromPortal(input: {
  appointmentId: string;
  reason?: string | null;
  policy: CancellationPolicySnapshot | null;
  startsAt: string;
}): Promise<{ feePct: number; willChargeFee: boolean }> {
  const check = canCancelWithoutFee(input.startsAt, input.policy);
  await setAppointmentStatus(input.appointmentId, "canceled", {
    reason: input.reason ?? null,
  });
  return { feePct: check.feePct, willChargeFee: check.willChargeFee };
}

export async function confirmFromPortal(appointmentId: string): Promise<void> {
  await setAppointmentStatus(appointmentId, "confirmed");
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
