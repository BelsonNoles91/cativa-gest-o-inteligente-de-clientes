import { describe, expect, it } from "vitest";
import {
  FULL_NAME_ERROR,
  WHATSAPP_ERROR,
  isValidFullName,
  isValidMobileBR,
  maskMobileBR,
  onlyDigits,
} from "@/lib/client-validation";

describe("validação do CRM — nome e telefone", () => {
  it("remove formatação, texto e entradas ausentes sem falhar", () => {
    expect(onlyDigits("+55 (11) 98765-4321 ext. 2")).toBe("55119876543212");
    expect(onlyDigits(null)).toBe("");
    expect(onlyDigits(undefined)).toBe("");
  });

  it("aplica a máscara progressiva nos pontos de transição", () => {
    expect(maskMobileBR(null)).toBe("");
    expect(maskMobileBR("1")).toBe("(1");
    expect(maskMobileBR("11")).toBe("(11");
    expect(maskMobileBR("119")).toBe("(11) 9");
    expect(maskMobileBR("1199999")).toBe("(11) 99999");
    expect(maskMobileBR("11999999999")).toBe("(11) 99999-9999");
    expect(maskMobileBR("+55 (11) 99999-9999")).toBe("(11) 99999-9999");
    expect(maskMobileBR("119999999999")).toBe("(11) 99999-99999");
    expect(isValidMobileBR(maskMobileBR("119999999999"))).toBe(false);
    expect(maskMobileBR("+55 (11) 99999-9999 ramal 123")).toBe("(11) 99999-9999123");
  });

  it("aceita celular BR com ou sem código do país e rejeita comprimento/DDD/formato inválidos", () => {
    expect(isValidMobileBR("(11) 99999-9999")).toBe(true);
    expect(isValidMobileBR("+55 (21) 98888-7777")).toBe(true);
    expect(isValidMobileBR("11999999999")).toBe(true);
    expect(isValidMobileBR(null)).toBe(false);
    expect(isValidMobileBR("1199999999")).toBe(false);
    expect(isValidMobileBR("119999999999")).toBe(false);
    expect(isValidMobileBR("5511999999999123")).toBe(false);
    expect(isValidMobileBR("10999999999")).toBe(false);
    expect(isValidMobileBR("01999999999")).toBe(false);
    expect(isValidMobileBR("11888888888")).toBe(false);
  });

  it("exige duas palavras com ao menos duas letras e aceita acentos/hífens", () => {
    expect(isValidFullName("  Ana   Maria  ")).toBe(true);
    expect(isValidFullName("João D’Ávila")).toBe(true);
    expect(isValidFullName("Ana Maria-José")).toBe(true);
    expect(isValidFullName(null)).toBe(false);
    expect(isValidFullName(" ")).toBe(false);
    expect(isValidFullName("Ana")).toBe(false);
    expect(isValidFullName("A B")).toBe(false);
    expect(isValidFullName("Ana 1 2")).toBe(false);
  });

  it("mantém as mensagens de validação públicas", () => {
    expect(FULL_NAME_ERROR).toContain("nome e sobrenome");
    expect(WHATSAPP_ERROR).toContain("WhatsApp válido com DDD");
  });
});
