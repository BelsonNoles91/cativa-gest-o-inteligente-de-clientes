/**
 * Retorno e reativação — camada de domínio pura.
 *
 * Deriva, a partir dos fatos já carregados (atendimentos, clientes e agenda
 * futura), duas listas de trabalho para a recepção:
 *  - lembretes de retorno: quem está chegando (ou passando) do intervalo médio
 *    de visita e ainda não tem horário marcado;
 *  - reativação: quem parou de vir e precisa de um convite de volta.
 *
 * REGRA INEGOCIÁVEL: nada é enviado automaticamente. Aqui só montamos o texto
 * e o link wa.me; o envio é sempre humano.
 */
import type { ApptFact, ClientFact } from "./analytics";
import { buildManualWhatsAppLink } from "@/lib/whatsapp";

const DAY = 86_400_000;

export const AT_RISK_DAYS = 45;
export const LOST_DAYS = 90;
/** Quantos dias antes do retorno previsto o cliente já entra na lista. */
export const LEAD_DAYS = 7;
/** Intervalo usado quando o cliente ainda não tem histórico suficiente. */
export const DEFAULT_INTERVAL_DAYS = 30;

export type ReturnUrgency = "due_soon" | "due" | "late";
export type ReactivationSegment = "at_risk" | "lost";

export interface OutreachClient {
  clientId: string;
  name: string;
  phone: string | null;
  visits: number;
  lastVisitAt: string;
  daysSinceLastVisit: number;
  averageIntervalDays: number;
  /** Data sugerida para o próximo atendimento (ISO). */
  suggestedReturnAt: string;
  /** Negativo = ainda vai vencer; positivo = já passou do ponto. */
  daysOverdue: number;
  lastServiceId: string | null;
  averageTicketCents: number;
}

export interface ReturnReminder extends OutreachClient {
  urgency: ReturnUrgency;
}

export interface ReactivationCandidate extends OutreachClient {
  segment: ReactivationSegment;
  revenueCents: number;
}

interface ClientHistory {
  times: number[];
  revenue: number;
  lastServiceId: string | null;
}

function historyByClient(appts: ApptFact[]): Map<string, ClientHistory> {
  const map = new Map<string, ClientHistory>();
  for (const appt of appts) {
    if (appt.status !== "completed") continue;
    const cur = map.get(appt.clientId) ?? { times: [], revenue: 0, lastServiceId: null };
    cur.times.push(new Date(appt.startsAt).getTime());
    cur.revenue += appt.totalPriceCents ?? 0;
    map.set(appt.clientId, cur);
  }
  for (const [clientId, h] of map) {
    h.times.sort((a, b) => a - b);
    const last = h.times[h.times.length - 1];
    const lastAppt = appts
      .filter((a) => a.clientId === clientId && a.status === "completed")
      .find((a) => new Date(a.startsAt).getTime() === last);
    h.lastServiceId = lastAppt?.serviceId ?? null;
  }
  return map;
}

function averageInterval(times: number[]): number {
  if (times.length < 2) return DEFAULT_INTERVAL_DAYS;
  const first = times[0];
  const last = times[times.length - 1];
  const gap = Math.round((last - first) / (times.length - 1) / DAY);
  return gap > 0 ? gap : DEFAULT_INTERVAL_DAYS;
}

function clientsWithFutureBooking(future: ApptFact[]): Set<string> {
  const set = new Set<string>();
  for (const appt of future) {
    if (appt.status === "canceled" || appt.status === "no_show") continue;
    set.add(appt.clientId);
  }
  return set;
}

function baseRow(
  client: ClientFact,
  history: ClientHistory,
  now: number,
): OutreachClient {
  const visits = history.times.length;
  const last = history.times[visits - 1];
  const intervalDays = averageInterval(history.times);
  const suggested = last + intervalDays * DAY;
  return {
    clientId: client.id,
    name: client.fullName,
    phone: client.whatsappPhone ?? client.phone,
    visits,
    lastVisitAt: new Date(last).toISOString(),
    daysSinceLastVisit: Math.floor((now - last) / DAY),
    averageIntervalDays: intervalDays,
    suggestedReturnAt: new Date(suggested).toISOString(),
    daysOverdue: Math.round((now - suggested) / DAY),
    lastServiceId: history.lastServiceId,
    averageTicketCents: Math.round(history.revenue / visits),
  };
}

