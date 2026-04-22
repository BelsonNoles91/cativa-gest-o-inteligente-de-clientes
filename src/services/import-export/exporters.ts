/**
 * Exportadores: transformam coleções do domínio em CSV/JSON portáveis.
 * Usado pela tela de Import/Export. Mantemos colunas estáveis e em pt-BR
 * para facilitar abertura no Excel/Sheets.
 */
import { serializeCsv } from "@/utils/csv";
import type { Client } from "@/domain/client";
import type { Membership, Package, Protocol, Service } from "@/domain/catalog";

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
  observacoes: string;
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
  "observacoes",
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
    observacoes: c.notes ?? "",
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
  categoria: string;
  duracao_minutos: number;
  preco: number;
  buffer_antes: number;
  buffer_depois: number;
  ativo: string;
  destaque: string;
  descricao: string;
}

const SERVICE_HEADERS: Array<keyof ServiceExportRow> = [
  "nome",
  "categoria",
  "duracao_minutos",
  "preco",
  "buffer_antes",
  "buffer_depois",
  "ativo",
  "destaque",
  "descricao",
];

export function buildServiceRows(
  services: Service[],
  prices: Map<string, number>,
  categories?: Map<string, string>,
): ServiceExportRow[] {
  return services.map((s) => ({
    nome: s.name,
    categoria: s.categoryId ? (categories?.get(s.categoryId) ?? "") : "",
    duracao_minutos: s.durationMinutes,
    preco: (prices.get(s.id) ?? 0) / 100,
    buffer_antes: s.bufferBeforeMinutes,
    buffer_depois: s.bufferAfterMinutes,
    ativo: s.isActive ? "sim" : "não",
    destaque: s.isFeatured ? "sim" : "não",
    descricao: s.description ?? "",
  }));
}

export function exportServicesCsv(
  services: Service[],
  prices: Map<string, number>,
  categories?: Map<string, string>,
): string {
  return serializeCsv(buildServiceRows(services, prices, categories), SERVICE_HEADERS, {
    bom: true,
    crlf: true,
  });
}

// -----------------------------------------------------------------------------
// TEAM
// -----------------------------------------------------------------------------
// O schema atual da tabela `professionals` guarda apenas apelido público + função.
// Contato, e-mail e comissão serão adicionados quando a tabela for estendida.
export interface TeamExportRow extends Record<string, unknown> {
  apelido_publico: string;
  funcao: string;
  ativo: string;
}

const TEAM_HEADERS: Array<keyof TeamExportRow> = ["apelido_publico", "funcao", "ativo"];

export function buildTeamRows(
  professionals: Array<{
    displayName: string;
    roleTitle: string | null;
    isActive: boolean;
  }>,
): TeamExportRow[] {
  return professionals.map((p) => ({
    apelido_publico: p.displayName,
    funcao: p.roleTitle ?? "",
    ativo: p.isActive ? "sim" : "não",
  }));
}

export function exportTeamCsv(
  professionals: Array<{
    displayName: string;
    roleTitle: string | null;
    isActive: boolean;
  }>,
): string {
  return serializeCsv(buildTeamRows(professionals), TEAM_HEADERS, { bom: true, crlf: true });
}

// -----------------------------------------------------------------------------
// PACKAGES / MEMBERSHIPS / PROTOCOLS
// -----------------------------------------------------------------------------
export interface PackageExportRow extends Record<string, unknown> {
  nome: string;
  tipo: string;
  preco: number;
  validade_dias: number | string;
  intervalo_ideal_dias: number | string;
  descricao: string;
}

const PACKAGE_HEADERS: Array<keyof PackageExportRow> = [
  "nome",
  "tipo",
  "preco",
  "validade_dias",
  "intervalo_ideal_dias",
  "descricao",
];

export function buildPackageRows(packages: Package[]): PackageExportRow[] {
  return packages.map((pkg) => ({
    nome: pkg.name,
    tipo: pkg.kind,
    preco: pkg.priceCents / 100,
    validade_dias: pkg.validityDays ?? "",
    intervalo_ideal_dias: pkg.recommendedIntervalDays ?? "",
    descricao: pkg.description ?? "",
  }));
}

