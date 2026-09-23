/**
 * Metas e ranking da equipe.
 * Camada de domínio pura: sem UI e sem acesso a dados.
 */
import type { ApptFact } from "@/domain/analytics";

export interface ProfessionalGoal {
  professionalId: string;
  periodMonth: string; // "YYYY-MM-01"
  revenueGoalCents: number;
  appointmentsGoal: number;
}

export interface TeamMemberRow {
  professionalId: string;
  professionalName: string;
  completed: number;
  revenueCents: number;
  clients: number;
  noShows: number;
  cancellations: number;
  averageTicketCents: number;
  revenueGoalCents: number;
  appointmentsGoal: number;
  revenueProgressPct: number;
  appointmentsProgressPct: number;
  score: number;
}

export interface TeamRanking {
  rows: TeamMemberRow[];
  totals: {
    completed: number;
    revenueCents: number;
    revenueGoalCents: number;
    appointmentsGoal: number;
    revenueProgressPct: number;
  };
}

export function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

export function monthRange(periodMonth: string): { start: string; end: string } {
  const [year, month] = periodMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, (month ?? 1) - 1, 1));
  const end = new Date(Date.UTC(year, month ?? 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

export function weekRange(reference: Date): { start: string; end: string } {
  const day = reference.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // semana começa na segunda
  const start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate() - diff));
  const end = new Date(start.getTime() + 7 * 86_400_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function pct(value: number, goal: number): number {
  if (goal <= 0) return 0;
  return Math.round((value / goal) * 100);
}

/**
 * Consolida atendimentos por profissional e compara com a meta do mês.
 * Ordena pelo score (mistura de meta atingida e receita).
 */
export function buildTeamRanking(
  appointments: ApptFact[],
  professionals: Array<{ id: string; displayName: string }>,
  goals: ProfessionalGoal[],
  goalWeight = 1,
): TeamRanking {
  const goalMap = new Map(goals.map((goal) => [goal.professionalId, goal]));
  const rows: TeamMemberRow[] = professionals.map((pro) => {
    const mine = appointments.filter((appt) => appt.professionalId === pro.id);
    const completed = mine.filter((appt) => appt.status === "completed");
    const revenueCents = completed.reduce((sum, appt) => sum + (appt.totalPriceCents ?? 0), 0);
    const goal = goalMap.get(pro.id);
    const revenueGoalCents = goal?.revenueGoalCents ?? 0;
    const appointmentsGoal = goal?.appointmentsGoal ?? 0;
    const revenueProgressPct = pct(revenueCents, revenueGoalCents);
    const appointmentsProgressPct = pct(completed.length, appointmentsGoal);
    const goalScore = (revenueProgressPct + appointmentsProgressPct) / 2;

    return {
      professionalId: pro.id,
      professionalName: pro.displayName,
      completed: completed.length,
      revenueCents,
      clients: new Set(completed.map((appt) => appt.clientId)).size,
      noShows: mine.filter((appt) => appt.status === "no_show").length,
      cancellations: mine.filter((appt) => appt.status === "canceled").length,
      averageTicketCents: completed.length ? Math.round(revenueCents / completed.length) : 0,
      revenueGoalCents,
      appointmentsGoal,
      revenueProgressPct,
      appointmentsProgressPct,
      score: Math.round(goalScore * goalWeight + revenueCents / 1000),
    };
  });

  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.revenueCents !== a.revenueCents) return b.revenueCents - a.revenueCents;
    return a.professionalName.localeCompare(b.professionalName);
  });

  const revenueCents = rows.reduce((sum, row) => sum + row.revenueCents, 0);
  const revenueGoalCents = rows.reduce((sum, row) => sum + row.revenueGoalCents, 0);

  return {
    rows,
    totals: {
      completed: rows.reduce((sum, row) => sum + row.completed, 0),
      revenueCents,
      revenueGoalCents,
      appointmentsGoal: rows.reduce((sum, row) => sum + row.appointmentsGoal, 0),
      revenueProgressPct: pct(revenueCents, revenueGoalCents),
    },
  };
}