/**
 * Lembretes de retorno: clientes sem horário marcado cujo retorno previsto
 * está chegando, venceu ou passou — mas que ainda não viraram reativação.
 */
export function buildReturnReminders(
  appts: ApptFact[],
  clients: ClientFact[],
  future: ApptFact[],
  now: number = Date.now(),
): ReturnReminder[] {
  const history = historyByClient(appts);
  const booked = clientsWithFutureBooking(future);
  const rows: ReturnReminder[] = [];

  for (const client of clients) {
    const h = history.get(client.id);
    if (!h || h.times.length === 0) continue;
    if (booked.has(client.id)) continue;

    const row = baseRow(client, h, now);
    if (row.daysSinceLastVisit > LOST_DAYS) continue;
    if (row.daysOverdue < -LEAD_DAYS) continue;

    const urgency: ReturnUrgency =
      row.daysOverdue < 0 ? "due_soon" : row.daysOverdue <= LEAD_DAYS ? "due" : "late";
    rows.push({ ...row, urgency });
  }

  return rows.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/** Reativação: quem parou de vir (em risco ou perdido) e não tem horário marcado. */
export function buildReactivationCandidates(
  appts: ApptFact[],
  clients: ClientFact[],
  future: ApptFact[],
  now: number = Date.now(),
): ReactivationCandidate[] {
  const history = historyByClient(appts);
  const booked = clientsWithFutureBooking(future);
  const rows: ReactivationCandidate[] = [];

  for (const client of clients) {
    const h = history.get(client.id);
    if (!h || h.times.length === 0) continue;
    if (booked.has(client.id)) continue;

    const row = baseRow(client, h, now);
    if (row.daysSinceLastVisit <= AT_RISK_DAYS) continue;

    rows.push({
      ...row,
      segment: row.daysSinceLastVisit > LOST_DAYS ? "lost" : "at_risk",
      revenueCents: h.revenue,
    });
  }

  return rows.sort((a, b) => b.revenueCents - a.revenueCents);
}

// ---------------------------------------------------------------------------
// Mensagens (texto gerado localmente, envio sempre manual)
// ---------------------------------------------------------------------------

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function returnReminderMessage(
  row: ReturnReminder,
  businessName: string,
  serviceName?: string | null,
): string {
  const oi = `Oi, ${firstName(row.name)}! Aqui é do ${businessName}.`;
  const servico = serviceName ? ` do seu ${serviceName}` : "";
  if (row.urgency === "due_soon") {
    return `${oi} Está chegando a época${servico} — pelo seu ritmo, o ideal seria por volta de ${formatDate(row.suggestedReturnAt)}. Quer que eu já reserve um horário?`;
  }
  if (row.urgency === "due") {
    return `${oi} Já deu o tempo${servico} desde a sua última visita. Tenho horários abertos nesta semana — qual dia fica melhor para você?`;
  }
  return `${oi} Faz ${row.daysSinceLastVisit} dias desde a sua última visita e senti sua falta por aqui. Quer que eu separe um horário${servico} para você?`;
}

export function reactivationMessage(
  row: ReactivationCandidate,
  businessName: string,
  incentive?: string | null,
): string {
  const oi = `Oi, ${firstName(row.name)}! Aqui é do ${businessName}.`;
  const tail = incentive?.trim() ? ` ${incentive.trim()}` : "";
  if (row.segment === "at_risk") {
    return `${oi} Notei que faz ${row.daysSinceLastVisit} dias que você não aparece. Quer marcar um horário para voltar a cuidar de você?${tail}`;
  }
  return `${oi} Faz um tempo que não nos vemos — tem novidades por aqui e adoraríamos receber você de novo. Posso reservar um horário?${tail}`;
}

/** Link wa.me com a mensagem já preenchida. Retorna null sem telefone válido. */
export function whatsappLink(phone: string | null, message: string): string | null {
  return buildManualWhatsAppLink(phone, message);
}
