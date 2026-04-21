/**
 * Testes da renderização de templates da Central de Confirmação.
 * Templates renderizados errado = mensagem com {{variavel}} indo pro cliente.
 * Não é aceitável — então blindamos aqui.
 */
import { describe, it, expect } from "vitest";
import { renderTemplate, digitsOnly } from "@/domain/confirmation";

describe("domain/confirmation", () => {
  describe("renderTemplate", () => {
    it("substitui variáveis simples", () => {
      const out = renderTemplate("Olá {{cliente_nome}}!", { cliente_nome: "Ana" });
      expect(out).toBe("Olá Ana!");
    });

    it("aceita espaços dentro das chaves", () => {
      const out = renderTemplate("Olá {{ cliente_nome  }}", { cliente_nome: "Ana" });
      expect(out).toBe("Olá Ana");
    });

    it("substitui múltiplas variáveis e formatos", () => {
      const out = renderTemplate(
        "{{cliente_primeiro_nome}}, seu horário de {{servico_nome}} é {{data}} às {{hora}}.",
        {
          cliente_primeiro_nome: "Ana",
          servico_nome: "Limpeza de pele",
          data: "15/05",
          hora: "14:30",
        },
      );
      expect(out).toBe("Ana, seu horário de Limpeza de pele é 15/05 às 14:30.");
    });

    it("substitui variável ausente por string vazia (sem deixar a chave crua)", () => {
      const out = renderTemplate("Olá {{cliente_nome}}, {{ausente}}!", {
        cliente_nome: "Ana",
      });
      expect(out).toBe("Olá Ana, !");
      expect(out).not.toContain("{{");
    });

    it("trata null/undefined como string vazia", () => {
      const out = renderTemplate("X={{a}} Y={{b}}", { a: null, b: undefined });
      expect(out).toBe("X= Y=");
    });
  });

  describe("digitsOnly", () => {
    it("remove tudo que não é dígito (preserva o número para wa.me)", () => {
      expect(digitsOnly("(11) 98765-4321")).toBe("11987654321");
      expect(digitsOnly("+55 11 98765-4321")).toBe("5511987654321");
      expect(digitsOnly("nada")).toBe("");
    });
  });
});
