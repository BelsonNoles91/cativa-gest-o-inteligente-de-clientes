import { describe, expect, it } from "vitest";

import {
  buildCommissionRows,
  buildStatement,
  commissionCents,
  commissionMonthKey,
  commissionMonthRange,
  commissionTotals,
} from "@/domain/commissions";
import type { ApptFact } from "@/domain/analytics";

function appt(partial: Partial<ApptFact>): ApptFact {
  return {
    id: "a1",
    tenantId: "t1",
    unitId: null,
    professionalId: "p1",
    serviceId: "s1",
    clientId: "c1",
    startsAt: "2026-03-10T12:00:00.000Z",
    endsAt: "2026-03-10T13:00:00.000Z",
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
    ...partial,
  } as ApptFact;
}

describe("commissions", () => {
  it("calcula a comissão sobre o valor concluído", () => {
    expect(commissionCents(10000, 30)).toBe(3000);
    expect(commissionCents(9999, 10)).toBe(1000);
  });

  it("monta as linhas por profissional ignorando não concluídos", () => {
    const appts = [
      appt({ id: "1", professionalId: "p1" }),
      appt({ id: "2", professionalId: "p1", status: "canceled" }),
      appt({ id: "3", professionalId: "p2", totalPriceCents: 5000 }),
    ];
    const rows = buildCommissionRows(
      appts,
      [
        { id: "p1", displayName: "Ana" },
        { id: "p2", displayName: "Bruno" },
      ],
      [{ professionalId: "p1", percent: 40 }],
      ["p2"],
    );
    expect(rows[0].professionalName).toBe("Ana");
    expect(rows[0].revenueCents).toBe(10000);
    expect(rows[0].commissionCents).toBe(4000);
    expect(rows[0].netCents).toBe(6000);
    expect(rows[1].percent).toBe(0);
    expect(rows[1].closed).toBe(true);
  });

  it("gera extrato por atendimento", () => {
    const rows = buildStatement([appt({})], "p1", 50, { s1: "Corte" }, { c1: "João" });
    expect(rows).toHaveLength(1);
    expect(rows[0].serviceName).toBe("Corte");
    expect(rows[0].clientName).toBe("João");
    expect(rows[0].commissionCents).toBe(5000);
  });

  it("ordena extrato por data e preserva valores nulos e referências ausentes", () => {
    const rows = buildStatement(
      [
        appt({ id: "later", startsAt: "2026-03-12T12:00:00.000Z", serviceId: null, clientId: null, totalPriceCents: 0 }),
        appt({ id: "ignored", startsAt: "2026-03-01T12:00:00.000Z", status: "pending" }),
        appt({ id: "earlier", startsAt: "2026-03-02T12:00:00.000Z", serviceId: "missing-service", clientId: "missing-client", totalPriceCents: 101 }),
      ],
      "p1",
      10,
      { s1: "Corte" },
      { c1: "João" },
    );

    expect(rows.map(({ id }) => id)).toEqual(["earlier", "later"]);
    expect(rows[0]).toMatchObject({ serviceName: null, clientName: null, revenueCents: 101, commissionCents: 10 });
    expect(rows[1]).toMatchObject({ serviceName: null, clientName: null, revenueCents: 0, commissionCents: 0 });
  });

  it("desempata profissionais com mesma receita pelo nome e inclui profissionais sem vendas", () => {
    const rows = buildCommissionRows(
      [appt({ professionalId: "z", totalPriceCents: 5000 }), appt({ professionalId: "a", totalPriceCents: 5000 })],
      [
        { id: "z", displayName: "Zélia" },
        { id: "a", displayName: "Ágata" },
        { id: "empty", displayName: "Sem vendas" },
      ],
      [],
    );
    expect(rows.map(({ professionalId }) => professionalId)).toEqual(["a", "z", "empty"]);
    expect(rows[2]).toMatchObject({ appointmentsCount: 0, revenueCents: 0, commissionCents: 0, netCents: 0, closed: false });
  });

  it("totaliza e formata o mês de referência", () => {
    const rows = buildCommissionRows(
      [appt({})],
      [{ id: "p1", displayName: "Ana" }],
      [{ professionalId: "p1", percent: 20 }],
    );
    expect(commissionTotals(rows)).toEqual({
      revenueCents: 10000,
      commissionCents: 2000,
      appointmentsCount: 1,
    });
    expect(commissionMonthKey(new Date(2026, 2, 15))).toBe("2026-03-01");
    const range = commissionMonthRange("2026-03-01");
    expect(range.start).toBe("2026-03-01T00:00:00.000Z");
    expect(range.end).toBe("2026-04-01T00:00:00.000Z");
  });
});
