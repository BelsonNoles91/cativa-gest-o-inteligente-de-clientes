import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { callJev, JevHttpError } from "../_shared/jev.ts";
import {
  buildRetentionState,
  interpretRetentionResponse,
  parseRetentionPolicy,
  RETENTION_QUESTIONS,
} from "./logic.ts";

const baseCorsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const cors = corsPolicyForRequest(req);
  const headers = { ...cors.headers, "X-Request-Id": requestId };
  if (!cors.allowed) return json({ error: "Origem não permitida." }, 403, headers);
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return json({ error: "Método não suportado." }, 405, headers);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const typesafeKey = Deno.env.get("TYPESAFE_API_KEY") ?? "";
  if (!supabaseUrl || !anonKey) {
    return json({ error: "Configuração do backend ausente." }, 500, headers);
  }
  if (!typesafeKey) {
    return json({ error: "A inteligência Jev ainda não foi configurada." }, 503, headers);
  }

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization) return json({ error: "Não autenticado." }, 401, headers);

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return json({ error: "Sessão inválida." }, 401, headers);

  const body = await req.json().catch(() => null) as { tenantId?: unknown; clientId?: unknown } | null;
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : "";
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  if (!isUuid(tenantId) || !isUuid(clientId)) {
    return json({ error: "tenantId e clientId devem ser UUIDs válidos." }, 400, headers);
  }

  const [membershipResult, profileResult] = await Promise.all([
    supabase
      .from("tenant_memberships")
      .select("id, role")
      .eq("tenant_id", tenantId)
      .eq("user_id", authData.user.id)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", authData.user.id)
      .maybeSingle(),
  ]);
  const isSuperAdmin = Boolean(profileResult.data?.is_super_admin);
  if ((membershipResult.error || !membershipResult.data) && !isSuperAdmin) {
    return json({ error: "Sem acesso ao tenant informado." }, 403, headers);
  }

  const serviceClient = serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
    : null;
  const dailyLimit = positiveInteger(Deno.env.get("RETENTION_DAILY_TENANT_LIMIT"), 200);
  if (serviceClient) {
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count, error: quotaError } = await serviceClient
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("action", "retention_advice.evaluated")
      .gte("created_at", startOfDay.toISOString());
    if (quotaError) {
      logEvent("retention_advisor.quota_check_failed", requestId, {
        tenant_id: tenantId,
        error: quotaError.message,
      });
    } else if ((count ?? 0) >= dailyLimit) {
      logEvent("retention_advisor.quota_exceeded", requestId, { tenant_id: tenantId, daily_limit: dailyLimit });
      return json({ error: "Limite diário de avaliações Jev atingido para este tenant." }, 429, headers);
    }
  }

  const now = new Date();
  const historyStart = new Date(now.getTime() - 365 * 86_400_000).toISOString();
  const futureEnd = new Date(now.getTime() + 90 * 86_400_000).toISOString();
  const contactStart = new Date(now.getTime() - 60 * 86_400_000).toISOString();

  const [clientResult, appointmentResult, packageResult, contactResult] = await Promise.all([
    supabase
      .from("clients")
      .select("is_vip, risk_level, needs_reactivation, last_visit_at, next_visit_at, average_cycle_days, churn_risk_score, phone, whatsapp_phone, email")
      .eq("tenant_id", tenantId)
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("appointments")
      .select("status, starts_at, confirmed_at")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .gte("starts_at", historyStart)
      .lte("starts_at", futureEnd)
      .order("starts_at", { ascending: false })
      .limit(300),
    supabase
      .from("client_package_balances")
      .select("status, sessions_total, sessions_used, expires_at")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .limit(100),
    supabase
      .from("contact_attempts")
      .select("attempted_at, result")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .gte("attempted_at", contactStart)
      .order("attempted_at", { ascending: false })
      .limit(100),
  ]);

  if (clientResult.error) {
    console.error("retention-advisor client query", clientResult.error.message);
    return json({ error: "Não foi possível consultar o cliente." }, 502, headers);
  }
  if (!clientResult.data) return json({ error: "Cliente não encontrado." }, 404, headers);
  const relatedError = appointmentResult.error ?? packageResult.error ?? contactResult.error;
  if (relatedError) {
    console.error("retention-advisor related query", relatedError.message);
    return json({ error: "Não foi possível reunir o histórico de retenção." }, 502, headers);
  }

  const state = buildRetentionState(
    clientResult.data,
    appointmentResult.data ?? [],
    packageResult.data ?? [],
    contactResult.data ?? [],
    now,
  );

  try {
    const response = await callJev({
      apiKey: typesafeKey,
      request: { state, questions: RETENTION_QUESTIONS, model: "jev-latest" },
    });
    const policy = parseRetentionPolicy(
      Deno.env.get("RETENTION_ACTION_CONFIDENCE_THRESHOLD"),
      Deno.env.get("RETENTION_EVIDENCE_THRESHOLD"),
    );
    const advice = interpretRetentionResponse(response, state, policy);
    const metadata = {
      outcome: advice.status,
      suggested_action: advice.action,
      confidence: advice.confidence,
      evidence_sufficiency: advice.evidenceSufficiency,
      urgency: advice.urgency,
      model: advice.model,
      input_tokens: response.usage?.input_tokens ?? null,
      output_tokens: response.usage?.output_tokens ?? null,
      latency_ms: Date.now() - startedAt,
      request_id: requestId,
      automatic_action: false,
    };
    logEvent("retention_advisor.completed", requestId, { tenant_id: tenantId, ...metadata });
    await writeAuditEvent(serviceClient, {
      tenantId,
      actorId: authData.user.id,
      clientId,
      metadata,
      requestId,
    });
    return json(advice, 200, headers);
  } catch (error) {
    const status = error instanceof JevHttpError ? error.status : 500;
    logEvent("retention_advisor.failed", requestId, {
      tenant_id: tenantId,
      status,
      latency_ms: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    if (status === 429 || status === 529) {
      return json({ error: "O Jev está ocupado. Tente novamente em instantes." }, 503, headers);
    }
    if (status === 401 || status === 403) {
      return json({ error: "A credencial do Jev precisa ser revisada." }, 503, headers);
    }
    return json({ error: "Não foi possível avaliar a retenção agora." }, 502, headers);
  }
});

