/**
 * Utilitários puros para o fluxo manual/semiassistido de WhatsApp.
 * Nenhuma função envia mensagens: apenas valida número e monta link wa.me.
 */

/**
 * Normaliza um celular/telefone brasileiro para o formato aceito pelo wa.me.
 * Aceita DDD + número (10/11 dígitos) ou o mesmo valor já prefixado com 55.
 */
export function normalizeBrazilWhatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (trimmed.startsWith("+") && !trimmed.startsWith("+55")) return null;
  const digits = trimmed.replace(/\D/g, "");

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits;
  }

  return null;
}

export function buildManualWhatsAppLink(
  phone: string | null | undefined,
  message?: string | null,
): string | null {
  const normalized = normalizeBrazilWhatsappNumber(phone);
  if (!normalized) return null;

  const base = `https://wa.me/${normalized}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
