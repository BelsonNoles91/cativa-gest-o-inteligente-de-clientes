/**
 * Testes do parser/serializador CSV interno e do auto-mapeamento.
 * O CSV é a porta de entrada/saída de dados — qualquer falha vira sangue
 * em migração. Por isso testamos com casos chatos (acentos, vírgulas
 * dentro do campo, aspas, BOM, separador BR).
 */
import { describe, it, expect } from "vitest";
import { parseCsv, serializeCsv } from "@/utils/csv";
import {
  autoMapHeaders,
  buildPreview,
  parseCell,
  clientImportSchema,
} from "@/services/import-export/schemas";

describe("utils/csv — parseCsv", () => {
  it("parseia CSV simples com vírgula", () => {
    const text = `nome,email\nAna,ana@x.com\nBeto,beto@y.com`;
    const r = parseCsv(text);
    expect(r.headers).toEqual(["nome", "email"]);
    expect(r.records).toEqual([
      { nome: "Ana", email: "ana@x.com" },
      { nome: "Beto", email: "beto@y.com" },
    ]);
  });

  it("autodetecta ponto-e-vírgula (padrão BR)", () => {
    const text = `nome;email\nAna;ana@x.com`;
    const r = parseCsv(text);
    expect(r.delimiter).toBe(";");
    expect(r.records[0]).toEqual({ nome: "Ana", email: "ana@x.com" });
  });

  it("respeita aspas com vírgula dentro do campo", () => {
    const text = `nome,obs\n"Ana, VIP","tem alergia, atenção"`;
    const r = parseCsv(text);
    expect(r.records[0]).toEqual({ nome: "Ana, VIP", obs: "tem alergia, atenção" });
  });

  it("trata aspas duplas escapadas", () => {
    const text = `frase\n"ela disse ""oi"""`;
    const r = parseCsv(text);
    expect(r.records[0]).toEqual({ frase: 'ela disse "oi"' });
  });

  it("ignora BOM no início e CRLF", () => {
    const text = `\ufeffnome,idade\r\nAna,30\r\nBeto,25\r\n`;
    const r = parseCsv(text);
    expect(r.headers).toEqual(["nome", "idade"]);
    expect(r.records).toHaveLength(2);
  });
});

describe("utils/csv — serializeCsv", () => {
  it("serializa com escape correto", () => {
    const out = serializeCsv(
      [{ a: 'tem "aspas"', b: "x,y" }],
      ["a", "b"],
    );
    expect(out).toContain('"tem ""aspas""","x,y"');
  });

  it("adiciona BOM quando solicitado", () => {
    const out = serializeCsv([{ a: 1 }], ["a"], { bom: true });
    expect(out.charCodeAt(0)).toBe(0xfeff);
  });
});

describe("import-export/schemas — autoMapHeaders", () => {
  it("mapeia headers em pt-BR para chaves canônicas", () => {
    const map = autoMapHeaders(
      ["Nome Completo", "Telefone", "E-mail", "Aniversário"],
      clientImportSchema,
    );
    expect(map.fullName).toBe("Nome Completo");
    expect(map.phone).toBe("Telefone");
    expect(map.email).toBe("E-mail");
    expect(map.birthDate).toBe("Aniversário");
  });

  it("retorna null quando não há header correspondente", () => {
    const map = autoMapHeaders(["X", "Y"], clientImportSchema);
    expect(map.fullName).toBeNull();
  });
});

describe("import-export/schemas — parseCell", () => {
  it("number BR (1.234,56) e EN (1234.56)", () => {
    expect(parseCell("1.234,56", "number")).toBe(1234.56);
    expect(parseCell("1234.56", "number")).toBe(1234.56);
    expect(parseCell("", "number")).toBeNull();
  });

  it("boolean aceita variações comuns", () => {
    expect(parseCell("sim", "boolean")).toBe(true);
    expect(parseCell("YES", "boolean")).toBe(true);
    expect(parseCell("não", "boolean")).toBe(false);
    expect(parseCell("0", "boolean")).toBe(false);
  });

  it("date aceita ISO e dd/mm/aaaa", () => {
    expect(parseCell("2026-04-21", "date")).toBe("2026-04-21");
    expect(parseCell("21/04/2026", "date")).toBe("2026-04-21");
    expect(parseCell("1/3/26", "date")).toBe("2026-03-01");
  });

  it("datetime aceita ISO e dd/mm/aaaa hh:mm", () => {
    expect(parseCell("2026-04-21T14:30:00Z", "datetime")).toBe("2026-04-21T14:30:00.000Z");
    expect(String(parseCell("21/04/2026 09:15", "datetime"))).toMatch(/^2026-04-21T/);
  });

  it("phone retira tudo que não é dígito", () => {
    expect(parseCell("(11) 99999-1234", "phone")).toBe("11999991234");
  });
});

describe("import-export/schemas — buildPreview", () => {
  it("aplica required + parsing e acumula erros por linha", () => {
    const result = buildPreview(
      [
        { Nome: "Ana", Telefone: "11999990000" },
        { Nome: "", Telefone: "" }, // falha required
      ],
      clientImportSchema,
      { fullName: "Nome", phone: "Telefone" },
    );
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].fullName).toBe("Ana");
    expect(result.rows[0].phone).toBe("11999990000");
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toMatchObject({ rowIndex: 1, field: "fullName" });
  });
});
