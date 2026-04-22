import { describe, expect, it } from "vitest";
import { computeCompleteness, daysUntilBirthday } from "@/domain/client";

describe("domain/client", () => {
  describe("computeCompleteness", () => {
    it("retorna 100 quando todos os campos ponderados estao preenchidos", () => {
      expect(
        computeCompleteness({
          fullName: "Maria da Silva",
          phone: "85999999999",
          email: "maria@example.com",
          birthDate: "1990-01-10",
          origin: "Instagram",
          preferences: "Sala silenciosa",
          allergies: "Latex",
          contraindications: null,
          preferredUnitId: "unit-1",
          preferredProfessionalId: "pro-1",
        }),
      ).toBe(100);
    });

    it("considera alergias ou contraindicacoes como o mesmo bloco de completude", () => {
      expect(
        computeCompleteness({
          fullName: "Maria da Silva",
          phone: "85999999999",
          email: null,
          birthDate: null,
          origin: null,
          preferences: null,
          allergies: null,
          contraindications: "Gestante",
          preferredUnitId: null,
          preferredProfessionalId: null,
        }),
      ).toBe(45);
    });
  });

  describe("daysUntilBirthday", () => {
    it("retorna zero quando o aniversario e hoje", () => {
      expect(daysUntilBirthday("1990-04-21", new Date("2026-04-21T10:00:00Z"))).toBe(0);
    });

    it("rola para o proximo ano quando o aniversario ja passou", () => {
      expect(daysUntilBirthday("1990-04-20", new Date("2026-04-21T10:00:00Z"))).toBe(364);
    });

    it("retorna null quando a data e invalida ou ausente", () => {
      expect(daysUntilBirthday(null, new Date("2026-04-21T10:00:00Z"))).toBeNull();
      expect(daysUntilBirthday("invalida", new Date("2026-04-21T10:00:00Z"))).toBeNull();
    });
  });
});
