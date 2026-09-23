import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

/**
 * Notificações push (Web Push / VAPID).
 *
 * Ações:
 *  - { action: "public-key" }  → devolve a chave pública VAPID (dado público)
 *  - { action: "test" }        → envia uma notificação de teste para os aparelhos
 *                                do próprio usuário autenticado
 *  - { action: "reminders" }   → varre atendimentos das próximas horas e envia
 *                                lembretes. Exige o cabeçalho x-cron-secret.
 */

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:no-reply@cativa.app";
const CRON_SECRET = Deno.env.get("PUSH_CRON_SECRET") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type PushRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

async function sendTo(
  admin: ReturnType<typeof createClient>,
  subs: PushRow[],
  payload: Record<string, unknown>,
) {
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 60 * 60 * 6 },
      );
      sent += 1;
      await admin
        .from("push_subscriptions")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", sub.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      console.error(`push falhou [${status ?? "?"}]:`, String(error));
      if (status === 404 || status === 410) {
        await admin.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }
  return sent;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = typeof body.action === "string" ? body.action : "public-key";

    if (action === "public-key") {
      return json({ publicKey: VAPID_PUBLIC_KEY });
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return json({ error: "Notificações não configuradas." }, 500);
    }
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    if (action === "test") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Não autenticado." }, 401);
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
      );
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData.user) return json({ error: "Sessão inválida." }, 401);

      const { data: subs } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .eq("user_id", userData.user.id);

      const sent = await sendTo(admin, (subs ?? []) as PushRow[], {
        title: "Cativa",
        body: "Tudo certo! As notificações estão ativas neste aparelho.",
        url: "/app",
      });
      return json({ sent });
    }

    if (action === "reminders") {
      if (!CRON_SECRET || req.headers.get("x-cron-secret") !== CRON_SECRET) {
        return json({ error: "Não autorizado." }, 401);
      }

      const now = new Date();
      const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
      const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);

      const { data: appts, error } = await admin
        .from("appointments")
        .select("id, tenant_id, client_id, starts_at, status")
        .gte("starts_at", from.toISOString())
        .lt("starts_at", to.toISOString())
        .in("status", ["pending", "confirmed", "reminded", "requested"]);

      if (error) {
        console.error("erro ao ler atendimentos:", error.message);
        return json({ error: error.message }, 500);
      }

      let sent = 0;
      for (const appt of appts ?? []) {
        const { data: already } = await admin
          .from("push_notifications_log")
          .select("id")
          .eq("appointment_id", appt.id)
          .eq("kind", "reminder_24h")
          .maybeSingle();
        if (already) continue;

        const { data: links } = await admin
          .from("client_users")
          .select("user_id")
          .eq("client_id", appt.client_id)
          .eq("tenant_id", appt.tenant_id)
          .eq("status", "active");
        const userIds = (links ?? []).map((l) => l.user_id as string);
        if (userIds.length === 0) continue;

        const { data: subs } = await admin
          .from("push_subscriptions")
          .select("id, endpoint, p256dh, auth")
          .in("user_id", userIds);
        if (!subs || subs.length === 0) continue;

        const { data: tenant } = await admin
          .from("tenants")
          .select("name")
          .eq("id", appt.tenant_id)
          .maybeSingle();

        const when = new Date(appt.starts_at as string).toLocaleString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });

        sent += await sendTo(admin, subs as PushRow[], {
          title: (tenant?.name as string) ?? "Cativa",
          body: `Seu horário é amanhã, ${when}. Toque para confirmar.`,
          url: "/portal/agenda",
        });

        await admin
          .from("push_notifications_log")
          .insert({ appointment_id: appt.id, kind: "reminder_24h" });
      }

      return json({ checked: appts?.length ?? 0, sent });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("push-dispatch falhou:", String(error));
    return json({ error: "Falha ao processar notificações." }, 500);
  }
});
