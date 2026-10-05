import { supabase } from "@/integrations/supabase/client";
import { parseRetentionAdvice, type RetentionAdvice } from "@/domain/retentionIntelligence";

export async function evaluateRetentionWithJev(input: {
  tenantId: string;
  clientId: string;
}): Promise<RetentionAdvice> {
  const { data, error } = await supabase.functions.invoke("retention-advisor", {
    // Constrói explicitamente o payload mínimo para não encaminhar PII extra
    // caso um chamador passe um objeto estruturalmente compatível com campos adicionais.
    body: { tenantId: input.tenantId, clientId: input.clientId },
  });
  if (error) {
    throw new Error(error.message || "Não foi possível consultar o Jev.");
  }
  return parseRetentionAdvice(data);
}
