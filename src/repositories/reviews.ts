/**
 * Repositório: avaliação pós-atendimento (link do Google Meu Negócio).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ReviewSettings {
  enabled: boolean;
  googleReviewUrl: string | null;
  messageTemplate: string | null;
}

export const defaultReviewSettings: ReviewSettings = {
  enabled: false,
  googleReviewUrl: null,
  messageTemplate:
    "Oi {cliente}! Obrigado por vir ao {negocio}. Se puder, deixe sua avaliação aqui: {link}",
};

export async function fetchReviewSettings(tenantId: string): Promise<ReviewSettings> {
  const { data, error } = await supabase
    .from("review_settings")
    .select("enabled, google_review_url, message_template")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { ...defaultReviewSettings };
  return {
    enabled: data.enabled,
    googleReviewUrl: data.google_review_url,
    messageTemplate: data.message_template ?? defaultReviewSettings.messageTemplate,
  };
}

export async function saveReviewSettings(
  tenantId: string,
  s: ReviewSettings,
  updatedBy?: string | null,
): Promise<void> {
  const { error } = await supabase.from("review_settings").upsert(
    {
      tenant_id: tenantId,
      enabled: s.enabled,
      google_review_url: s.googleReviewUrl,
      message_template: s.messageTemplate,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    },
    { onConflict: "tenant_id" },
  );
  if (error) throw error;
}

export async function listReviewRequests(tenantId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("review_requests")
    .select("appointment_id")
    .eq("tenant_id", tenantId);
  if (error) throw error;
  return (data ?? []).map((r) => r.appointment_id).filter((v): v is string => Boolean(v));
}

export async function markReviewRequested(input: {
  tenantId: string;
  clientId: string;
  appointmentId: string;
  sentBy?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("review_requests").upsert(
    {
      tenant_id: input.tenantId,
      client_id: input.clientId,
      appointment_id: input.appointmentId,
      sent_at: new Date().toISOString(),
      sent_by: input.sentBy ?? null,
    },
    { onConflict: "tenant_id,appointment_id" },
  );
  if (error) throw error;
}

export function reviewMessage(
  template: string,
  vars: { clientName: string; businessName: string; link: string },
): string {
  return template
    .replace(/\{cliente\}/g, vars.clientName)
    .replace(/\{negocio\}/g, vars.businessName)
    .replace(/\{link\}/g, vars.link);
}
