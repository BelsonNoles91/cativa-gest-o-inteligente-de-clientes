/**
 * Regras obrigatórias de cadastro de cliente:
 * - Nome com pelo menos duas palavras.
 * - WhatsApp celular brasileiro com DDD (11 dígitos: DDD + 9XXXX-XXXX).
 */

export function onlyDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Remove o código do país (55) se vier junto. */
function normalizeBR(value: string | null | undefined): string {
  let d = onlyDigits(value);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d.slice(0, 11);
}

/** Máscara progressiva: (11) 99999-9999 */
export function maskMobileBR(value: string | null | undefined): string {
  const d = normalizeBR(value);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidMobileBR(value: string | null | undefined): boolean {
  const d = normalizeBR(value);
  if (d.length !== 11) return false;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99 || d.slice(0, 2).includes("0")) return false;
  return d[2] === "9";
}

export function isValidFullName(value: string | null | undefined): boolean {
  const words = (value ?? "").trim().split(/\s+/).filter((w) => w.replace(/[^\p{L}]/gu, "").length >= 2);
  return words.length >= 2;
}

export const FULL_NAME_ERROR = "Informe nome e sobrenome (pelo menos duas palavras).";
export const WHATSAPP_ERROR = "Informe um WhatsApp válido com DDD, ex.: (11) 99999-9999.";
