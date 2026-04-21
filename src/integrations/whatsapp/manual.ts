/**
 * Helper para WhatsApp manual / semiautomático.
 *
 * REGRA INEGOCIÁVEL: o Cativa nunca usa API oficial nem não oficial
 * de WhatsApp. Aqui apenas geramos texto, link wa.me e copiamos a
 * mensagem. O envio é sempre feito manualmente pelo operador.
 */

interface BuildWhatsAppLinkParams {
  phoneE164: string; // ex.: "5511999990000"
  message: string;
}

export function buildWhatsAppLink({ phoneE164, message }: BuildWhatsAppLinkParams): string {
  const phone = phoneE164.replace(/\D/g, "");
  const text = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${text}`;
}

export async function copyWhatsAppMessage(message: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
}
