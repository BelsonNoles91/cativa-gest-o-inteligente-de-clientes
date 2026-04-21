/**
 * Exportadores: transformam coleções do domínio em CSV/JSON portáveis.
 * Usado pela tela de Import/Export. Mantemos colunas estáveis e em pt-BR
 * para facilitar abertura no Excel/Sheets.
 */
import { serializeCsv } from "@/utils/csv";
import type { Client } from "@/domain/client";
import type { Service } from "@/domain/catalog";
import type { Appointment } from "@/domain/scheduling";

// -----------------------------------------------------------------------------
// CLIENTS
// -----------------------------------------------------------------------------
export interface ClientExportRow extends Record<string, unknown> {
  nome: string;
  telefone: string;
  whatsapp: string;
  email: string;
  nascimento: string;
  cidade: string;
  uf: string;
  origem: string;
  vip: string;
  status: string;
  ultima_visita: string;
}

const CLIENT_HEADERS: Array<keyof ClientExportRow> = [
  "nome",
  "telefone",
  "whatsapp",
  "email",
  "nascimento",
  "cidade",
  "uf",
  "origem",
  "vip",
  "status",
  "ultima_visita",
];

export function buildClientRows(clients: Client[]): ClientExportRow[] {
  return clients.map((c) => ({
    nome: c.fullName,
    telefone: c.phone ?? "",
    whatsapp: c.whatsappPhone ?? "",
    email: c.email ?? "",
    nascimento: c.birthDate ?? "",
    cidade: c.city ?? "",
    uf: c.state ?? "",
    origem: c.origin ?? "",
    vip: c.isVip ? "sim" : "não",
    status: c.status,
    ultima_visita: c.lastVisitAt ?? "",
  }));
}

export function exportClientsCsv(clients: Client[]): string {
  return serializeCsv(buildClientRows(clients), CLIENT_HEADERS, { bom: true, crlf: true });
}

// -----------------------------------------------------------------------------
// SERVICES
// -----------------------------------------------------------------------------
export interface ServiceExportRow extends Record<string, unknown> {
  nome: string;
  duracao_minutos: number;
  preco_centavos: number;
  buffer_antes: number;
  buffer_depois: number;
  ativo: string;
  destaque: string;
  descricao: string;
}

const SERVICE_HEADERS: Array<keyof ServiceExportRow> = [
  "nome",
  "duracao_minutos",
  "preco_centavos",
  "buffer_antes",
  "buffer_depois",
  "ativo",
  "destaque",
  "descricao",
];

export function buildServiceRows(
  services: Service[],
  prices: Map<string, number>,
): ServiceExportRow[] {
  return services.map((s) => ({
    nome: s.name,
    duracao_minutos: s.durationMinutes,
    preco_centavos: prices.get(s.id) ?? 0,
    buffer_antes: s.bufferBeforeMinutes,
    buffer_depois: s.bufferAfterMinutes,
    ativo: s.isActive ? "sim" : "não",
    destaque: s.isFeatured ? "sim" : "não",
    descricao: s.description ?? "",
  }));
}

export function exportServicesCsv(services: Service[], prices: Map<string, number>): string {
  return serializeCsv(buildServiceRows(services, prices), SERVICE_HEADERS, {
    bom: true,
    crlf: true,
  });
}

// -----------------------------------------------------------------------------
// APPOINTMENTS
// -----------------------------------------------------------------------------
export interface AppointmentExportRow extends Record<string, unknown> {
  inicio: string;
  fim: string;
  duracao_minutos: number;
  cliente_id: string;
  profissional_id: string;
  unidade_id: string;
  status: string;
  origem: string;
  preco_centavos: number;
  observacoes: string;
}

const APPT_HEADERS: Array<keyof AppointmentExportRow> = [
  "inicio",
  "fim",
  "duracao_minutos",
  "cliente_id",
  "profissional_id",
  "unidade_id",
  "status",
  "origem",
  "preco_centavos",
  "observacoes",
];

export function buildAppointmentRows(appts: Appointment[]): AppointmentExportRow[] {
  return appts.map((a) => ({
    inicio: a.startsAt,
    fim: a.endsAt,
    duracao_minutos: a.durationMinutes,
    cliente_id: a.clientId,
    profissional_id: a.professionalId,
    unidade_id: a.unitId,
    status: a.status,
    origem: a.source,
    preco_centavos: a.totalPriceCents,
    observacoes: a.notes ?? "",
  }));
}

export function exportAppointmentsCsv(appts: Appointment[]): string {
  return serializeCsv(buildAppointmentRows(appts), APPT_HEADERS, { bom: true, crlf: true });
}

// -----------------------------------------------------------------------------
// METRICS / SETTINGS
// -----------------------------------------------------------------------------
export interface MetricSummary extends Record<string, unknown> {
  metrica: string;
  valor: number | string;
  unidade?: string;
}

export function exportMetricsCsv(rows: MetricSummary[]): string {
  return serializeCsv(rows, ["metrica", "valor", "unidade"], { bom: true, crlf: true });
}
