/**
 * Testes do pipeline de importação/exportação CSV para EQUIPE e CLIENTES.
 *
 * Garante que:
 *   1. O schema de equipe expõe os campos do cadastro de profissionais
 *      (apelido público, função, especialidade, e-mail, telefone, comissão,
 *      ativo) e que `displayName` continua sendo o único obrigatório.
 *   2. O auto-mapeamento aceita aliases pt-BR comuns.
 *   3. `buildPreview` valida obrigatórios e a faixa 0–100 da comissão.
 *   4. O round-trip "export → parse → preview" preserva todos os dados.
 */
import { describe, it, expect } from "vitest";
import { parseCsv } from "@/utils/csv";
import {
  autoMapHeaders,
  buildPreview,
  clientImportSchema,
  teamImportSchema,
  importSchemas,
} from "@/services/import-export/schemas";
import {
  buildClientRows,
  buildTeamRows,
  exportClientsCsv,
  exportTeamCsv,
} from "@/services/import-export/exporters";
import type { Client } from "@/domain/client";

describe("teamImportSchema — alinhamento com a tabela professionals", () => {
  it("expõe displayName, roleTitle, specialty, email, phone, commissionPct, isActive", () => {
    const keys = teamImportSchema.fields.map((f) => f.key).sort();
    expect(keys).toEqual(
      ["displayName", "roleTitle", "specialty", "email", "phone", "commissionPct", "isActive"].sort(),
    );
  });

  it("marca displayName como obrigatório", () => {
    const displayName = teamImportSchema.fields.find((f) => f.key === "displayName");
    expect(displayName?.required).toBe(true);
    for (const key of ["roleTitle", "specialty", "email", "phone", "commissionPct", "isActive"]) {
      const field = teamImportSchema.fields.find((f) => f.key === key);
      expect(field?.required).not.toBe(true);
    }
  });

  it("está registrado em importSchemas['team']", () => {
    expect(importSchemas.team).toBe(teamImportSchema);
  });
});

describe("teamImportSchema — autoMapHeaders cobre aliases pt-BR", () => {
  it("mapeia 'Apelido público', 'Função' e 'Especialidade'", () => {
    const map = autoMapHeaders(["Apelido público", "Função", "Especialidade"], teamImportSchema);
    expect(map.displayName).toBe("Apelido público");
    expect(map.roleTitle).toBe("Função");
    expect(map.specialty).toBe("Especialidade");
  });

  it("mapeia contato e comissão a partir de aliases", () => {
    const map = autoMapHeaders(
      ["Apelido público", "E-mail", "Telefone", "Comissão (%)", "Ativo"],
      teamImportSchema,
    );
    expect(map.email).toBe("E-mail");
    expect(map.phone).toBe("Telefone");
    expect(map.commissionPct).toBe("Comissão (%)");
    expect(map.isActive).toBe("Ativo");
  });

  it("retorna null para campos opcionais ausentes", () => {
    const map = autoMapHeaders(["Apelido público"], teamImportSchema);
    expect(map.displayName).toBe("Apelido público");
    expect(map.roleTitle).toBeNull();
    expect(map.email).toBeNull();
  });
});

describe("teamImportSchema — buildPreview valida campos críticos", () => {
  it("aceita linhas válidas com todos os campos preenchidos", () => {
    const records = [
      {
        "Apelido público": "Marina",
        Função: "Cabeleireira",
        Especialidade: "Coloração",
        "E-mail": "marina@salao.com",
        Telefone: "(11) 99999-1234",
        "Comissão (%)": "45",
        Ativo: "sim",
      },
    ];
    const mapping = autoMapHeaders(Object.keys(records[0]), teamImportSchema);
    const preview = buildPreview(records, teamImportSchema, mapping);

    expect(preview.errors).toHaveLength(0);
    expect(preview.rows[0]).toEqual({
      displayName: "Marina",
      roleTitle: "Cabeleireira",
      specialty: "Coloração",
      email: "marina@salao.com",
      phone: "11999991234",
      commissionPct: 45,
      isActive: true,
    });
  });

  it("acusa erro quando displayName está vazio", () => {
    const records = [{ "Apelido público": "", Função: "Massoterapeuta" }];
    const mapping = autoMapHeaders(Object.keys(records[0]), teamImportSchema);
    const preview = buildPreview(records, teamImportSchema, mapping);

    expect(preview.errors.some((e) => e.field === "displayName")).toBe(true);
  });

  it("rejeita comissão fora da faixa 0–100", () => {
    const records = [
      { "Apelido público": "Bia", "Comissão (%)": "150" },
      { "Apelido público": "Léo", "Comissão (%)": "-1" },
    ];
    const mapping = autoMapHeaders(Object.keys(records[0]), teamImportSchema);
    const preview = buildPreview(records, teamImportSchema, mapping);

    const errors = preview.errors.filter((e) => e.field === "commissionPct");
    expect(errors).toHaveLength(2);
  });

  it("preview tolera campos opcionais ausentes", () => {
    const records = [{ "Apelido público": "Solo" }];
    const mapping = autoMapHeaders(Object.keys(records[0]), teamImportSchema);
    const preview = buildPreview(records, teamImportSchema, mapping);

    expect(preview.errors).toHaveLength(0);
    expect(preview.rows[0]).toMatchObject({ displayName: "Solo", roleTitle: null, email: null });
  });
});

