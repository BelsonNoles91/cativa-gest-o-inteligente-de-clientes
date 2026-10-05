import { describe, expect, it } from "vitest";
import type { MessageTemplate } from "@/domain/confirmation";
import { buildContext, renderForTemplate } from "./renderTemplate";

function template(body: string): MessageTemplate {
  return {
    id: "template-qa",
    tenantId: "tenant-qa",
    unitId: null,
    serviceId: null,
    stage: "confirmation",
    channel: "whatsapp",
    name: "Confirmação QA",
    body,
    variables: [],
    isDefault: true,
    isActive: true,
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
  };
}

describe("renderização de mensagens da Central de Confirmação", () => {
  it("mapeia os dados do contexto e usa o primeiro nome sem espaços extras", () => {
    expect(buildContext({
      clientName: "  Ana   Beatriz Souza  ",
      businessName: "Ateliê Cativa",
      unitName: "Unidade Norte",
      professionalName: "Dra. Carla",
      serviceName: "Limpeza de pele",
      unitAddress: "Rua QA, 123",
    })).toMatchObject({
      cliente_nome: "  Ana   Beatriz Souza  ",
      cliente_primeiro_nome: "Ana",
      negocio_nome: "Ateliê Cativa",
      unidade_nome: "Unidade Norte",
      profissional_nome: "Dra. Carla",
      servico_nome: "Limpeza de pele",
      endereco: "Rua QA, 123",
    });
  });

  it("normaliza contexto opcional ausente e nomes em branco", () => {
    expect(buildContext({ clientName: "   ", businessName: null, startsAt: null })).toMatchObject({
      cliente_primeiro_nome: "",
      negocio_nome: "",
      data: "",
      hora: "",
      data_hora: "",
    });
  });

  it("formata uma data válida para todos os placeholders sem depender do fuso local", () => {
    const context = buildContext({ startsAt: "2026-10-04T15:30:00.000Z" });

    expect(context.data).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(context.hora).toMatch(/^\d{2}:\d{2}$/);
    expect(context.data_hora).not.toBe("");
    expect(context.data_hora).not.toContain("Invalid Date");
  });

  it("não expõe 'Invalid Date' quando o timestamp está corrompido", () => {
    expect(buildContext({ startsAt: "data-inválida" })).toMatchObject({
      data: "",
      hora: "",
      data_hora: "",
    });
  });

  it("substitui variáveis conhecidas e deixa valores ausentes vazios, sem enviar mensagens", () => {
    const rendered = renderForTemplate(
      template("Olá {{ cliente_primeiro_nome }}, {{servico_nome}} em {{unidade_nome}}."),
      { clientName: "Marina dos Santos", serviceName: "Massagem" },
    );

    expect(rendered).toBe("Olá Marina, Massagem em .");
  });
});
