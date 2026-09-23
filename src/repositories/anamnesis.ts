/**
 * Repositório: anamnese digital (modelos e respostas assinadas).
 */
import { supabase } from "@/integrations/supabase/client";

export type AnamnesisQuestionType = "text" | "yesno";

export interface AnamnesisQuestion {
  id: string;
  label: string;
  type: AnamnesisQuestionType;
  required: boolean;
}

export interface AnamnesisTemplate {
  id: string;
  tenantId: string;
  name: string;
  intro: string | null;
  questions: AnamnesisQuestion[];
  active: boolean;
}

export interface AnamnesisResponse {
  id: string;
  templateId: string;
  clientId: string;
  answers: Record<string, string>;
  signatureName: string;
  signedAt: string;
}

export async function listAnamnesisTemplates(
  tenantId: string,
  activeOnly = false,
): Promise<AnamnesisTemplate[]> {
  let query = supabase
    .from("anamnesis_templates")
    .select("id, tenant_id, name, intro, questions, active")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
    name: r.name,
    intro: r.intro,
    questions: (r.questions as unknown as AnamnesisQuestion[]) ?? [],
    active: r.active,
  }));
}

export async function saveAnamnesisTemplate(input: {
  id?: string;
  tenantId: string;
  name: string;
  intro: string | null;
  questions: AnamnesisQuestion[];
  active: boolean;
  updatedBy?: string | null;
}): Promise<void> {
  const payload = {
    tenant_id: input.tenantId,
    name: input.name,
    intro: input.intro,
    questions: input.questions as unknown as never,
    active: input.active,
    updated_at: new Date().toISOString(),
    updated_by: input.updatedBy ?? null,
  };
  if (input.id) {
    const { error } = await supabase
      .from("anamnesis_templates")
      .update(payload)
      .eq("id", input.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("anamnesis_templates").insert(payload);
  if (error) throw error;
}

export async function deleteAnamnesisTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("anamnesis_templates").delete().eq("id", id);
  if (error) throw error;
}

export async function listAnamnesisResponses(
  tenantId: string,
  clientId: string,
): Promise<AnamnesisResponse[]> {
  const { data, error } = await supabase
    .from("anamnesis_responses")
    .select("id, template_id, client_id, answers, signature_name, signed_at")
    .eq("tenant_id", tenantId)
    .eq("client_id", clientId)
    .order("signed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    templateId: r.template_id,
    clientId: r.client_id,
    answers: (r.answers as unknown as Record<string, string>) ?? {},
    signatureName: r.signature_name,
    signedAt: r.signed_at,
  }));
}

export async function submitAnamnesis(input: {
  tenantId: string;
  templateId: string;
  clientId: string;
  answers: Record<string, string>;
  signatureName: string;
  signedBy?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("anamnesis_responses").insert({
    tenant_id: input.tenantId,
    template_id: input.templateId,
    client_id: input.clientId,
    answers: input.answers as unknown as never,
    signature_name: input.signatureName,
    signed_by: input.signedBy ?? null,
  });
  if (error) throw error;
}
