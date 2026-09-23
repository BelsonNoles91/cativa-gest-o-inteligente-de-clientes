import { describe, expect, it } from "vitest";
import {
  canClientCancel,
  canClientReschedule,
  defaultSelfServiceRules,
  hoursUntil,
  type SelfServiceStatus,
} from "../self-service";

const NOW = new Date("2026-05-10T12:00:00.000Z").getTime();
const inHours = (h: number) => new Date(NOW + h * 36e5).toISOString();

function status(patch: Partial<SelfServiceStatus> = {}): SelfServiceStatus {
  return {
    ...defaultSelfServiceRules,
    cancellationsLast30d: 0,
    noShowsLast90d: 0,
    blocked: false,
    blockReason: null,
    ...patch,
  };
}

describe("self-service", () => {
  it("calcula horas restantes", () => {
    expect(hoursUntil(inHours(5), NOW)).toBeCloseTo(5);
  });

  it("permite cancelar dentro das regras", () => {
    expect(canClientCancel(inHours(48), status(), NOW).allowed).toBe(true);
  });

  it("bloqueia cancelamento em cima da hora", () => {
    const r = canClientCancel(inHours(2), status({ minHoursToCancel: 12 }), NOW);
    expect(r.allowed).toBe(false);
    expect(r.message).toContain("12h");
  });

  it("bloqueia quando o autoatendimento está desligado", () => {
    expect(canClientCancel(inHours(48), status({ allowCancel: false }), NOW).allowed).toBe(false);
    expect(canClientReschedule(inHours(48), status({ allowReschedule: false }), 0, NOW).allowed).toBe(
      false,
    );
  });

  it("bloqueia cliente suspenso por excesso de cancelamentos", () => {
    const s = status({ blocked: true, blockReason: "limite_cancelamentos" });
    expect(canClientCancel(inHours(48), s, NOW).allowed).toBe(false);
    expect(canClientReschedule(inHours(48), s, 0, NOW).allowed).toBe(false);
  });

  it("limita remarcações por agendamento", () => {
    const s = status({ maxReschedulesPerAppointment: 2 });
    expect(canClientReschedule(inHours(48), s, 1, NOW).allowed).toBe(true);
    expect(canClientReschedule(inHours(48), s, 2, NOW).allowed).toBe(false);
  });

  it("não aplica limite quando o valor é 0", () => {
    const s = status({ maxReschedulesPerAppointment: 0, minHoursToReschedule: 0 });
    expect(canClientReschedule(inHours(1), s, 99, NOW).allowed).toBe(true);
  });

  it("sem regras carregadas, libera", () => {
    expect(canClientCancel(inHours(1), null, NOW).allowed).toBe(true);
  });
});
