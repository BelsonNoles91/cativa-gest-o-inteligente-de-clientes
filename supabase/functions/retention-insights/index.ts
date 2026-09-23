// Insights de retenção e recorrência para gestores.
// Agrega dados reais de atendimentos, agendamentos e clientes do tenant
// (sempre sob RLS, com o JWT do usuário) e pede ao modelo um plano de ação.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const WINDOW_DAYS = 180;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não suportado." }, 405);

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
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "";
    const context = typeof body.context === "string" ? body.context.slice(0, 4000).trim() : "";
    const goal = typeof body.goal === "string" ? body.goal.slice(0, 300).trim() : "";

    if (!UUID_RE.test(tenantId)) return json({ error: "Estabelecimento inválido." }, 400);

    // Autorização: apenas gestão do próprio tenant (ou super admin).
    const [{ data: isManager }, { data: isSuper }] = await Promise.all([
      supabase.rpc("has_any_tenant_role", {
        _user_id: userId,
        _tenant_id: tenantId,
        _roles: ["owner", "manager"],
      }),
      supabase.rpc("is_super_admin", { _user_id: userId }),
    ]);
    if (!isManager && !isSuper) {
      return json({ error: "Seu perfil não tem acesso aos insights deste estabelecimento." }, 403);
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Chave da IA não configurada." }, 500);

    const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();

    const [apptRes, clientRes, serviceRes] = await Promise.all([
      supabase
        .from("appointments")
        .select("id, client_id, professional_id, status, source, starts_at, duration_minutes")
        .eq("tenant_id", tenantId)
        .gte("starts_at", since)
        .order("starts_at", { ascending: true })
        .limit(5000),
      supabase
        .from("clients")
        .select("id, created_at, status")
        .eq("tenant_id", tenantId)
        .limit(5000),
      supabase.from("services").select("id, name, duration_minutes").eq("tenant_id", tenantId).limit(500),
    ]);

    if (apptRes.error) return json({ error: "Não foi possível ler os atendimentos." }, 403);

    const appts = apptRes.data ?? [];
    const clients = clientRes.data ?? [];
    const services = serviceRes.data ?? [];

    const byStatus: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const perClient = new Map<string, string[]>();

    for (const a of appts) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      bySource[a.source] = (bySource[a.source] ?? 0) + 1;
      const month = String(a.starts_at).slice(0, 7);
      byMonth[month] = (byMonth[month] ?? 0) + 1;
      if (a.client_id) {
        const list = perClient.get(a.client_id) ?? [];
        list.push(String(a.starts_at));
        perClient.set(a.client_id, list);
      }
    }

    const attended = new Set(
      appts.filter((a) => ["completed", "arrived", "in_service"].includes(a.status)).map((a) => a.client_id),
    );
    const returning = [...perClient.values()].filter((v) => v.length > 1).length;
    const oneTime = [...perClient.values()].filter((v) => v.length === 1).length;

    // Intervalo médio entre visitas (dias) dos clientes recorrentes.
    let gapSum = 0;
    let gapCount = 0;
    for (const dates of perClient.values()) {
      if (dates.length < 2) continue;
      const sorted = dates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
      for (let i = 1; i < sorted.length; i++) {
        gapSum += (sorted[i] - sorted[i - 1]) / 86_400_000;
        gapCount++;
      }
    }
    const avgGap = gapCount ? Math.round(gapSum / gapCount) : null;

    const now = Date.now();
    let dormant = 0;
    for (const dates of perClient.values()) {
      const last = Math.max(...dates.map((d) => new Date(d).getTime()));
      if (last < now - 60 * 86_400_000) dormant++;
    }

    const total = appts.length;
    const noShow = byStatus["no_show"] ?? 0;
    const canceled = byStatus["canceled"] ?? 0;

    const summary = [
      `Janela analisada: últimos ${WINDOW_DAYS} dias.`,
      `Total de agendamentos: ${total}.`,
      `Por status: ${fmtMap(byStatus)}.`,
      `Por origem: ${fmtMap(bySource)}.`,
      `Volume por mês: ${fmtMap(byMonth)}.`,
      `Clientes cadastrados: ${clients.length} (ativos: ${clients.filter((c) => c.status === "active").length}).`,
      `Clientes atendidos na janela: ${attended.size}.`,
      `Clientes com mais de uma visita: ${returning}. Com visita única: ${oneTime}.`,
      `Clientes sem retorno há mais de 60 dias: ${dormant}.`,
      `Intervalo médio entre visitas: ${avgGap === null ? "sem dados" : `${avgGap} dias`}.`,
      `Taxa de faltas: ${total ? ((noShow / total) * 100).toFixed(1) : "0"}% · cancelamentos: ${
        total ? ((canceled / total) * 100).toFixed(1) : "0"
      }%.`,
      `Catálogo: ${services.length} serviços${
        services.length ? ` (ex.: ${services.slice(0, 8).map((s) => s.name).join(", ")})` : ""
      }.`,
    ].join("\n");

    const prompt = [
      "Você é consultor de retenção de clientes para clínicas de estética, salões e barbearias no Brasil.",
      "Analise os dados agregados e o contexto do gestor e produza um plano prático de retenção e recorrência.",
      "Responda SEMPRE em português do Brasil, em Markdown enxuto, com exatamente estas seções e nesta ordem:",
      "## Leitura dos números",
      "## Riscos de retenção",
      "## Oportunidades de recorrência",
      "## Plano de ação priorizado (próximos 30 dias)",
      "## Indicadores para acompanhar",
      "Regras: baseie-se somente nos dados e no contexto informados; não invente números;",
      "quando faltar dado, diga o que precisa ser medido; ações devem ser específicas, com público-alvo e mensagem sugerida;",
      "lembre que o envio de WhatsApp é manual (mensagem pronta para copiar), nunca automático.",
      "",
      "Dados agregados do estabelecimento:",
      summary,
      "",
      goal ? `Meta declarada pelo gestor: ${goal}` : "",
      context ? `Contexto e observações do gestor:\n${context}` : "Sem contexto adicional do gestor.",
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
      if (upstream.status === 403) {
        return json({ error: "Acesso ao modelo de IA negado para este workspace." }, 403);
      }
      console.error("AI gateway error", upstream.status, detail.slice(0, 500));
      return json({ error: "Não foi possível gerar os insights agora." }, 502);
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Cativa-Appointments": String(total),
      },
    });
  } catch (error) {
    console.error("retention-insights", error);
    return json({ error: "Erro inesperado ao gerar os insights." }, 500);
  }
});

function fmtMap(map: Record<string, number>): string {
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  return entries.length ? entries.map(([k, v]) => `${k}=${v}`).join(", ") : "sem registros";
}

function json(payload: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
