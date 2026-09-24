/**
 * Helper para WhatsApp manual / semiautomático.
 *
 * REGRA INEGOCIÁVEL: o Cativa nunca usa API oficial nem não oficial
 * de WhatsApp. Aqui apenas geramos texto, link wa.me e copiamos a
 * mensagem. O envio é sempre feito manualmente pelo operador.
 */

import { buildManualWhatsAppLink } from "@/lib/whatsapp";

interface BuildWhatsAppLinkParams {
  phoneE164: string; // ex.: "5511999990000" ou "11999990000"
  message: string;
}

export function buildWhatsAppLink({ phoneE164, message }: BuildWhatsAppLinkParams): string | null {
  return buildManualWhatsAppLink(phoneE164, message);
}

export async function copyWhatsAppMessage(message: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(message);
    return true;
  } catch {
    return false;
  }
}
