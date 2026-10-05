/**
 * Service: monta o contexto de variáveis e renderiza um template de
 * mensagem para a Central de Confirmação.
 *
 * REGRA: nunca dispara mensagens. Só prepara o texto que o operador
 * vai copiar/abrir manualmente.
 */
import { renderTemplate, type MessageTemplate } from "@/domain/confirmation";

export interface RenderContext {
  clientName?: string | null;
  businessName?: string | null;
  unitName?: string | null;
  professionalName?: string | null;
  serviceName?: string | null;
  startsAt?: string | null;       // ISO
  unitAddress?: string | null;
}

function firstName(full?: string | null): string {
  if (!full) return "";
  return full.trim().split(/\s+/)[0];
}

function parseDate(iso?: string | null): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fmtDate(iso?: string | null): string {
  const d = parseDate(iso);
  if (!d) return "";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function fmtTime(iso?: string | null): string {
  const d = parseDate(iso);
  if (!d) return "";
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso?: string | null): string {
  const d = parseDate(iso);
  if (!d) return "";
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function buildContext(ctx: RenderContext): Record<string, string> {
  return {
    cliente_nome: ctx.clientName ?? "",
    cliente_primeiro_nome: firstName(ctx.clientName),
    negocio_nome: ctx.businessName ?? "",
    unidade_nome: ctx.unitName ?? "",
    profissional_nome: ctx.professionalName ?? "",
    servico_nome: ctx.serviceName ?? "",
    data: fmtDate(ctx.startsAt),
    hora: fmtTime(ctx.startsAt),
    data_hora: fmtDateTime(ctx.startsAt),
    endereco: ctx.unitAddress ?? "",
  };
}

export function renderForTemplate(template: MessageTemplate, ctx: RenderContext): string {
  return renderTemplate(template.body, buildContext(ctx));
}
