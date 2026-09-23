import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Método não suportado." }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return json({ error: "Sessão inválida." }, 401);

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const appointmentId = typeof body.appointmentId === "string" ? body.appointmentId : "";
    const rawNotes = typeof body.notes === "string" ? body.notes.slice(0, 6000).trim() : "";

    if (!UUID_RE.test(appointmentId)) {
      return json({ error: "Atendimento inválido." }, 400);
    }
    if (rawNotes.length < 10) {
      return json({ error: "Escreva as anotações do atendimento antes de gerar o resumo." }, 400);
    }

    // RLS garante que apenas membros do tenant enxergam o atendimento.
    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, starts_at, ends_at, status, duration_minutes, notes")
      .eq("id", appointmentId)
      .maybeSingle();

    if (appointmentError || !appointment) {
      return json({ error: "Sem acesso a este atendimento." }, 403);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Chave da IA não configurada." }, 500);

    const serviceName = typeof body.serviceName === "string" ? body.serviceName.slice(0, 200) : "";
    const clientName = typeof body.clientName === "string" ? body.clientName.slice(0, 200) : "";
    const professionalName = typeof body.professionalName === "string" ? body.professionalName.slice(0, 200) : "";

    const prompt = [
      "Você é apoio administrativo de uma clínica de estética/salão e organiza anotações livres da recepção em um resumo padronizado de atendimento.",
      "Responda SEMPRE em português do Brasil, em Markdown enxuto, com exatamente estas seções e nesta ordem:",
      "## Resumo do atendimento",
      "## Procedimentos realizados",
      "## Recomendações ao cliente",
      "## Próximos passos",
      "Regras: use listas curtas; não invente procedimentos, valores, datas ou diagnósticos que não estejam nas anotações;",
      "quando faltar informação, escreva 'Não informado'; não dê orientação médica; mantenha tom profissional e objetivo.",
      "",
      "Dados do atendimento:",
      `- Serviço: ${serviceName || "Não informado"}`,
      `- Cliente: ${clientName || "Não informado"}`,
      `- Profissional: ${professionalName || "Não informado"}`,
      `- Início: ${appointment.starts_at}`,
      `- Duração (min): ${appointment.duration_minutes}`,
      appointment.notes ? `- Observação do cliente: ${appointment.notes}` : "",
      "",
      `Anotações livres da recepção:\n${rawNotes}`,
    ].filter(Boolean).join("\n");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        input: prompt,
        stream: true,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        store: false,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      if (upstream.status === 429) {
        return json({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }, 429);
      }
      if (upstream.status === 402) {
        return json({ error: "Créditos de IA insuficientes no workspace." }, 402);
      }
      console.error("AI gateway error", upstream.status, detail.slice(0, 500));
      return json({ error: "Não foi possível gerar o resumo agora." }, 502);
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("appointment-summary", error);
    return json({ error: "Erro inesperado ao gerar o resumo." }, 500);
  }
});

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