export function exportPackagesCsv(packages: Package[]): string {
  return serializeCsv(buildPackageRows(packages), PACKAGE_HEADERS, { bom: true, crlf: true });
}

export interface MembershipExportRow extends Record<string, unknown> {
  nome: string;
  preco: number;
  ciclo: string;
  ativo: string;
  descricao: string;
  observacoes: string;
}

const MEMBERSHIP_HEADERS: Array<keyof MembershipExportRow> = [
  "nome",
  "preco",
  "ciclo",
  "ativo",
  "descricao",
  "observacoes",
];

export function buildMembershipRows(memberships: Membership[]): MembershipExportRow[] {
  return memberships.map((membership) => ({
    nome: membership.name,
    preco: membership.priceCents / 100,
    ciclo: membership.billingCycle,
    ativo: membership.isActive ? "sim" : "não",
    descricao: membership.description ?? "",
    observacoes: membership.notes ?? "",
  }));
}

export function exportMembershipsCsv(memberships: Membership[]): string {
  return serializeCsv(buildMembershipRows(memberships), MEMBERSHIP_HEADERS, { bom: true, crlf: true });
}

export interface ProtocolExportRow extends Record<string, unknown> {
  nome: string;
  sessoes_totais: number;
  intervalo_ideal_dias: number | string;
  preco_total: number | string;
  ativo: string;
  descricao: string;
}

const PROTOCOL_HEADERS: Array<keyof ProtocolExportRow> = [
  "nome",
  "sessoes_totais",
  "intervalo_ideal_dias",
  "preco_total",
  "ativo",
  "descricao",
];

export function buildProtocolRows(protocols: Protocol[]): ProtocolExportRow[] {
  return protocols.map((protocol) => ({
    nome: protocol.name,
    sessoes_totais: protocol.totalSessions,
    intervalo_ideal_dias: protocol.recommendedIntervalDays ?? "",
    preco_total: protocol.totalPriceCents === null ? "" : protocol.totalPriceCents / 100,
    ativo: protocol.isActive ? "sim" : "não",
    descricao: protocol.description ?? "",
  }));
}

export function exportProtocolsCsv(protocols: Protocol[]): string {
  return serializeCsv(buildProtocolRows(protocols), PROTOCOL_HEADERS, { bom: true, crlf: true });
}

// -----------------------------------------------------------------------------
// APPOINTMENTS
// -----------------------------------------------------------------------------
export interface AppointmentExportRow extends Record<string, unknown> {
  cliente: string;
  profissional: string;
  unidade: string;
  servico: string;
  inicio: string;
  duracao: number;
  preco: number;
  status: string;
  origem: string;
  observacoes: string;
}

const APPT_HEADERS: Array<keyof AppointmentExportRow> = [
  "cliente",
  "profissional",
  "unidade",
  "servico",
  "inicio",
  "duracao",
  "preco",
  "status",
  "origem",
  "observacoes",
];

export function buildAppointmentRows(
  appts: Array<{
    startsAt: string;
    durationMinutes: number;
    totalPriceCents: number;
    status: string;
    source: string;
    notes: string | null;
    clientName: string | null;
    professionalName: string | null;
    unitName: string | null;
    serviceName: string | null;
  }>,
): AppointmentExportRow[] {
  return appts.map((a) => ({
    cliente: a.clientName ?? "",
    profissional: a.professionalName ?? "",
    unidade: a.unitName ?? "",
    servico: a.serviceName ?? "",
    inicio: a.startsAt,
    duracao: a.durationMinutes,
    preco: a.totalPriceCents / 100,
    status: a.status,
    origem: a.source,
    observacoes: a.notes ?? "",
  }));
}

export function exportAppointmentsCsv(
  appts: Array<{
    startsAt: string;
    durationMinutes: number;
    totalPriceCents: number;
    status: string;
    source: string;
    notes: string | null;
    clientName: string | null;
    professionalName: string | null;
    unitName: string | null;
    serviceName: string | null;
  }>,
): string {
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
