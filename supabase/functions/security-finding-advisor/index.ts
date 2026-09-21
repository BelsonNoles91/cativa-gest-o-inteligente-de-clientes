import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Não autenticado." }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return json({ error: "Sessão inválida." }, 401);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.is_super_admin) {
      return json({ error: "Acesso restrito a super administradores." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const finding = typeof body.finding === "string" ? body.finding.slice(0, 4000) : "";
    const context = typeof body.context === "string" ? body.context.slice(0, 6000) : "";
    if (!finding.trim()) {
      return json({ error: "Descreva o achado de segurança." }, 400);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return json({ error: "Chave da IA não configurada." }, 500);
    }

    const prompt = [
      "Você é um especialista em segurança de aplicações SaaS multi-tenant sobre Postgres/Supabase (RLS, GRANTs, funções SECURITY DEFINER, storage, edge functions).",
      "Responda SEMPRE em português do Brasil, em Markdown, com as seções:",
      "## Risco (o que pode acontecer na prática)",
      "## Impacto e severidade",
      "## Remediação priorizada (lista numerada, da ação mais urgente para a menos urgente, com SQL quando fizer sentido)",
      "## Como validar a correção",
      "Seja objetivo e evite genéricos. Se faltar contexto, diga exatamente o que precisa ser verificado.",
      "",
      `Achado de segurança:\n${finding}`,
      context ? `\nContexto adicional fornecido pelo administrador:\n${context}` : "",
    ].join("\n");

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
      return json({ error: "Não foi possível gerar a análise agora." }, 502);
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
    console.error("security-finding-advisor", error);
    return json({ error: "Erro inesperado ao analisar o achado." }, 500);
  }
});

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
