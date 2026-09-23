import { describe, expect, it } from "vitest";

import { buildTeamRanking, monthKey, monthRange, weekRange } from "@/domain/team-goals";
import type { ApptFact } from "@/domain/analytics";

function appt(patch: Partial<ApptFact>): ApptFact {
  return {
    id: crypto.randomUUID(),
    tenantId: "t1",
    unitId: "u1",
    professionalId: "p1",
    serviceId: "s1",
    clientId: "c1",
    startsAt: "2026-05-02T13:00:00.000Z",
    endsAt: "2026-05-02T14:00:00.000Z",
    durationMinutes: 60,
    status: "completed",
    source: "frontdesk",
    totalPriceCents: 10000,
    isOverbooked: false,
    confirmedAt: null,
    remindedAt: null,
    noShowAt: null,
    canceledAt: null,
    completedAt: null,
    createdAt: "2026-04-01T10:00:00.000Z",
    ...patch,
  };
}

describe("buildTeamRanking", () => {
  const pros = [
    { id: "p1", displayName: "Léo" },
    { id: "p2", displayName: "Bia" },
  ];

  it("consolida receita, clientes, faltas e progresso da meta", () => {
    const ranking = buildTeamRanking(
      [
        appt({ professionalId: "p1", clientId: "c1" }),
        appt({ professionalId: "p1", clientId: "c2" }),
        appt({ professionalId: "p1", status: "no_show" }),
        appt({ professionalId: "p2", clientId: "c3", totalPriceCents: 5000 }),
      ],
      pros,
      [{ professionalId: "p1", periodMonth: "2026-05-01", revenueGoalCents: 40000, appointmentsGoal: 4 }],
    );

    const leo = ranking.rows.find((row) => row.professionalId === "p1");
    expect(leo?.completed).toBe(2);
    expect(leo?.revenueCents).toBe(20000);
    expect(leo?.clients).toBe(2);
    expect(leo?.noShows).toBe(1);
    expect(leo?.revenueProgressPct).toBe(50);
    expect(leo?.appointmentsProgressPct).toBe(50);
    expect(ranking.rows[0].professionalId).toBe("p1");
    expect(ranking.totals.revenueCents).toBe(25000);
  });

  it("não quebra sem meta definida", () => {
    const ranking = buildTeamRanking([appt({})], pros, []);
    expect(ranking.rows[0].revenueProgressPct).toBe(0);
    expect(ranking.totals.revenueProgressPct).toBe(0);
  });
});

describe("períodos", () => {
  it("monta o mês e a semana a partir de uma data", () => {
    expect(monthKey(new Date("2026-05-15T12:00:00Z"))).toBe("2026-05-01");
    const month = monthRange("2026-05-01");
    expect(month.start).toBe("2026-05-01T00:00:00.000Z");
    expect(month.end).toBe("2026-06-01T00:00:00.000Z");
    const week = weekRange(new Date("2026-05-14T12:00:00Z")); // quinta
    expect(week.start).toBe("2026-05-11T00:00:00.000Z");
    expect(week.end).toBe("2026-05-18T00:00:00.000Z");
  });
});
