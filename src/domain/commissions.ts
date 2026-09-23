/**
 * Domínio: comissões e fechamento por profissional.
 * Camada pura — sem UI e sem acesso a dados.
 */
import type { ApptFact } from "@/domain/analytics";

export interface CommissionRule {
  professionalId: string;
  percent: number;
}

export interface CommissionRow {
  professionalId: string;
  professionalName: string;
  percent: number;
  appointmentsCount: number;
  revenueCents: number;
  commissionCents: number;
  netCents: number;
  closed: boolean;
}

export interface CommissionStatement {
  id: string;
  startsAt: string;
  serviceName: string | null;
  clientName: string | null;
  revenueCents: number;
  commissionCents: number;
}

/** Mês de referência no formato YYYY-MM-01. */
export function commissionMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${y}-${m}-01`;
}

export function commissionMonthRange(periodMonth: string): { start: string; end: string } {
  const [y, m] = periodMonth.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function commissionCents(revenueCents: number, percent: number): number {
  return Math.round((revenueCents * percent) / 100);
}

/** Considera apenas atendimentos concluídos no período. */
export function buildCommissionRows(
  appts: ApptFact[],
  professionals: { id: string; displayName: string }[],
  rules: CommissionRule[],
  closedProfessionalIds: string[] = [],
): CommissionRow[] {
  const percentBy = new Map(rules.map((r) => [r.professionalId, r.percent]));
  const closed = new Set(closedProfessionalIds);

  return professionals
    .map((p) => {
      const mine = appts.filter(
        (a) => a.professionalId === p.id && a.status === "completed",
      );
      const revenueCents = mine.reduce((sum, a) => sum + (a.totalPriceCents ?? 0), 0);
      const percent = percentBy.get(p.id) ?? 0;
      const commission = commissionCents(revenueCents, percent);
      return {
        professionalId: p.id,
        professionalName: p.displayName,
        percent,
        appointmentsCount: mine.length,
        revenueCents,
        commissionCents: commission,
        netCents: revenueCents - commission,
        closed: closed.has(p.id),
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents || a.professionalName.localeCompare(b.professionalName));
}

export function buildStatement(
  appts: ApptFact[],
  professionalId: string,
  percent: number,
  serviceNames: Record<string, string> = {},
  clientNames: Record<string, string> = {},
): CommissionStatement[] {
  return appts
    .filter((a) => a.professionalId === professionalId && a.status === "completed")
    .map((a) => ({
      id: a.id,
      startsAt: a.startsAt,
      serviceName: a.serviceId ? serviceNames[a.serviceId] ?? null : null,
      clientName: a.clientId ? clientNames[a.clientId] ?? null : null,
      revenueCents: a.totalPriceCents ?? 0,
      commissionCents: commissionCents(a.totalPriceCents ?? 0, percent),
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function commissionTotals(rows: CommissionRow[]) {
  return rows.reduce(
    (acc, r) => ({
      revenueCents: acc.revenueCents + r.revenueCents,
      commissionCents: acc.commissionCents + r.commissionCents,
      appointmentsCount: acc.appointmentsCount + r.appointmentsCount,
    }),
    { revenueCents: 0, commissionCents: 0, appointmentsCount: 0 },
  );
}
