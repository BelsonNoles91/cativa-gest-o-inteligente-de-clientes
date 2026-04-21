/**
 * Testes para regras críticas de agendamento (transições de status).
 * Estado é dinheiro — quebrar uma transição autoriza, no pior caso, marcar
 * algo como "completed" sem ter passado por "in_service". Aqui blindamos.
 */
import { describe, it, expect } from "vitest";
import {
  canTransition,
  allowedTransitions,
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
});
