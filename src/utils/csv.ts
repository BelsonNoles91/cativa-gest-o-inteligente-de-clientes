/**
 * CSV utilities — parse/serialize portáveis (sem dependências externas).
 *
 * Design:
 * - parser tolerante a aspas, vírgulas dentro de campo, CRLF e BOM.
 * - separador autodetectado entre vírgula e ponto-e-vírgula (padrão BR).
 * - serializer escapa aspas duplicando-as e envolve em "" quando necessário.
 *
 * Mantemos isso dentro do projeto — nenhuma lib externa — porque:
 * 1. Reduz superfície de ataque e bundle.
 * 2. Garante portabilidade para qualquer host/VPS sem surpresa.
 */

export interface CsvParseResult {
  headers: string[];
  rows: string[][];
  /** Linhas como objetos chave-valor (header → célula). */
  records: Array<Record<string, string>>;
  delimiter: string;
}

const STRIP_BOM = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

export function parseCsv(input: string, delimiter?: string): CsvParseResult {
  const text = STRIP_BOM(input);
  const delim = delimiter ?? detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      continue;
    }
    if (c === delim) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (c === "\r") {
      // ignoramos — o \n abaixo fecha a linha
      continue;
    }
    cell += c;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim().length > 0));
  if (nonEmpty.length === 0) {
    return { headers: [], rows: [], records: [], delimiter: delim };
  }

  const headers = nonEmpty[0].map((h) => h.trim());
  const dataRows = nonEmpty.slice(1);
  const records = dataRows.map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (r[i] ?? "").trim();
    });
    return obj;
  });

  return { headers, rows: dataRows, records, delimiter: delim };
}

function escapeCell(value: unknown, delim: string): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  const needsQuoting = s.includes(delim) || s.includes('"') || s.includes("\n") || s.includes("\r");
  const escaped = s.replace(/"/g, '""');
  return needsQuoting ? `"${escaped}"` : escaped;
}

export interface SerializeOptions {
  delimiter?: string;
  /** Adiciona BOM utf-8 no início (Excel lê acentuação corretamente). */
  bom?: boolean;
  /** Linha inicial fica em CRLF (compatibilidade Excel). */
  crlf?: boolean;
}

export function serializeCsv<T extends Record<string, unknown>>(
  rows: T[],
  headers: Array<keyof T | string>,
  options: SerializeOptions = {},
): string {
  const delim = options.delimiter ?? ",";
  const eol = options.crlf ? "\r\n" : "\n";
  const lines: string[] = [];
  lines.push(headers.map((h) => escapeCell(String(h), delim)).join(delim));
  for (const r of rows) {
    lines.push(
      headers
        .map((h) => escapeCell((r as Record<string, unknown>)[String(h)], delim))
        .join(delim),
    );
  }
  const content = lines.join(eol);
  return options.bom ? "\ufeff" + content : content;
}

export function downloadFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJson(filename: string, data: unknown) {
  downloadFile(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}