function corsPolicyForRequest(req: Request): { allowed: boolean; headers: Record<string, string> } {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("SITE_URL") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const isAllowed = allowed.length === 0 || !origin || allowed.includes(origin);
  const allowOrigin = allowed.length === 0 ? "*" : origin && allowed.includes(origin) ? origin : "";
  return {
    allowed: isAllowed,
    headers: {
      ...baseCorsHeaders,
      ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
      Vary: "Origin",
    },
  };
}

function json(payload: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function logEvent(event: string, requestId: string, fields: Record<string, unknown>) {
  console.info(JSON.stringify({ event, request_id: requestId, ...fields }));
}

async function writeAuditEvent(
  serviceClient: ReturnType<typeof createClient> | null,
  event: {
    tenantId: string;
    actorId: string;
    clientId: string;
    metadata: Record<string, unknown>;
    requestId: string;
  },
) {
  if (!serviceClient) {
    logEvent("retention_advisor.audit_skipped", event.requestId, { reason: "service_role_unavailable" });
    return;
  }
  const { error } = await serviceClient.from("audit_logs").insert({
    tenant_id: event.tenantId,
    actor_id: event.actorId,
    action: "retention_advice.evaluated",
    entity: "client",
    entity_id: event.clientId,
    metadata: event.metadata,
  });
  if (error) {
    logEvent("retention_advisor.audit_failed", event.requestId, { error: error.message });
  }
}
