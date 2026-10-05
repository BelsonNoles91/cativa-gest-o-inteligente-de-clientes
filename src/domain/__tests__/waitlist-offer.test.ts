import { describe, expect, it } from "vitest";
import {
  matchWaitlistForSlot,
  slotOfferMessage,
  type FreedSlot,
  type WaitlistCandidate,
} from "../waitlist-offer";

const NOW = new Date("2026-06-15T12:00:00.000Z");
const DAY = 86_400_000;
const ahead = (days: number) => new Date(NOW.getTime() + days * DAY).toISOString();

const SLOT: FreedSlot = {
  unitId: "unit-1",
  professionalId: "pro-1",
  serviceId: "service-1",
  startsAt: ahead(5),
  endsAt: new Date(new Date(ahead(5)).getTime() + 60 * 60_000).toISOString(),
};

function candidate(patch: Partial<WaitlistCandidate> = {}): WaitlistCandidate {
  return {
    id: "wait-1",
    clientId: "client-1",
    clientName: "Ana Lima",
    clientPhone: "11999998888",
    serviceId: "service-1",
    serviceName: "Corte",
    preferredUnitId: "unit-1",
    preferredProfessionalId: "pro-1",
    desiredWindowStart: null,
    desiredWindowEnd: null,
    priority: 50,
    status: "open",
    createdAt: "2026-06-01T12:00:00.000Z",
    ...patch,
  };
}

describe("matchWaitlistForSlot", () => {
  it("recusa horário inválido, presente ou passado", () => {
    expect(matchWaitlistForSlot([candidate()], { ...SLOT, startsAt: "inválido" }, NOW)).toEqual([]);
    expect(matchWaitlistForSlot([candidate()], { ...SLOT, endsAt: "inválido" }, NOW)).toEqual([]);
    expect(matchWaitlistForSlot([candidate()], { ...SLOT, endsAt: SLOT.startsAt }, NOW)).toEqual([]);
    expect(matchWaitlistForSlot([candidate()], { ...SLOT, endsAt: ahead(4) }, NOW)).toEqual([]);
    expect(matchWaitlistForSlot([candidate()], { ...SLOT, startsAt: NOW.toISOString() }, NOW)).toEqual([]);
    expect(matchWaitlistForSlot([candidate()], { ...SLOT, startsAt: ahead(-1) }, NOW)).toEqual([]);
  });

  it("remove status inelegível, serviço/unidade incompatíveis e janelas que excluem a vaga", () => {
    const entries = [
      candidate({ id: "closed", status: "reserved" }),
      candidate({ id: "service", serviceId: "service-2" }),
      candidate({ id: "unit", preferredUnitId: "unit-2" }),
      candidate({ id: "before-start", desiredWindowStart: ahead(6) }),
      candidate({ id: "after-end", desiredWindowEnd: ahead(4) }),
    ];

    expect(matchWaitlistForSlot(entries, SLOT, NOW)).toEqual([]);
  });

  it("aceita janelas abertas de início ou fim e considera seus limites inclusivos", () => {
    const entries = [
      candidate({ id: "start-only", desiredWindowStart: ahead(5) }),
      candidate({ id: "end-only", desiredWindowEnd: ahead(5) }),
      candidate({ id: "bounded", desiredWindowStart: ahead(4), desiredWindowEnd: ahead(5) }),
    ];

    expect(matchWaitlistForSlot(entries, SLOT, NOW).map(({ candidate: row }) => row.id)).toEqual([
      "start-only",
      "end-only",
      "bounded",
    ]);
  });

  it("pontua correspondências, preferências, janela e prioridade limitada", () => {
    const exact = candidate({
      id: "exact",
      desiredWindowStart: ahead(4),
      desiredWindowEnd: ahead(6),
      priority: 1000,
    });
    const anyService = candidate({
      id: "any-service",
      serviceId: null,
      preferredUnitId: null,
      preferredProfessionalId: null,
      priority: -100,
    });
    const otherProfessional = candidate({
      id: "other-pro",
      serviceId: null,
      preferredUnitId: null,
      preferredProfessionalId: "pro-2",
      priority: 0,
    });
    const invalidPriority = candidate({
      id: "invalid-priority",
      serviceId: null,
      preferredUnitId: null,
      preferredProfessionalId: null,
      priority: Number.NaN,
      createdAt: "2026-06-03T12:00:00.000Z",
    });

    const ranked = matchWaitlistForSlot([otherProfessional, anyService, exact, invalidPriority], SLOT, NOW);
    expect(ranked.map(({ candidate: row }) => row.id)).toEqual(["exact", "any-service", "invalid-priority", "other-pro"]);
    expect(ranked[0]).toMatchObject({ score: 110, reasons: ["Mesmo serviço", "Profissional preferido", "Mesma unidade", "Dentro do período pedido"] });
    expect(ranked[1]).toMatchObject({ score: 20, reasons: ["Aceita qualquer serviço", "Sem preferência de profissional"] });
    expect(ranked[2].score).toBe(20);
    expect(ranked[3].reasons).toContain("Outro profissional");
  });

  it("desempata pela data mais antiga de entrada na fila", () => {
    const ranked = matchWaitlistForSlot(
      [candidate({ id: "newer", createdAt: "2026-06-02T12:00:00.000Z" }), candidate({ id: "older" })],
      SLOT,
      NOW,
    );

    expect(ranked.map(({ candidate: row }) => row.id)).toEqual(["older", "newer"]);
  });
});

describe("slotOfferMessage", () => {
  it("inclui primeiro nome, serviço, profissional e empresa quando informados", () => {
    const message = slotOfferMessage({
      clientName: "Ana Lima",
      businessName: "Studio Bela",
      serviceName: "Corte",
      professionalName: "Lia",
      startsAt: SLOT.startsAt,
    });

    expect(message).toContain("Oi Ana!");
    expect(message).toContain("horário de Corte com Lia");
    expect(message).toContain("Studio Bela");
  });

  it("usa saudação neutra e omite detalhes ausentes", () => {
    const message = slotOfferMessage({
      clientName: null,
      businessName: null,
      serviceName: null,
      professionalName: null,
      startsAt: SLOT.startsAt,
    });

    expect(message).toContain("Oi tudo bem!");
    expect(message).toContain("Abriu um horário em ");
    expect(message).not.toContain("undefined");
  });

  it("trata nome vazio como saudação neutra", () => {
    const message = slotOfferMessage({
      clientName: "   ",
      businessName: null,
      serviceName: null,
      professionalName: null,
      startsAt: SLOT.startsAt,
    });

    expect(message).toContain("Oi tudo bem!");
    expect(message).not.toContain("Oi !");
  });
});
