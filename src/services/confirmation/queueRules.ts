import type { ConfirmationRule } from "@/domain/confirmation";

export type ConfirmationRuleFilters = Pick<
  ConfirmationRule,
  | "appliesToVip"
  | "appliesToHighRisk"
  | "appliesToProtocol"
  | "minAppointmentValueCents"
  | "skipIfAlreadyConfirmed"
>;

export interface ConfirmationRuleAppointment {
  status: string;
  confirmedAt: string | null;
  totalPriceCents: number;
}

export interface ConfirmationRuleClient {
  isVip: boolean;
  riskLevel: string;
}

/**
 * Treat enabled rule switches as conjunctive audience filters: every enabled
 * criterion must match. Unchecked criteria do not exclude an appointment.
 */
export function matchesConfirmationRule(
  rule: ConfirmationRuleFilters,
  appointment: ConfirmationRuleAppointment,
  client: ConfirmationRuleClient | null,
  appointmentHasProtocol: boolean,
): boolean {
  if (
    rule.skipIfAlreadyConfirmed &&
    (appointment.status === "confirmed" || appointment.confirmedAt !== null)
  ) {
    return false;
  }
  if (rule.appliesToVip && !client?.isVip) return false;
  if (rule.appliesToHighRisk && client?.riskLevel !== "high") return false;
  if (rule.appliesToProtocol && !appointmentHasProtocol) return false;
  if (
    rule.minAppointmentValueCents !== null &&
    appointment.totalPriceCents < rule.minAppointmentValueCents
  ) {
    return false;
  }
  return true;
}

/** Schedule a human contact task N hours before the appointment. */
export function getQueueScheduledFor(
  appointmentStartsAt: string,
  hoursBeforeAppointment: number,
): string {
  const startMs = new Date(appointmentStartsAt).getTime();
  if (!Number.isFinite(startMs)) {
    throw new RangeError("Horário do agendamento inválido para programar contato.");
  }
  if (!Number.isInteger(hoursBeforeAppointment) || hoursBeforeAppointment < 0) {
    throw new RangeError("A antecedência do contato deve ser um número inteiro não negativo.");
  }
  return new Date(startMs - hoursBeforeAppointment * 60 * 60 * 1000).toISOString();
}

export function isQueueItemDue(scheduledFor: string, now = new Date()): boolean {
  const scheduledMs = new Date(scheduledFor).getTime();
  return Number.isFinite(scheduledMs) && scheduledMs <= now.getTime();
}