describe("exportTeamCsv — cabeçalhos e linhas alinhados ao schema atual", () => {
  it("inclui contato, especialidade e comissão nos cabeçalhos", () => {
    const csv = exportTeamCsv([
      {
        displayName: "Marina",
        roleTitle: "Cabeleireira",
        specialty: "Coloração",
        email: "marina@salao.com",
        phone: "11999991234",
        commissionPct: 45,
        isActive: true,
      },
      {
        displayName: "João",
        roleTitle: null,
        specialty: null,
        email: null,
        phone: null,
        commissionPct: null,
        isActive: false,
      },
    ]);
    const parsed = parseCsv(csv);

    expect(parsed.headers).toEqual([
      "apelido_publico",
      "funcao",
      "especialidade",
      "email",
      "telefone",
      "comissao",
      "ativo",
    ]);
    expect(parsed.records[0]).toEqual({
      apelido_publico: "Marina",
      funcao: "Cabeleireira",
      especialidade: "Coloração",
      email: "marina@salao.com",
      telefone: "11999991234",
      comissao: "45",
      ativo: "sim",
    });
    expect(parsed.records[1].comissao).toBe("");
    expect(parsed.records[1].ativo).toBe("não");
  });

  it("buildTeamRows preserva nulos como string vazia", () => {
    const rows = buildTeamRows([
      {
        displayName: "Sem dados",
        roleTitle: null,
        specialty: null,
        email: null,
        phone: null,
        commissionPct: null,
        isActive: true,
      },
    ]);
    expect(rows[0]).toEqual({
      apelido_publico: "Sem dados",
      funcao: "",
      especialidade: "",
      email: "",
      telefone: "",
      comissao: "",
      ativo: "sim",
    });
  });
});

describe("EQUIPE — round-trip export → preview", () => {
  it("exporta equipe e reimporta gerando rows equivalentes", () => {
    const original = [
      {
        displayName: "Marina",
        roleTitle: "Cabeleireira",
        specialty: "Coloração",
        email: "marina@salao.com",
        phone: "11999991234",
        commissionPct: 45,
        isActive: true,
      },
    ];

    const csv = exportTeamCsv(original);
    const parsed = parseCsv(csv);

    const renamed = parsed.records.map((r) => ({
      "Apelido público": r.apelido_publico,
      Função: r.funcao,
      Especialidade: r.especialidade,
      "E-mail": r.email,
      Telefone: r.telefone,
      "Comissão (%)": r.comissao,
      Ativo: r.ativo,
    }));
    const mapping = autoMapHeaders(Object.keys(renamed[0]), teamImportSchema);
    const preview = buildPreview(renamed, teamImportSchema, mapping);

    expect(preview.errors).toHaveLength(0);
    expect(preview.rows[0]).toMatchObject({
      displayName: "Marina",
      roleTitle: "Cabeleireira",
      specialty: "Coloração",
      email: "marina@salao.com",
      phone: "11999991234",
      commissionPct: 45,
      isActive: true,
    });
  });
});

describe("CLIENTES — autoMap, buildPreview e export funcionam em conjunto", () => {
  it("auto-mapeia cabeçalhos típicos de uma planilha de salão", () => {
    const headers = [
      "Nome completo",
      "Telefone",
      "WhatsApp",
      "E-mail",
      "Aniversário",
      "Cidade",
      "UF",
      "Origem",
      "Observações",
      "VIP",
    ];
    const map = autoMapHeaders(headers, clientImportSchema);
    expect(map.fullName).toBe("Nome completo");
    expect(map.phone).toBe("Telefone");
    expect(map.whatsappPhone).toBe("WhatsApp");
    expect(map.email).toBe("E-mail");
    expect(map.birthDate).toBe("Aniversário");
    expect(map.city).toBe("Cidade");
    expect(map.state).toBe("UF");
    expect(map.origin).toBe("Origem");
    expect(map.notes).toBe("Observações");
    expect(map.isVip).toBe("VIP");
  });

  it("buildPreview normaliza telefone, email, data e booleano", () => {
    const records = [
      {
        "Nome completo": "Ana Silva",
        Telefone: "(11) 99999-1234",
        "E-mail": "ANA@CATIVA.COM",
        Aniversário: "21/04/1990",
        VIP: "sim",
      },
    ];
    const mapping = autoMapHeaders(Object.keys(records[0]), clientImportSchema);
    const preview = buildPreview(records, clientImportSchema, mapping);

    expect(preview.errors).toHaveLength(0);
    expect(preview.rows[0]).toMatchObject({
      fullName: "Ana Silva",
      phone: "11999991234",
      email: "ana@cativa.com",
      birthDate: "1990-04-21",
      isVip: true,
    });
  });

  it("export de clientes usa cabeçalhos pt-BR e BOM (Excel-friendly)", () => {
    const clients: Client[] = [
      {
        id: "c1",
        tenantId: "t1",
        preferredUnitId: null,
        preferredProfessionalId: null,
        referredByClientId: null,
        fullName: "Ana Silva",
        email: "ana@cativa.com",
        phone: "11999991234",
        whatsappPhone: "11999991234",
        birthDate: "1990-04-21",
        origin: "Indicação",
        notes: "Alérgica a níquel",
        allergies: null,
        contraindications: null,
        preferences: null,
        status: "active",
        isVip: true,
        riskLevel: "low",
        needsReactivation: false,
        lastVisitAt: "2026-04-01T10:00:00.000Z",
        nextVisitAt: null,
        city: "São Paulo",
        state: "SP",
        averageCycleDays: null,
        churnRiskScore: 0,
        nextBestAction: null,
        lastServiceId: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      },
    ];

    const rows = buildClientRows(clients);
    expect(rows[0].nome).toBe("Ana Silva");

    const csv = exportClientsCsv(clients);
    expect(csv.charCodeAt(0)).toBe(0xfeff);

    const parsed = parseCsv(csv);
    expect(parsed.records[0].nome).toBe("Ana Silva");
    expect(parsed.records[0].vip).toBe("sim");
  });
});
