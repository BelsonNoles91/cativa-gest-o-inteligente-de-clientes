/**
 * Domínio: regras de autoatendimento do cliente (confirmar / adiar / cancelar).
 *
 * Nada aqui fala sobre cobranças. O estabelecimento escreve o próprio aviso
 * em `policyNote` (texto livre) e define limites de segurança configuráveis
 * para evitar abusos (janelas mínimas, número de adiamentos, cancelamentos
 * e faltas em um período).
 */

export interface SelfServiceRules {
  allowConfirm: boolean;
  allowReschedule: boolean;
  allowCancel: boolean;
  minHoursToReschedule: number;
  minHoursToCancel: number;
  maxReschedulesPerAppointment: number;
  maxCancellationsPer30d: number;
  maxNoShowsPer90d: number;
  blockDaysAfterLimit: number;
  requireCancelReason: boolean;
  policyNote: string | null;
}

export interface SelfServiceStatus extends SelfServiceRules {
  cancellationsLast30d: number;
  noShowsLast90d: number;
  blocked: boolean;
  blockReason: "limite_cancelamentos" | "limite_faltas" | null;
}

export const defaultSelfServiceRules: SelfServiceRules = {
  allowConfirm: true,
  allowReschedule: true,
  allowCancel: true,
  minHoursToReschedule: 12,
  minHoursToCancel: 12,
  maxReschedulesPerAppointment: 2,
  maxCancellationsPer30d: 3,
  maxNoShowsPer90d: 2,
  blockDaysAfterLimit: 30,
  requireCancelReason: true,
  policyNote: null,
};

export const blockReasonMessages: Record<string, string> = {
  limite_cancelamentos:
    "Você atingiu o limite de cancelamentos pelo portal neste período. Fale com o estabelecimento.",
  limite_faltas:
    "Há faltas registradas recentes. Para marcar mudanças, fale com o estabelecimento.",
};

export function hoursUntil(startsAtIso: string, now: number = Date.now()): number {
  return (new Date(startsAtIso).getTime() - now) / 36e5;
}

export interface SelfServiceCheck {
  allowed: boolean;
  message: string | null;
}

export function canClientCancel(
  startsAtIso: string,
  status: SelfServiceStatus | null,
  now: number = Date.now(),
): SelfServiceCheck {
  if (!status) return { allowed: true, message: null };
  if (!status.allowCancel) {
    return {
      allowed: false,
      message: "Cancelamentos pelo portal não estão disponíveis. Fale com o estabelecimento.",
    };
  }
  if (status.blocked) {
    return {
      allowed: false,
      message: blockReasonMessages[status.blockReason ?? ""] ?? blockReasonMessages.limite_cancelamentos,
    };
  }
  if (hoursUntil(startsAtIso, now) < status.minHoursToCancel) {
    return {
      allowed: false,
      message: `Cancelamentos pelo portal só até ${status.minHoursToCancel}h antes do horário. Fale com o estabelecimento.`,
    };
  }
  return { allowed: true, message: null };
}

export function canClientReschedule(
  startsAtIso: string,
  status: SelfServiceStatus | null,
  rescheduleCount = 0,
  now: number = Date.now(),
): SelfServiceCheck {
  if (!status) return { allowed: true, message: null };
  if (!status.allowReschedule) {
    return {
      allowed: false,
      message: "Alterar horário pelo portal não está disponível. Fale com o estabelecimento.",
    };
  }
  if (status.blocked) {
    return {
      allowed: false,
      message: blockReasonMessages[status.blockReason ?? ""] ?? blockReasonMessages.limite_cancelamentos,
    };
  }
  if (
    status.maxReschedulesPerAppointment > 0 &&
    rescheduleCount >= status.maxReschedulesPerAppointment
  ) {
    return {
      allowed: false,
      message: "Você já alterou este horário o número máximo de vezes permitido.",
    };
  }
  if (hoursUntil(startsAtIso, now) < status.minHoursToReschedule) {
    return {
      allowed: false,
      message: `Alterações pelo portal só até ${status.minHoursToReschedule}h antes do horário. Fale com o estabelecimento.`,
    };
  }
  return { allowed: true, message: null };
}
