import { describe, expect, it } from "vitest";
import { buildManualWhatsAppLink, normalizeBrazilWhatsappNumber } from "../whatsapp";

describe("normalizeBrazilWhatsappNumber", () => {
  it.each([
    ["(11) 99999-8888", "5511999998888"],
    ["11999998888", "5511999998888"],
    ["(11) 3333-2222", "551133332222"],
    ["+55 (11) 99999-8888", "5511999998888"],
    ["55 11 3333-2222", "551133332222"],
    ["551199999888", "551199999888"],
  ])("normaliza %s", (input, expected) => {
    expect(normalizeBrazilWhatsappNumber(input)).toBe(expected);
  });

  it.each([null, undefined, "", "123", "+1 202 555 0199", "abc"])(
    "rejeita valor inválido %s",
    (input) => {
      expect(normalizeBrazilWhatsappNumber(input)).toBeNull();
    },
  );
});

describe("buildManualWhatsAppLink", () => {
  it("monta link sem mensagem", () => {
    expect(buildManualWhatsAppLink("(91) 99999-1234")).toBe("https://wa.me/5591999991234");
  });

  it("codifica acentos, quebras de linha e emoji", () => {
    const message = "Olá, José!\nTudo bem? 😊";
    expect(buildManualWhatsAppLink("+55 91 99999-1234", message)).toBe(
      `https://wa.me/5591999991234?text=${encodeURIComponent(message)}`,
    );
  });

  it("retorna null para número ausente ou malformado", () => {
    expect(buildManualWhatsAppLink(null, "Oi")).toBeNull();
    expect(buildManualWhatsAppLink("9999", "Oi")).toBeNull();
  });
});
