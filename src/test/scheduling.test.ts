/**
 * Testes para regras críticas de agendamento (transições de status).
 * Estado é dinheiro — quebrar uma transição autoriza, no pior caso, marcar
 * algo como "completed" sem ter passado por "in_service". Aqui blindamos.
 */
import { describe, it, expect } from "vitest";
import {
  canTransition,
  allowedTransitions,
  formatHourMinute,
  statusTone,
  type AppointmentStatus,
} from "@/domain/scheduling";

describe("domain/scheduling — canTransition", () => {
  it("permite transições documentadas", () => {
    expect(canTransition("pending", "confirmed")).toBe(true);
    expect(canTransition("confirmed", "arrived")).toBe(true);
    expect(canTransition("arrived", "in_service")).toBe(true);
    expect(canTransition("in_service", "completed")).toBe(true);
  });

  it("bloqueia atalho perigoso pending → completed", () => {
    expect(canTransition("pending", "completed")).toBe(false);
  });

  it("não permite reabrir cancelado / no_show / completed", () => {
    expect(canTransition("canceled", "pending")).toBe(false);
    expect(canTransition("no_show", "confirmed")).toBe(false);
    expect(canTransition("completed", "in_service")).toBe(false);
  });

  it("pending pode cair em no_show ou canceled", () => {
    expect(canTransition("pending", "no_show")).toBe(true);
    expect(canTransition("pending", "canceled")).toBe(true);
  });

  it("toda transição declarada deve ser efetivamente válida", () => {
    (Object.keys(allowedTransitions) as AppointmentStatus[]).forEach((from) => {
      allowedTransitions[from].forEach((to) => {
        expect(canTransition(from, to)).toBe(true);
      });
    });
  });

  it("mapeia todos os estados para o tom visual esperado e protege valor desconhecido", () => {
    const expected: Array<[AppointmentStatus, string]> = [
      ["requested", "warning"],
      ["pending", "warning"],
      ["confirmed", "info"],
      ["reminded", "info"],
      ["arrived", "success"],
      ["in_service", "success"],
      ["completed", "success"],
      ["canceled", "destructive"],
      ["no_show", "destructive"],
    ];
    for (const [status, tone] of expected) expect(statusTone(status)).toBe(tone);
    expect(statusTone("unknown" as AppointmentStatus)).toBe("default");
  });

  it("nega status de origem desconhecido sem lançar exceção", () => {
    expect(canTransition("unknown" as AppointmentStatus, "pending")).toBe(false);
  });
});

describe("domain/scheduling — formatação de horário", () => {
  it("formata hora curta, aceita ISO e trata vazio", () => {
    expect(formatHourMinute("09:30:45")).toBe("09:30");
    expect(formatHourMinute("2026-03-01T10:45:00.000Z")).toMatch(/^\d{2}:\d{2}$/);
    expect(formatHourMinute("")).toBe("");
  });
});
