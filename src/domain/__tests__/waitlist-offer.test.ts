import { describe, expect, it } from "vitest";

import { matchWaitlistForSlot, slotOfferMessage, type FreedSlot, type WaitlistCandidate } from "@/domain/waitlist-offer";

const now = new Date("2026-05-01T09:00:00.000Z");

const slot: FreedSlot = {
  unitId: "unit-1",
  professionalId: "pro-1",
  serviceId: "svc-1",
  startsAt: "2026-05-02T13:00:00.000Z",
  endsAt: "2026-05-02T14:00:00.000Z",
};

function candidate(patch: Partial<WaitlistCandidate> = {}): WaitlistCandidate {
  return {
    id: "w1",
    clientId: "c1",
    clientName: "Ana Souza",
    clientPhone: "11999998888",
    serviceId: "svc-1",
    serviceName: "Corte",
    preferredUnitId: "unit-1",
    preferredProfessionalId: "pro-1",
    desiredWindowStart: null,
    desiredWindowEnd: null,
    priority: 50,
    status: "open",
    createdAt: "2026-04-01T10:00:00.000Z",
    ...patch,
  };
}

describe("matchWaitlistForSlot", () => {
  it("prioriza quem combina serviço, profissional e unidade", () => {
    const result = matchWaitlistForSlot(
      [
        candidate({ id: "flex", preferredProfessionalId: null, serviceId: null, serviceName: null }),
        candidate({ id: "exato" }),
      ],
      slot,
      now,
    );
    expect(result[0].candidate.id).toBe("exato");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("descarta serviço diferente, outra unidade e status encerrado", () => {
    const result = matchWaitlistForSlot(
      [
        candidate({ id: "outro-servico", serviceId: "svc-2" }),
        candidate({ id: "outra-unidade", preferredUnitId: "unit-2" }),
        candidate({ id: "cancelado", status: "canceled" }),
      ],
      slot,
      now,
    );
    expect(result).toHaveLength(0);
  });

  it("descarta quem pediu janela que não inclui o horário", () => {
    const result = matchWaitlistForSlot(
      [
        candidate({
          id: "fora",
          desiredWindowStart: "2026-05-10T00:00:00.000Z",
          desiredWindowEnd: "2026-05-12T00:00:00.000Z",
        }),
      ],
      slot,
      now,
    );
    expect(result).toHaveLength(0);
  });

  it("ignora vaga no passado", () => {
    expect(matchWaitlistForSlot([candidate()], slot, new Date("2026-05-03T00:00:00.000Z"))).toHaveLength(0);
  });

  it("desempata pelo mais antigo na fila", () => {
    const result = matchWaitlistForSlot(
      [
        candidate({ id: "novo", createdAt: "2026-04-20T10:00:00.000Z" }),
        candidate({ id: "antigo", createdAt: "2026-03-01T10:00:00.000Z" }),
      ],
      slot,
      now,
    );
    expect(result[0].candidate.id).toBe("antigo");
  });
});

describe("slotOfferMessage", () => {
  it("usa o primeiro nome e cita serviço e profissional", () => {
    const message = slotOfferMessage({
      clientName: "Ana Souza",
      businessName: "Barbearia Origem",
      serviceName: "Corte",
      professionalName: "Léo",
      startsAt: "2026-05-02T13:00:00.000Z",
    });
    expect(message).toContain("Oi Ana!");
    expect(message).toContain("de Corte");
    expect(message).toContain("com Léo");
    expect(message).toContain("Barbearia Origem");
  });
});
