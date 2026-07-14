import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type BackendHealthStatus = "checking" | "healthy" | "degraded";

export interface BackendHealthState {
  status: BackendHealthStatus;
  lastCheckedAt: number | null;
  error: string | null;
  recheck: () => void;
}

const HEALTH_CHECK_TIMEOUT_MS = 6000;
// Recheca periodicamente enquanto degradado (a cada 30s) para recuperar sozinho.
const DEGRADED_RETRY_MS = 30_000;

async function pingBackend(): Promise<{ ok: boolean; error?: string }> {
  try {
    // getSession é leve, não requer tabelas e valida se o cliente foi
    // inicializado corretamente + se o endpoint de auth responde.
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("backend health timeout")),
          HEALTH_CHECK_TIMEOUT_MS,
        ),
      ),
    ]);

    if (result.error) {
      return { ok: false, error: result.error.message ?? "auth error" };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Faz um health check contra o backend Supabase no carregamento e
 * expõe o status para a UI mostrar um banner de "serviço degradado".
 *
 * - checking: primeira tentativa em andamento (não mostra banner).
 * - healthy:  conexão OK.
 * - degraded: falhou (timeout, offline, credenciais ausentes, endpoint fora).
 *
 * Enquanto degradado, tenta novamente a cada 30s e também ao voltar online.
 */
export function useBackendHealth(): BackendHealthState {
  const [status, setStatus] = useState<BackendHealthStatus>("checking");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { ok, error: err } = await pingBackend();
      if (cancelled) return;
      setLastCheckedAt(Date.now());
      if (ok) {
        setStatus("healthy");
        setError(null);
      } else {
        setStatus("degraded");
        setError(err ?? "unknown");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // Retry automático enquanto degradado.
  useEffect(() => {
    if (status !== "degraded") return;
    const id = window.setInterval(() => setNonce((n) => n + 1), DEGRADED_RETRY_MS);
    return () => window.clearInterval(id);
  }, [status]);

  // Retry ao voltar online.
  useEffect(() => {
    const onOnline = () => setNonce((n) => n + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  return {
    status,
    lastCheckedAt,
    error,
    recheck: () => setNonce((n) => n + 1),
  };
}
