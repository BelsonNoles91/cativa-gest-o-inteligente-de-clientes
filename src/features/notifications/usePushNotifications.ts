/**
 * Notificações push (Web Push / VAPID).
 *
 * Fluxo: pede permissão → assina no service worker → guarda o aparelho
 * em push_subscriptions. O envio é feito pelo backend (push-dispatch).
 */
import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export type PushState =
  | "checking"
  | "unsupported"
  | "open-in-new-tab"
  | "denied"
  | "off"
  | "on";

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) view[i] = raw.charCodeAt(i);
  return buffer;
}


function isSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function usePushNotifications(tenantId?: string | null) {
  const [state, setState] = useState<PushState>("checking");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isSupported()) {
      setState("unsupported");
      return;
    }
    if (inIframe()) {
      setState("open-in-new-tab");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    } catch {
      setState("off");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    if (!isSupported()) return { ok: false, message: "Este aparelho não aceita notificações." };
    if (inIframe()) {
      return { ok: false, message: "Abra o Cativa em uma aba própria para ativar as notificações." };
    }
    setBusy(true);
    try {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return { ok: false, message: "Permissão negada nas configurações do navegador." };
      }

      const { data, error } = await supabase.functions.invoke("push-dispatch", {
        body: { action: "public-key" },
      });
      const publicKey = (data as { publicKey?: string } | null)?.publicKey;
      if (error || !publicKey) {
        return { ok: false, message: "Não foi possível preparar as notificações agora." };
      }

      const registration =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;

      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToArrayBuffer(publicKey),
        }));

      const raw = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
        return { ok: false, message: "Não foi possível registrar este aparelho." };
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return { ok: false, message: "Entre na sua conta para ativar." };

      const { error: saveError } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userData.user.id,
          tenant_id: tenantId ?? null,
          endpoint: raw.endpoint,
          p256dh: raw.keys.p256dh,
          auth: raw.keys.auth,
          user_agent: navigator.userAgent.slice(0, 300),
        },
        { onConflict: "endpoint" },
      );
      if (saveError) return { ok: false, message: "Não foi possível salvar este aparelho." };

      setState("on");
      return { ok: true, message: "Notificações ativadas neste aparelho." };
    } finally {
      setBusy(false);
    }
  }, [tenantId]);

  const disable = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const sub = await registration?.pushManager.getSubscription();
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      return { ok: true, message: "Notificações desligadas neste aparelho." };
    } finally {
      setBusy(false);
    }
  }, []);

  const sendTest = useCallback(async (): Promise<{ ok: boolean; message: string }> => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-dispatch", {
        body: { action: "test" },
      });
      const sent = (data as { sent?: number } | null)?.sent ?? 0;
      if (error || sent === 0) {
        return { ok: false, message: "Nenhum aparelho recebeu — ative as notificações primeiro." };
      }
      return { ok: true, message: "Enviamos uma notificação de teste." };
    } finally {
      setBusy(false);
    }
  }, []);

  return { state, busy, enable, disable, sendTest, refresh };
}
