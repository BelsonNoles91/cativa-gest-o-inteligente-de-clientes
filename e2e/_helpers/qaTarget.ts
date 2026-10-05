/**
 * Returns a visible skip reason unless destructive browser tests are explicitly
 * pointed at an HTTPS Supabase QA project that is both declared and allowlisted.
 * This mirrors scripts/e2e-target-check.mjs before the browser can submit data.
 */
export function getDestructiveE2ESkipReason(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  const qaRef = env.E2E_QA_PROJECT_REF?.trim();
  if (!qaRef) return "E2E_QA_PROJECT_REF ausente; testes com escrita exigem um alvo QA explícito.";

  const allowlist = (env.E2E_TARGET_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (allowlist.length === 0) {
    return "E2E_TARGET_ALLOWLIST ausente; testes com escrita permanecem bloqueados.";
  }

  if (env.E2E_LOCAL_SUPABASE === "true") {
    if (qaRef !== "local" || allowlist.length !== 1 || allowlist[0] !== "local") {
      return "Supabase local exige E2E_QA_PROJECT_REF=local e allowlist exclusivamente local.";
    }

    const localUrl = env.VITE_SUPABASE_URL?.trim();
    if (!localUrl) return "VITE_SUPABASE_URL ausente; não foi possível verificar o alvo local.";

    try {
      const parsed = new URL(localUrl);
      const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
      if (
        parsed.protocol !== "http:" ||
        !loopbackHosts.has(parsed.hostname.replace(/^\[|\]$/g, "")) ||
        parsed.username ||
        parsed.password
      ) {
        return "E2E_LOCAL_SUPABASE só aceita HTTP em localhost/loopback, sem credenciais na URL.";
      }
      return undefined;
    } catch {
      return "VITE_SUPABASE_URL local inválida.";
    }
  }

  if (!allowlist.includes(qaRef)) {
    return "O alvo QA não está presente na E2E_TARGET_ALLOWLIST.";
  }
  const protectedProjectRefs = new Set([
    "uqskxftzmjsumykpkwus",
    "pegvtrvqdvzxysndddts",
    ...(env.E2E_PROTECTED_PROJECT_REFS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ]);
  if (protectedProjectRefs.has(qaRef)) {
    return "O alvo declarado está protegido e não pode receber testes com escrita.";
  }

  const rawUrl = env.VITE_SUPABASE_URL?.trim();
  if (!rawUrl) return "VITE_SUPABASE_URL ausente; não foi possível verificar o alvo.";

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return "VITE_SUPABASE_URL inválida; não foi possível verificar o alvo.";
  }
  if (url.protocol !== "https:") {
    return "Testes remotos com escrita exigem HTTPS.";
  }

  const match = url.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
  if (!match) return "VITE_SUPABASE_URL não aponta diretamente para um projeto Supabase.";
  if (match[1] !== qaRef) {
    return "VITE_SUPABASE_URL não corresponde ao E2E_QA_PROJECT_REF declarado.";
  }

  return undefined;
}

export function getE2ECredentialsSkipReason(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  if (!env.E2E_USER?.trim() || !env.E2E_PASS?.trim()) {
    return "E2E_USER/E2E_PASS ausentes; não serão usadas credenciais fictícias.";
  }
  return undefined;
}
