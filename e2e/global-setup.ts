/**
 * Playwright global setup — login real via UI, com endurecimento de resiliência.
 *
 * Garante:
 *  - Carregamento robusto de .env.local / .env (sem dep de require em ESM).
 *  - Retry de login com backoff (rede lenta, hidratação atrasada).
 *  - Selectors específicos para evitar colisão com "confirmar senha".
 *  - Validação pós-login: storageState NÃO pode estar vazio se credenciais
 *    foram fornecidas (fail-fast em vez de gerar baseline corrompida).
 *  - Cleanup garantido do browser mesmo se filesystem falhar.
 *  - Logs estruturados [playwright] em cada etapa para rastreabilidade.
 *
 * Pré-requisitos:
 *  - Usuário seed no Supabase apontado por VITE_SUPABASE_URL.
 *  - Esse usuário deve ter pelo menos 1 tenant_membership ativo.
 *  - .env.local com:
 *      E2E_USER=visual-test@cativa.local
 *      E2E_PASS=<senha>
 *
 * Sem credenciais → grava storage vazio com aviso (specs públicos seguem).
 */
import { chromium, type FullConfig, type Browser } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

const TAG = "[playwright:setup]";

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`${TAG} ${msg}`);
}

function warn(msg: string, err?: unknown) {
  // eslint-disable-next-line no-console
  console.warn(
    `${TAG} WARN ${msg}` +
      (err instanceof Error ? ` :: ${err.message}` : ""),
  );
}

async function waitForBaseUrlReady(baseURL: string, timeoutMs = 60_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2_000);
    try {
      const response = await fetch(`${baseURL}/auth/login`, {
        method: "GET",
        signal: controller.signal,
      });
      if (response.ok) {
        log(`baseURL pronta para login: ${baseURL}`);
        return;
      }
    } catch {
      // ainda não está pronto
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1000));
  }
  throw new Error(`baseURL não ficou pronta em ${timeoutMs}ms: ${baseURL}`);
}

/** Carrega arquivo .env de forma defensiva (sem dep de runtime). */
function loadEnvFile(file: string): boolean {
  try {
    if (!existsSync(file)) return false;
    const content = readFileSync(file, "utf8");
    const lines = content.split(/\r?\n/);
    let count = 0;
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if (!k) continue;
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) {
        process.env[k] = v;
        count++;
      }
    }
    log(`carregadas ${count} vars de ${file}`);
    return true;
  } catch (err) {
    warn(`falha ao ler ${file}`, err);
    return false;
  }
}

