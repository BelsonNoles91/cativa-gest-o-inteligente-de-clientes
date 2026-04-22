/**
 * Schemas declarativos para importação/exportação CSV.
 *
 * Cada schema define:
 *  - chaves canônicas (key) usadas internamente
 *  - aliases comuns (em pt-BR e en) para auto-mapeamento da coluna
 *  - se é obrigatória
 *  - parser/normalização da célula
 *  - exporter (chave → valor da linha de export)
 *
 * Mantemos schemas isolados de Supabase: a UI faz parse → preview →
 * persistência via repositories. Isso preserva portabilidade.
 */

export type ImportFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "phone"
  | "email";

export interface ImportField {
  key: string;
  label: string;
  required?: boolean;
  type?: ImportFieldType;
  /** Aliases (case-insensitive, sem acento) que tentamos casar com o cabeçalho do CSV. */
  aliases?: string[];
  /** Validação adicional. Retorna mensagem de erro ou null. */
  validate?: (value: unknown, row: Record<string, unknown>) => string | null;
}

export interface ImportSchema {
  id: string;
  label: string;
  description: string;
  fields: ImportField[];
}

// =============================================================================
// Helpers de normalização
// =============================================================================
function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function autoMapHeaders(headers: string[], schema: ImportSchema): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: normalizeKey(h) }));

  for (const field of schema.fields) {
    const candidates = [field.key, field.label, ...(field.aliases ?? [])].map(normalizeKey);
    const found = normalizedHeaders.find((h) => candidates.includes(h.norm));
    map[field.key] = found?.raw ?? null;
  }
  return map;
}

