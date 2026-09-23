import { describe, expect, it } from "vitest";
import {
  buildReactivationCandidates,
  buildReturnReminders,
  reactivationMessage,
  returnReminderMessage,
  whatsappLink,
} from "../retention-outreach";
import type { ApptFact, ClientFact } from "../analytics";

const NOW = new Date("2026-06-15T12:00:00.000Z").getTime();
const DAY = 86_400_000;
const ago = (d: number) => new Date(NOW - d * DAY).toISOString();
const ahead = (d: number) => new Date(NOW + d * DAY).toISOString();

function appt(p: Partial<ApptFact> & { id: string; clientId: string; startsAt: string }): ApptFact {
  return {
    tenantId: "t1",
    unitId: "u1",
    professionalId: "p1",
    serviceId: "s1",
    endsAt: p.startsAt,
    durationMinutes: 60,
    status: "completed",
    source: "frontdesk",
    totalPriceCents: 10_000,
    isOverbooked: false,
    confirmedAt: null,
    remindedAt: null,
    noShowAt: null,
    canceledAt: null,
    completedAt: null,
    createdAt: p.startsAt,
    ...p,
  } as ApptFact;
}

function client(id: string, fullName: string, phone: string | null = "11999998888"): ClientFact {
  return {
    id,
    createdAt: "2026-01-01T00:00:00.000Z",
    isVip: false,
    fullName,
    email: null,
    phone,
    whatsappPhone: null,
    birthDate: null,
    preferences: null,
    preferredProfessionalId: null,
    preferredUnitId: null,
    completedVisits: 0,
    firstVisitAt: null,
    lastVisitAt: null,
  };
}

// Ana volta a cada 30 dias e a última visita foi há 35 dias -> atrasada.
const ana = client("c1", "Ana Lima");
const anaAppts = [
  appt({ id: "a1", clientId: "c1", startsAt: ago(95) }),
  appt({ id: "a2", clientId: "c1", startsAt: ago(65) }),
  appt({ id: "a3", clientId: "c1", startsAt: ago(35) }),
];

// Bruno sumiu há 120 dias -> perdido.
const bruno = client("c2", "Bruno Souza");
const brunoAppts = [appt({ id: "b1", clientId: "c2", startsAt: ago(120), totalPriceCents: 50_000 })];

// Carla veio ontem -> ainda não é hora.
const carla = client("c3", "Carla Dias");
const carlaAppts = [appt({ id: "d1", clientId: "c3", startsAt: ago(1) })];

const clients = [ana, bruno, carla];
const appts = [...anaAppts, ...brunoAppts, ...carlaAppts];

describe("buildReturnReminders", () => {
  it("lista quem passou do intervalo médio", () => {
    const rows = buildReturnReminders(appts, clients, [], NOW);
    expect(rows.map((r) => r.name)).toEqual(["Ana Lima"]);
    expect(rows[0].averageIntervalDays).toBe(30);
    expect(rows[0].daysOverdue).toBe(5);
    expect(rows[0].urgency).toBe("due");
  });

  it("ignora quem já tem horário marcado", () => {
    const future = [appt({ id: "f1", clientId: "c1", startsAt: ahead(3), status: "pending" })];
    expect(buildReturnReminders(appts, clients, future, NOW)).toHaveLength(0);
  });

  it("ignora quem acabou de ser atendido", () => {
    const rows = buildReturnReminders(carlaAppts, [carla], [], NOW);
    expect(rows).toHaveLength(0);
  });

  it("não repete quem já é caso de reativação", () => {
    const rows = buildReturnReminders(brunoAppts, [bruno], [], NOW);
    expect(rows).toHaveLength(0);
  });

  it("marca como atrasado quem passou muito do ponto", () => {
    const late = [appt({ id: "l1", clientId: "c3", startsAt: ago(60) })];
    expect(buildReturnReminders(late, [carla], [], NOW)[0].urgency).toBe("late");
  });
});

describe("buildReactivationCandidates", () => {
  it("separa em risco e perdidos, ordenando por receita", () => {
    const rows = buildReactivationCandidates(appts, clients, [], NOW);
    expect(rows.map((r) => r.name)).toEqual(["Bruno Souza"]);
    expect(rows[0].segment).toBe("lost");
    expect(rows[0].revenueCents).toBe(50_000);
  });

  it("classifica como em risco entre 45 e 90 dias", () => {
    const rows = buildReactivationCandidates(
      [appt({ id: "x1", clientId: "c3", startsAt: ago(60) })],
      [carla],
      [],
      NOW,
    );
    expect(rows[0].segment).toBe("at_risk");
  });

  it("ignora quem já remarcou", () => {
    const future = [appt({ id: "f2", clientId: "c2", startsAt: ahead(5), status: "pending" })];
    expect(buildReactivationCandidates(appts, clients, future, NOW)).toHaveLength(0);
  });
});

describe("mensagens", () => {
  it("usa o primeiro nome e o nome do negócio", () => {
    const row = buildReturnReminders(appts, clients, [], NOW)[0];
    const msg = returnReminderMessage(row, "Studio Bela", "Corte");
    expect(msg).toContain("Ana");
    expect(msg).toContain("Studio Bela");
    expect(msg).not.toContain("Lima");
  });

  it("inclui o incentivo opcional na reativação", () => {
    const row = buildReactivationCandidates(appts, clients, [], NOW)[0];
    expect(reactivationMessage(row, "Studio Bela", "Temos 10% de boas-vindas.")).toContain(
      "10% de boas-vindas",
    );
  });

  it("monta link wa.me com DDI e recusa telefone inválido", () => {
    expect(whatsappLink("(11) 99999-8888", "oi")).toBe("https://wa.me/5511999998888?text=oi");
    expect(whatsappLink("1234", "oi")).toBeNull();
    expect(whatsappLink(null, "oi")).toBeNull();
  });
});