/** Tenta login até `maxAttempts` vezes com backoff. */
async function attemptLogin(
  browser: Browser,
  baseURL: string,
  email: string,
  password: string,
  maxAttempts: number,
): Promise<{ ok: true; storageStatePath: string } | { ok: false; reason: string }> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log(`tentativa de login ${attempt}/${maxAttempts}`);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      // Timeout explícito no goto — rede lenta não trava 30s.
      await page.goto(`${baseURL}/auth/login`, {
        waitUntil: "commit",
        timeout: 15_000,
      });
      await page.waitForLoadState("domcontentloaded", {
        timeout: 30_000,
      }).catch(() => {});

      // Aguarda formulário renderizar antes de preencher (hidratação React).
      await page.waitForSelector('input[type="email"], input[name*="mail" i]', {
        timeout: 10_000,
      });

      // Selectors específicos para email/senha — evita colisão com
      // "confirmar senha" se ele existir na mesma página.
      const emailInput = page
        .locator('input[type="email"], input[name*="mail" i]')
        .first();
      const passwordInput = page
        .locator('input[type="password"]')
        .first();

      await emailInput.fill(email);
      await passwordInput.fill(password);

      // Botão principal — preferimos role/name; fallback para submit.
      const submitBtn = page
        .getByRole("button", { name: /^(entrar|acessar|login|sign\s*in)$/i })
        .first();
      if (await submitBtn.count()) {
        await submitBtn.click();
      } else {
        await page.locator('button[type="submit"]').first().click();
      }

      // Espera redirect para /app (sucesso) OU /onboarding (sucesso parcial).
      // Erros de credencial → permanece em /auth/login com toast → timeout aqui.
      await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });

      const storagePath = resolve(
        process.cwd(),
        "e2e/.auth/storageState.json",
      );
      await ctx.storageState({ path: storagePath });

      // Validação: storage NÃO pode estar vazio (cookies ou origins).
      const stored = JSON.parse(readFileSync(storagePath, "utf8"));
      const hasAuth =
        (Array.isArray(stored.cookies) && stored.cookies.length > 0) ||
        (Array.isArray(stored.origins) &&
          stored.origins.some(
            (o: { localStorage?: unknown[] }) =>
              Array.isArray(o.localStorage) && o.localStorage.length > 0,
          ));
      if (!hasAuth) {
        throw new Error(
          "storageState gerado está vazio — login pode ter falhado silenciosamente.",
        );
      }

      log(`login OK na tentativa ${attempt}, storageState salvo`);
      await ctx.close();
      return { ok: true, storageStatePath: storagePath };
    } catch (err) {
      lastErr = err;
      warn(`tentativa ${attempt} falhou`, err);
      // Tenta capturar URL atual para diagnóstico.
      try {
        const url = page.url();
        warn(`  URL no momento da falha: ${url}`);
      } catch {
        /* page pode ter fechado */
      }
      await ctx.close().catch(() => {});
      if (attempt < maxAttempts) {
        const delay = 1000 * attempt;
        log(`aguardando ${delay}ms antes de retry`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
  return { ok: false, reason };
}

function tokenStorageKey(projectId: string | undefined, supabaseUrl: string | undefined) {
  if (projectId) return `sb-${projectId}-auth-token`;
  if (supabaseUrl) {
    try {
      const host = new URL(supabaseUrl).hostname;
      const ref = host.split(".")[0];
      return `sb-${ref}-auth-token`;
    } catch {
      // noop
    }
  }
  return "sb-project-auth-token";
}

async function attemptDirectAuthLogin(
  baseURL: string,
  email: string,
  password: string,
  storagePath: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const projectId = process.env.VITE_SUPABASE_PROJECT_ID;

  if (!supabaseUrl || !publishableKey) {
    return { ok: false, reason: "VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY ausentes" };
  }

  try {
    const supabase = createClient(supabaseUrl, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return { ok: false, reason: error?.message ?? "sessão não retornada" };
    }

    const sessionPayload = JSON.stringify({
      ...data.session,
      user: data.user ?? data.session.user,
      weak_password: null,
    });

    writeFileSync(
      storagePath,
      JSON.stringify(
        {
          cookies: [],
          origins: [
            {
              origin: new URL(baseURL).origin,
              localStorage: [
                {
                  name: tokenStorageKey(projectId, supabaseUrl),
                  value: sessionPayload,
                },
              ],
            },
          ],
        },
        null,
        2,
      ),
    );

    log("login direto via Supabase OK, storageState salvo");
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export default async function globalSetup(config: FullConfig) {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.E2E_BASE_URL ??
    "http://127.0.0.1:8080";

  const storagePath = resolve(process.cwd(), "e2e/.auth/storageState.json");
  const dir = dirname(storagePath);
  try {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  } catch (err) {
    warn(`não consegui criar diretório ${dir}`, err);
    throw err; // Sem dir não dá para escrever — falha imediata é melhor.
  }

  const email = process.env.E2E_USER;
  const password = process.env.E2E_PASS;

  if (!email || !password) {
    try {
      writeFileSync(
        storagePath,
        JSON.stringify({ cookies: [], origins: [] }, null, 2),
      );
    } catch (err) {
      warn("não consegui gravar storageState vazio", err);
    }
    warn(
      "E2E_USER/E2E_PASS ausentes — storageState vazio gravado.\n" +
        "             Specs autenticados (rotas /app) serão pulados/falharão.",
    );
    return;
  }

  let browser: Browser | undefined;
  try {
    await waitForBaseUrlReady(baseURL);
    const directResult = await attemptDirectAuthLogin(
      baseURL,
      email,
      password,
      storagePath,
    );
    if (directResult.ok) return;

    warn("login direto falhou; usando fallback via UI", directResult.reason);
    browser = await chromium.launch();
    const result = await attemptLogin(browser, baseURL, email, password, 3);
    if (!result.ok) {
      // Grava storage vazio para não deixar arquivo de versão anterior
      // mascarando a falha em runs subsequentes.
      try {
        writeFileSync(
          storagePath,
          JSON.stringify({ cookies: [], origins: [] }, null, 2),
        );
      } catch {
        /* noop */
      }
      throw new Error(
        `Login falhou após múltiplas tentativas: ${result.reason}.\n` +
          `Verifique se ${email} existe no Supabase, se a senha está correta, ` +
          `e se o app está rodando em ${baseURL}.`,
      );
    }
  } finally {
    await browser?.close().catch((err) => warn("browser.close falhou", err));
  }
}
