import { supabase } from "@/integrations/supabase/client";
import { parseRetentionAdvice, type RetentionAdvice } from "@/domain/retentionIntelligence";

export async function evaluateRetentionWithJev(input: {
  tenantId: string;
  clientId: string;
}): Promise<RetentionAdvice> {
  const { data, error } = await supabase.functions.invoke("retention-advisor", {
    body: input,
  });
  if (error) {
    throw new Error(error.message || "Não foi possível consultar o Jev.");
  }
  return parseRetentionAdvice(data);
}