export function parseCell(value: string, type: ImportFieldType = "string"): unknown {
  const v = (value ?? "").trim();
  if (v === "") return null;
  switch (type) {
    case "number": {
      // aceita 1.234,56 (BR), 1234.56 (EN), 1,234.56 e variações simples
      const hasComma = v.includes(",");
      const hasDot = v.includes(".");
      let cleaned = v;

      if (hasComma && hasDot) {
        // O último separador costuma ser o decimal.
        if (v.lastIndexOf(",") > v.lastIndexOf(".")) {
          cleaned = v.replace(/\./g, "").replace(",", ".");
        } else {
          cleaned = v.replace(/,/g, "");
        }
      } else if (hasComma) {
        const parts = v.split(",");
        cleaned = parts.length === 2 && parts[1].length <= 2
          ? `${parts[0].replace(/\./g, "")}.${parts[1]}`
          : v.replace(/,/g, "");
      } else if (hasDot) {
        const parts = v.split(".");
        cleaned = parts.length === 2 && parts[1].length <= 2
          ? v
          : v.replace(/\./g, "");
      }

      const n = Number(cleaned);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean": {
      const yes = ["1", "true", "sim", "yes", "y", "s"];
      return yes.includes(v.toLowerCase());
    }
    case "date": {
      // tenta ISO; se não, tenta dd/mm/yyyy
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
      const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (m) {
        const day = m[1].padStart(2, "0");
        const month = m[2].padStart(2, "0");
        const year = m[3].length === 2 ? `20${m[3]}` : m[3];
        return `${year}-${month}-${day}`;
      }
      return v;
    }
    case "datetime": {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
        const parsedIso = new Date(v);
        return Number.isNaN(parsedIso.getTime()) ? v : parsedIso.toISOString();
      }
      const isoMinuteMatch = v.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
      if (isoMinuteMatch) {
        const parsedIso = new Date(
          `${isoMinuteMatch[1]}T${isoMinuteMatch[2]}:${isoMinuteMatch[3]}:${isoMinuteMatch[4] ?? "00"}`,
        );
        return Number.isNaN(parsedIso.getTime()) ? v : parsedIso.toISOString();
      }
      const brMatch = v.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/,
      );
      if (brMatch) {
        const day = brMatch[1].padStart(2, "0");
        const month = brMatch[2].padStart(2, "0");
        const year = brMatch[3].length === 2 ? `20${brMatch[3]}` : brMatch[3];
        const hour = (brMatch[4] ?? "0").padStart(2, "0");
        const minute = brMatch[5] ?? "00";
        const second = brMatch[6] ?? "00";
        const parsed = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}`);
        return Number.isNaN(parsed.getTime()) ? v : parsed.toISOString();
      }
      return v;
    }
    case "phone":
      return v.replace(/\D/g, "");
    case "email":
      return v.toLowerCase();
    default:
      return v;
  }
}

// =============================================================================
// Schemas de importação
// =============================================================================
export const clientImportSchema: ImportSchema = {
  id: "clients",
  label: "Clientes",
  description: "Importe sua base de clientes a partir de planilha CSV.",
  fields: [
    {
      key: "fullName",
      label: "Nome completo",
      required: true,
      aliases: ["nome", "cliente", "nome_completo", "name", "full name"],
    },
    { key: "phone", label: "Telefone", type: "phone", aliases: ["celular", "telefone", "phone", "fone"] },
    { key: "whatsappPhone", label: "WhatsApp", type: "phone", aliases: ["whatsapp", "wpp", "zap"] },
    { key: "email", label: "E-mail", type: "email", aliases: ["email", "e-mail"] },
    { key: "birthDate", label: "Nascimento", type: "date", aliases: ["data_nascimento", "aniversario", "dob"] },
    { key: "city", label: "Cidade", aliases: ["cidade", "city"] },
    { key: "state", label: "UF", aliases: ["estado", "uf", "state"] },
    { key: "origin", label: "Origem", aliases: ["origem", "como_conheceu", "source"] },
    { key: "notes", label: "Observações", aliases: ["observacao", "obs", "anotacoes", "notes"] },
    {
      key: "isVip",
      label: "VIP",
      type: "boolean",
      aliases: ["vip", "premium"],
    },
  ],
};

export const serviceImportSchema: ImportSchema = {
  id: "services",
  label: "Serviços",
  description: "Importe seu catálogo de serviços com duração e preço.",
  fields: [
    { key: "name", label: "Nome", required: true, aliases: ["servico", "service", "titulo"] },
    { key: "categoryName", label: "Categoria", aliases: ["categoria", "category"] },
    {
      key: "durationMinutes",
      label: "Duração (min)",
      type: "number",
      required: true,
      aliases: ["duracao", "duracao_minutos", "duration", "minutos"],
    },
    {
      key: "priceCents",
      label: "Preço (R$)",
      type: "number",
      aliases: ["preco", "price", "valor"],
      validate: (v) =>
        v === null || (typeof v === "number" && v >= 0) ? null : "Preço inválido.",
    },
    {
      key: "bufferBeforeMinutes",
      label: "Buffer antes (min)",
      type: "number",
      aliases: ["buffer_antes", "intervalo_antes"],
    },
    {
      key: "bufferAfterMinutes",
      label: "Buffer depois (min)",
      type: "number",
      aliases: ["buffer_depois", "intervalo_depois"],
    },
    { key: "description", label: "Descrição", aliases: ["descricao", "description"] },
  ],
};

export const teamImportSchema: ImportSchema = {
  id: "team",
  label: "Equipe / Profissionais",
  description:
    "Importe os profissionais que atendem. O schema atual usa apelido público + função. " +
    "Vínculo a usuário, contatos e comissão são gerenciados depois pelo módulo de Equipe.",
  fields: [
    {
      key: "displayName",
      label: "Apelido público",
      required: true,
      aliases: ["apelido", "nome_publico", "nome", "profissional", "nome_completo", "name", "full name"],
    },
    {
      key: "roleTitle",
      label: "Função / Especialidade",
      aliases: ["funcao", "cargo", "especialidade", "specialty", "role"],
    },
  ],
};

export const packageImportSchema: ImportSchema = {
  id: "packages",
  label: "Pacotes / Protocolos",
  description: "Importe pacotes e protocolos para venda recorrente.",
  fields: [
    { key: "name", label: "Nome", required: true, aliases: ["pacote", "protocolo"] },
    { key: "kind", label: "Tipo", aliases: ["tipo", "categoria"] },
    { key: "priceCents", label: "Preço (R$)", type: "number", aliases: ["preco", "valor"] },
    { key: "validityDays", label: "Validade (dias)", type: "number", aliases: ["validade", "dias_validade"] },
    {
      key: "recommendedIntervalDays",
      label: "Intervalo ideal (dias)",
      type: "number",
      aliases: ["intervalo", "intervalo_ideal"],
    },
    { key: "description", label: "Descrição", aliases: ["descricao"] },
  ],
};

export const appointmentImportSchema: ImportSchema = {
  id: "appointments",
  label: "Agendamentos",
  description:
    "Importação inicial de agendamentos a partir de planilha — útil para migrações.",
  fields: [
    { key: "clientName", label: "Cliente", required: true, aliases: ["cliente", "nome_cliente"] },
    { key: "professionalName", label: "Profissional", required: true, aliases: ["profissional", "atendente"] },
    { key: "unitName", label: "Unidade", aliases: ["unidade", "unit", "salao", "clinica"] },
    { key: "serviceName", label: "Serviço", required: true, aliases: ["servico", "service"] },
    {
      key: "startsAt",
      label: "Início (ISO ou dd/mm/aaaa hh:mm)",
      required: true,
      type: "datetime",
      aliases: ["inicio", "data_hora", "data_hora_inicio", "starts_at"],
    },
    { key: "durationMinutes", label: "Duração (min)", type: "number", aliases: ["duracao"] },
    { key: "priceCents", label: "Preço (R$)", type: "number", aliases: ["preco", "valor"] },
    {
      key: "source",
      label: "Origem",
      aliases: ["origem", "canal"],
      validate: (v) =>
        v === null || ["frontdesk", "professional", "client_portal", "walk_in", "phone", "whatsapp", "recurring", "system"].includes(String(v))
          ? null
          : "Origem inválida.",
    },
    {
      key: "status",
      label: "Status",
      aliases: ["status", "situacao"],
      validate: (v) =>
        v === null || ["requested", "pending", "confirmed", "reminded", "arrived", "in_service", "completed", "canceled", "no_show"].includes(String(v))
          ? null
          : "Status inválido.",
    },
    { key: "notes", label: "Observações", aliases: ["obs", "anotacoes"] },
  ],
};

export const importSchemas: Record<string, ImportSchema> = {
  clients: clientImportSchema,
  services: serviceImportSchema,
  team: teamImportSchema,
  packages: packageImportSchema,
  appointments: appointmentImportSchema,
};

// =============================================================================
// Validação de linhas
// =============================================================================
export interface ValidationError {
  rowIndex: number;
  field: string;
  message: string;
}

export interface BuildPreviewResult {
  rows: Array<Record<string, unknown>>;
  errors: ValidationError[];
}

export function buildPreview(
  records: Array<Record<string, string>>,
  schema: ImportSchema,
  mapping: Record<string, string | null>,
): BuildPreviewResult {
  const rows: Array<Record<string, unknown>> = [];
  const errors: ValidationError[] = [];

  records.forEach((rec, idx) => {
    const built: Record<string, unknown> = {};
    for (const field of schema.fields) {
      const sourceCol = mapping[field.key];
      const raw = sourceCol ? rec[sourceCol] ?? "" : "";
      const parsed = parseCell(raw, field.type);
      if (field.required && (parsed === null || parsed === "")) {
        errors.push({
          rowIndex: idx,
          field: field.key,
          message: `${field.label} é obrigatório.`,
        });
      }
      if (field.validate) {
        const msg = field.validate(parsed, rec);
        if (msg) errors.push({ rowIndex: idx, field: field.key, message: msg });
      }
      built[field.key] = parsed;
    }
    rows.push(built);
  });

  return { rows, errors };
}
