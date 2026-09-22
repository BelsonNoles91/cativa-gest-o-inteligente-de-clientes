/**
 * Helpers de resiliência para testes E2E.
 *
 * Centraliza padrões de retry, timeout, polling e logging para que cada spec
 * use o mesmo manejo de erros. Falhas devem ser:
 *  - **Atribuíveis** — mensagem identifica qual etapa falhou.
 *  - **Não-silenciosas** — nunca engolir exceção sem logar.
 *  - **Recuperáveis quando seguro** — retry para flakiness de rede/animação.
 *  - **Determinísticas** — timeouts explícitos em vez de sleep arbitrário.
 */
import type { Page, BrowserContext } from "@playwright/test";

/** Tag padrão de log para facilitar `grep` em CI. */
const TAG = "[e2e]";

export function logStep(scenario: string, step: string, extra?: unknown) {
   
  console.log(
    `${TAG} ${scenario} :: ${step}${extra !== undefined ? " " + JSON.stringify(extra) : ""}`,
  );
}

export function logWarn(scenario: string, msg: string, err?: unknown) {
   
  console.warn(
    `${TAG} WARN ${scenario} :: ${msg}` +
      (err instanceof Error ? ` :: ${err.message}` : ""),
  );
}

/**
 * Executa `fn` com retry exponencial. Use para operações idempotentes que
 * podem falhar por flakiness (animação não terminou, rede lenta, hidratação).
 *
 * - `retries` total de tentativas (inclui a primeira).
 * - `baseDelayMs` delay inicial; dobra a cada tentativa.
 * - `label` aparece em logs para rastreabilidade.
 */
export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 250;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = baseDelay * 2 ** (attempt - 1);
      logWarn(
        "retry",
        `${label} falhou (tentativa ${attempt}/${retries}), aguardando ${delay}ms`,
        err,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  // Re-throw com contexto para a stack trace ficar útil.
  const original = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`[${label}] falhou após ${retries} tentativas: ${original}`);
}

/**
 * Polling determinístico — substitui `page.waitForTimeout(N)` cego.
 * Resolve assim que `predicate` retorna truthy ou rejeita após `timeout`.
 */
export async function waitFor<T>(
  label: string,
  predicate: () => Promise<T | null | undefined | false>,
  opts: { timeoutMs?: number; pollMs?: number } = {},
): Promise<T> {
  const timeout = opts.timeoutMs ?? 5000;
  const poll = opts.pollMs ?? 100;
  const started = Date.now();
  let lastErr: unknown;
  while (Date.now() - started < timeout) {
    try {
      const v = await predicate();
      if (v) return v;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, poll));
  }
  const detail = lastErr instanceof Error ? ` (último erro: ${lastErr.message})` : "";
  throw new Error(
    `[${label}] timeout de ${timeout}ms aguardando condição${detail}`,
  );
}

/**
 * Garante navegação resiliente: tenta clicar em um link/botão; se não estiver
 * acessível por qualquer razão (não renderizado, fora do viewport, animação
 * em curso), faz fallback para `page.goto(fallbackUrl)`. Sempre valida que
 * a URL final bate com `expectedUrlRegex` dentro de `timeoutMs`.
 */
export async function navigateOrFallback(
  page: Page,
  opts: {
    label: string;
    clickSelector: string;
    fallbackUrl: string;
    expectedUrlRegex: RegExp;
    timeoutMs?: number;
  },
): Promise<void> {
  const timeout = opts.timeoutMs ?? 15_000;
  const link = page.locator(opts.clickSelector).first();
  let usedFallback = false;
  try {
    if ((await link.count()) > 0 && (await link.isVisible({ timeout: 1000 }))) {
      await link.click({ timeout: 3000 });
    } else {
      throw new Error("link não disponível");
    }
  } catch (err) {
    logWarn(opts.label, `click falhou, usando fallback ${opts.fallbackUrl}`, err);
    usedFallback = true;
    await page.goto(opts.fallbackUrl, { timeout, waitUntil: "domcontentloaded" });
  }

  try {
    await page.waitForURL(opts.expectedUrlRegex, { timeout });
  } catch (err) {
    if (!usedFallback) {
      logWarn(opts.label, "waitForURL após click falhou, tentando fallback", err);
      await page.goto(opts.fallbackUrl, { timeout, waitUntil: "domcontentloaded" });
      await page.waitForURL(opts.expectedUrlRegex, { timeout });
    } else {
      throw err;
    }
  }
}

/**
 * Cleanup obrigatório de estado de rede. Use em `afterEach` para garantir
 * que offline state vazado de um teste não contamine o próximo.
 */
export async function ensureOnline(context: BrowserContext): Promise<void> {
  try {
    await context.setOffline(false);
  } catch (err) {
    logWarn("cleanup", "ensureOnline falhou (contexto pode ter fechado)", err);
  }
}

/** Snapshot de informação útil para diagnóstico em falhas. */
export async function captureDebugInfo(
  page: Page,
  label: string,
): Promise<Record<string, unknown>> {
  try {
    const url = page.url();
    const viewport = page.viewportSize();
    const title = await page.title().catch(() => "(sem título)");
    const online = await page
      .evaluate(() => navigator.onLine)
      .catch(() => null);
    return { label, url, viewport, title, online };
  } catch (err) {
    return {
      label,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
