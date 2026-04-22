/**
 * Testes do pipeline de importação/exportação CSV para EQUIPE e CLIENTES.
 *
 * Estes testes garantem que:
 *   1. O schema de equipe só expõe colunas que existem em `professionals`
 *      no banco (apelido público + função). Qualquer drift volta a quebrar
 *      `importTeam` / `exportTeam`.
 *   2. O auto-mapeamento de cabeçalhos pt-BR → chaves canônicas funciona
 *      para os aliases declarados (Apelido público, Especialidade, etc).
 *   3. O preview (buildPreview) acumula corretamente os erros quando o
 *      campo obrigatório `displayName` está vazio.
 *   4. O round-trip "export → parse → preview" para clientes e equipe
 *      preserva os dados essenciais e usa os cabeçalhos esperados pelo
 *      Excel/Sheets em pt-BR.
 *
 * Sem Supabase: usamos apenas as funções puras de schemas/utils, que é
 * exatamente onde mora o risco de regressão depois das correções da Fase 8.
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

// ============================================================================
// Schema de EQUIPE — colunas devem refletir a tabela real `professionals`
// ============================================================================

describe("teamImportSchema — alinhamento com a tabela professionals", () => {
  it("expõe apenas displayName e roleTitle como chaves canônicas", () => {
    const keys = teamImportSchema.fields.map((f) => f.key).sort();
    expect(keys).toEqual(["displayName", "roleTitle"].sort());
  });

  it("não expõe colunas legadas (full_name, email, phone, commission_pct)", () => {
    const keys = teamImportSchema.fields.map((f) => f.key);
    expect(keys).not.toContain("fullName");
    expect(keys).not.toContain("email");
    expect(keys).not.toContain("phone");
    expect(keys).not.toContain("commissionPct");
  });

  it("marca displayName como obrigatório (espelha NOT NULL no banco)", () => {
    const displayName = teamImportSchema.fields.find((f) => f.key === "displayName");
    expect(displayName?.required).toBe(true);
    const roleTitle = teamImportSchema.fields.find((f) => f.key === "roleTitle");
    expect(roleTitle?.required).not.toBe(true);
  });

  it("está registrado em importSchemas['team']", () => {
    expect(importSchemas.team).toBe(teamImportSchema);
  });
});

// ============================================================================
// Auto-mapeamento de cabeçalhos pt-BR para EQUIPE
// ============================================================================

describe("teamImportSchema — autoMapHeaders cobre aliases pt-BR", () => {
  it("mapeia 'Apelido público' e 'Especialidade'", () => {
    const map = autoMapHeaders(["Apelido público", "Especialidade"], teamImportSchema);
    expect(map.displayName).toBe("Apelido público");
    expect(map.roleTitle).toBe("Especialidade");
  });

  it("aceita variações: 'Nome' / 'Profissional' / 'Função' / 'Cargo'", () => {
    const map1 = autoMapHeaders(["Profissional", "Função"], teamImportSchema);
    expect(map1.displayName).toBe("Profissional");
    expect(map1.roleTitle).toBe("Função");

    const map2 = autoMapHeaders(["Nome", "Cargo"], teamImportSchema);
    expect(map2.displayName).toBe("Nome");
    expect(map2.roleTitle).toBe("Cargo");
  });

  it("retorna null para roleTitle quando o cabeçalho não está presente", () => {
    const map = autoMapHeaders(["Apelido público"], teamImportSchema);
    expect(map.displayName).toBe("Apelido público");
    expect(map.roleTitle).toBeNull();
  });

  it("ignora colunas legadas que não existem mais no schema", () => {
    // Mesmo que o usuário traga um CSV antigo com email/telefone/comissão,
    // nenhuma chave canônica deve ser criada para esses headers.
    const map = autoMapHeaders(
      ["Apelido público", "Especialidade", "E-mail", "Telefone", "Comissão (%)"],
      teamImportSchema,
    );
    expect(Object.keys(map).sort()).toEqual(["displayName", "roleTitle"].sort());
    expect(map.displayName).toBe("Apelido público");
    expect(map.roleTitle).toBe("Especialidade");
  });
});

// ============================================================================
// Preview (buildPreview) — validação de obrigatório
// ============================================================================

describe("teamImportSchema — buildPreview valida displayName obrigatório", () => {
  it("aceita linhas válidas e expõe displayName/roleTitle normalizados", () => {
    const records = [
      { "Apelido público": "Marina", Especialidade: "Cabeleireira" },
      { "Apelido público": "João", Especialidade: "Barbeiro" },
    ];
    const mapping = autoMapHeaders(Object.keys(records[0]), teamImportSchema);
    const preview = buildPreview(records, teamImportSchema, mapping);

    expect(preview.errors).toHaveLength(0);
    expect(preview.rows).toHaveLength(2);
    expect(preview.rows[0]).toEqual({ displayName: "Marina", roleTitle: "Cabeleireira" });
    expect(preview.rows[1]).toEqual({ displayName: "João", roleTitle: "Barbeiro" });
  });

  it("acusa erro quando displayName está vazio", () => {
    const records = [
      { "Apelido público": "", Especialidade: "Massoterapeuta" },
      { "Apelido público": "Ana", Especialidade: "" },
    ];
    const mapping = autoMapHeaders(Object.keys(records[0]), teamImportSchema);
    const preview = buildPreview(records, teamImportSchema, mapping);

    // Linha 0: displayName obrigatório falhou. Linha 1: ok (roleTitle é opcional).
    const errorsForRow0 = preview.errors.filter((e) => e.rowIndex === 0);
    const errorsForRow1 = preview.errors.filter((e) => e.rowIndex === 1);

    expect(errorsForRow0).toHaveLength(1);
    expect(errorsForRow0[0].field).toBe("displayName");
    expect(errorsForRow1).toHaveLength(0);

    expect(preview.rows[0]).toEqual({ displayName: null, roleTitle: "Massoterapeuta" });
    expect(preview.rows[1]).toEqual({ displayName: "Ana", roleTitle: null });
  });

  it("preview tolera roleTitle ausente em todas as linhas", () => {
    const records = [{ "Apelido público": "Solo" }];
    const mapping = autoMapHeaders(Object.keys(records[0]), teamImportSchema);
    const preview = buildPreview(records, teamImportSchema, mapping);

    expect(preview.errors).toHaveLength(0);
    expect(preview.rows[0]).toEqual({ displayName: "Solo", roleTitle: null });
  });
});

// ============================================================================
// Exportador de EQUIPE — cabeçalhos pt-BR e mapeamento
// ============================================================================

describe("exportTeamCsv — cabeçalhos e linhas alinhados ao schema atual", () => {
  it("usa apenas apelido_publico, funcao, ativo (sem email/telefone/comissão)", () => {
    const csv = exportTeamCsv([
      { displayName: "Marina", roleTitle: "Cabeleireira", isActive: true },
      { displayName: "João", roleTitle: null, isActive: false },
    ]);
    const parsed = parseCsv(csv);

    expect(parsed.headers).toEqual(["apelido_publico", "funcao", "ativo"]);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records[0]).toEqual({
      apelido_publico: "Marina",
      funcao: "Cabeleireira",
      ativo: "sim",
    });
    expect(parsed.records[1]).toEqual({
      apelido_publico: "João",
      funcao: "",
      ativo: "não",
    });
  });

  it("buildTeamRows preserva nulos como string vazia para CSV", () => {
    const rows = buildTeamRows([
      { displayName: "Sem função", roleTitle: null, isActive: true },
    ]);
    expect(rows[0]).toEqual({
      apelido_publico: "Sem função",
      funcao: "",
      ativo: "sim",
    });
  });
});

// ============================================================================
// Round-trip: EQUIPE — export → parse → autoMap → preview
// ============================================================================

describe("EQUIPE — round-trip export → preview reaproveita os mesmos dados", () => {
  it("exporta equipe e reimporta gerando rows equivalentes (sem erros)", () => {
    const original = [
      { displayName: "Marina", roleTitle: "Cabeleireira", isActive: true },
      { displayName: "João", roleTitle: "Barbeiro", isActive: true },
      { displayName: "Bia", roleTitle: null, isActive: false },
    ];

    const csv = exportTeamCsv(original);
    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual(["apelido_publico", "funcao", "ativo"]);

    // Para reimportar como "equipe", o usuário renomearia cabeçalhos
    // para os aliases reconhecidos. Simulamos isso fornecendo o mapping
    // explícito a partir dos headers de exportação.
    const mapping = autoMapHeaders(["Apelido público", "Especialidade"], teamImportSchema);
    // Renomeia chaves dos records para casar com o mapping acima.
    const renamed = parsed.records.map((r) => ({
      "Apelido público": r.apelido_publico,
      Especialidade: r.funcao,
    }));

    const preview = buildPreview(renamed, teamImportSchema, mapping);
    expect(preview.errors).toHaveLength(0);
    expect(preview.rows).toEqual([
      { displayName: "Marina", roleTitle: "Cabeleireira" },
      { displayName: "João", roleTitle: "Barbeiro" },
      { displayName: "Bia", roleTitle: null },
    ]);
  });
});

// ============================================================================
// CLIENTES — auto-map + preview + export round-trip
// ============================================================================

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

  it("acumula erro quando 'Nome completo' (obrigatório) está vazio", () => {
    const records = [
      { "Nome completo": "", Telefone: "11999990000" },
      { "Nome completo": "Beto", Telefone: "" },
    ];
    const mapping = autoMapHeaders(Object.keys(records[0]), clientImportSchema);
    const preview = buildPreview(records, clientImportSchema, mapping);

    const requiredErrors = preview.errors.filter((e) => e.field === "fullName");
    expect(requiredErrors).toHaveLength(1);
    expect(requiredErrors[0].rowIndex).toBe(0);
  });

  it("export de clientes usa cabeçalhos pt-BR e BOM (Excel-friendly)", () => {
    const clients: Client[] = [
      {
        id: "c1",
        tenantId: "t1",
        fullName: "Ana Silva",
        phone: "11999991234",
        whatsappPhone: "11999991234",
        email: "ana@cativa.com",
        birthDate: "1990-04-21",
        city: "São Paulo",
        state: "SP",
        country: "BR",
        addressLine1: null,
        addressLine2: null,
        postalCode: null,
        origin: "Indicação",
        notes: "Alérgica a níquel",
        preferences: null,
        allergies: null,
        contraindications: null,
        isVip: true,
        riskLevel: "low",
        status: "active",
        needsReactivation: false,
        lastVisitAt: "2026-04-01T10:00:00.000Z",
        nextVisitAt: null,
        preferredProfessionalId: null,
        preferredUnitId: null,
        referredByClientId: null,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
        createdBy: null,
      },
    ];

    const rows = buildClientRows(clients);
    expect(rows[0]).toMatchObject({
      nome: "Ana Silva",
      telefone: "11999991234",
      whatsapp: "11999991234",
      email: "ana@cativa.com",
      nascimento: "1990-04-21",
      cidade: "São Paulo",
      uf: "SP",
      origem: "Indicação",
      observacoes: "Alérgica a níquel",
      vip: "sim",
      status: "active",
      ultima_visita: "2026-04-01T10:00:00.000Z",
    });

    const csv = exportClientsCsv(clients);
    // BOM no início para o Excel ler acentuação corretamente.
    expect(csv.charCodeAt(0)).toBe(0xfeff);

    const parsed = parseCsv(csv);
    expect(parsed.headers).toEqual([
      "nome",
      "telefone",
      "whatsapp",
      "email",
      "nascimento",
      "cidade",
      "uf",
      "origem",
      "observacoes",
      "vip",
      "status",
      "ultima_visita",
    ]);
    expect(parsed.records[0].nome).toBe("Ana Silva");
    expect(parsed.records[0].vip).toBe("sim");
  });
});
