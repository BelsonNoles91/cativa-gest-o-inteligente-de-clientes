/**
 * Log seguro de diagnóstico de inicialização do backend.
 *
 * NUNCA loga valores de chaves ou URLs completas — apenas presença
 * (booleana), o host (sem query/token) e o modo do bundle (DEV/PROD).
 * Serve para diagnosticar por que o cliente Supabase falhou ao iniciar
 * (ex.: variáveis ausentes no build publicado).
 */

type EnvSnapshot = {
  mode: string;
  isDev: boolean;
  hasUrl: boolean;
  hasPublishableKey: boolean;
  hasAnonKey: boolean;
  urlHost: string | null;
  projectRefPresent: boolean;
};

function safeHost(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

function snapshot(): EnvSnapshot {
  const env = import.meta.env;
  return {
    mode: env.MODE ?? "unknown",
    isDev: Boolean(env.DEV),
    hasUrl: Boolean(env.VITE_SUPABASE_URL),
    hasPublishableKey: Boolean(env.VITE_SUPABASE_PUBLISHABLE_KEY),
    hasAnonKey: Boolean(env.VITE_SUPABASE_ANON_KEY),
    urlHost: safeHost(env.VITE_SUPABASE_URL),
    projectRefPresent: Boolean(env.VITE_SUPABASE_PROJECT_ID),
  };
}

/**
 * Executa a checagem no boot. Se algo obrigatório estiver ausente,
 * imprime um bloco de diagnóstico em `console.error`. Caso contrário,
 * um `console.info` discreto confirma o ambiente.
 * Nada aqui inclui chaves, tokens ou o valor bruto da URL.
 */
export function logBackendInitDiagnostics(): void {
  const snap = snapshot();
  const missing: string[] = [];
  if (!snap.hasUrl) missing.push("VITE_SUPABASE_URL");
  if (!snap.hasPublishableKey && !snap.hasAnonKey) {
    missing.push("VITE_SUPABASE_PUBLISHABLE_KEY|VITE_SUPABASE_ANON_KEY");
  }

  if (missing.length > 0) {
    // Runtime: bundle publicado sem variáveis → cliente inicializará quebrado.
    // eslint-disable-next-line no-console
    console.error("[backend-init] falha de inicialização — variáveis ausentes", {
      mode: snap.mode,
      isDev: snap.isDev,
      missing,
      // presença apenas — nunca o valor
      hasUrl: snap.hasUrl,
      hasPublishableKey: snap.hasPublishableKey,
      hasAnonKey: snap.hasAnonKey,
      urlHost: snap.urlHost,
      projectRefPresent: snap.projectRefPresent,
      hint:
        "Rebuild com .env populado (Lovable Cloud / provedor). Não é possível corrigir em runtime.",
    });
    return;
  }

  // eslint-disable-next-line no-console
  console.info("[backend-init] ok", {
    mode: snap.mode,
    isDev: snap.isDev,
    urlHost: snap.urlHost,
    projectRefPresent: snap.projectRefPresent,
  });
}

/**
 * Assinatura leve para instalar um listener de `unhandledrejection`
 * que reimprime o diagnóstico se aparecer o erro clássico do supabase-js
 * (`supabaseUrl is required.`), tornando trivial correlacionar causa e efeito.
 */
export function installBackendInitErrorListener(): void {
  if (typeof window === "undefined") return;
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      (reason && (reason.message || String(reason))) || "";
    if (typeof message === "string" && /supabaseUrl is required/i.test(message)) {
      // eslint-disable-next-line no-console
      console.error(
        "[backend-init] erro capturado: supabaseUrl is required — redefinindo diagnóstico",
      );
      logBackendInitDiagnostics();
    }
  });
}
