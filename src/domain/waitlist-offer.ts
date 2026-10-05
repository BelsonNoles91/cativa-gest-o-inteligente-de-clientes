/**
 * Oferta automática de vaga para a lista de espera.
 * Camada de domínio pura: sem UI e sem acesso a dados.
 */

export interface WaitlistCandidate {
  id: string;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  serviceId: string | null;
  serviceName: string | null;
  preferredUnitId: string | null;
  preferredProfessionalId: string | null;
  desiredWindowStart: string | null;
  desiredWindowEnd: string | null;
  priority: number;
  status: string;
  createdAt: string;
}

export interface FreedSlot {
  unitId: string;
  professionalId: string;
  serviceId: string | null;
  startsAt: string;
  endsAt: string;
}

export interface RankedCandidate {
  candidate: WaitlistCandidate;
  score: number;
  reasons: string[];
}

const ELIGIBLE_STATUSES = new Set(["open", "contacted"]);

function withinWindow(slotStart: number, start: string | null, end: string | null): boolean | null {
  if (!start && !end) return null;
  const from = start ? new Date(start).getTime() : Number.NEGATIVE_INFINITY;
  const to = end ? new Date(end).getTime() : Number.POSITIVE_INFINITY;
  return slotStart >= from && slotStart <= to;
}

/**
 * Ordena quem da fila cabe melhor na vaga que abriu.
 * Descarta quem pediu outro serviço ou uma janela que não inclui o horário.
 */
export function matchWaitlistForSlot(
  entries: WaitlistCandidate[],
  slot: FreedSlot,
  now: Date = new Date(),
): RankedCandidate[] {
  const slotStart = new Date(slot.startsAt).getTime();
  const slotEnd = new Date(slot.endsAt).getTime();
  if (!Number.isFinite(slotStart) || !Number.isFinite(slotEnd) || slotEnd <= slotStart || slotStart <= now.getTime()) return [];

  const ranked: RankedCandidate[] = [];

  for (const candidate of entries) {
    if (!ELIGIBLE_STATUSES.has(candidate.status)) continue;

    if (candidate.serviceId && slot.serviceId && candidate.serviceId !== slot.serviceId) continue;
    if (candidate.preferredUnitId && candidate.preferredUnitId !== slot.unitId) continue;

    const inWindow = withinWindow(slotStart, candidate.desiredWindowStart, candidate.desiredWindowEnd);
    if (inWindow === false) continue;

    let score = 0;
    const reasons: string[] = [];

    if (candidate.serviceId && slot.serviceId && candidate.serviceId === slot.serviceId) {
      score += 40;
      reasons.push("Mesmo serviço");
    } else if (!candidate.serviceId) {
      score += 10;
      reasons.push("Aceita qualquer serviço");
    }

    if (candidate.preferredProfessionalId === slot.professionalId) {
      score += 25;
      reasons.push("Profissional preferido");
    } else if (!candidate.preferredProfessionalId) {
      score += 10;
      reasons.push("Sem preferência de profissional");
    } else {
      reasons.push("Outro profissional");
    }

    if (candidate.preferredUnitId === slot.unitId) {
      score += 15;
      reasons.push("Mesma unidade");
    }

    if (inWindow === true) {
      score += 20;
      reasons.push("Dentro do período pedido");
    }

    const priority = Number.isFinite(candidate.priority) ? candidate.priority : 0;
    score += Math.max(0, Math.min(100, priority)) / 10;

    ranked.push({ candidate, score, reasons });
  }

  return ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return new Date(a.candidate.createdAt).getTime() - new Date(b.candidate.createdAt).getTime();
  });
}

function firstName(name: string | null): string {
  const normalized = name?.trim();
  if (!normalized) return "tudo bem";
  return normalized.split(/\s+/)[0] ?? "tudo bem";
}

function formatWhen(startsAt: string): string {
  const date = new Date(startsAt);
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${day} às ${time}`;
}

export function slotOfferMessage(input: {
  clientName: string | null;
  businessName: string | null;
  serviceName: string | null;
  professionalName: string | null;
  startsAt: string;
}): string {
  const parts = [`Oi ${firstName(input.clientName)}!`];
  const service = input.serviceName ? ` de ${input.serviceName}` : "";
  const pro = input.professionalName ? ` com ${input.professionalName}` : "";
  parts.push(`Abriu um horário${service}${pro} em ${formatWhen(input.startsAt)}.`);
  parts.push("Você estava na nossa lista de espera — quer que eu reserve para você?");
  if (input.businessName) parts.push(`— ${input.businessName}`);
  return parts.join(" ");
}
