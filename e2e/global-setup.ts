/**
 * Playwright global setup — login real via UI.
 *
 * Lê E2E_USER e E2E_PASS de .env.local (ou ambiente do CI), faz login na
 * página /auth/login e persiste o storageState em e2e/.auth/storageState.json.
 *
 * Esse arquivo é então reutilizado por todos os specs via `use.storageState`
 * em playwright.config.ts. Isso evita login a cada teste (rápido) e dá um
 * único ponto de falha quando credenciais expiram.
 *
 * Pré-requisitos:
 *  - Usuário seed já existir no Supabase do projeto apontado por VITE_SUPABASE_URL.
 *  - Esse usuário deve ter pelo menos 1 tenant_membership ativo (para /app
 *    renderizar dashboard, agenda etc — caso contrário cai no /onboarding).
 *  - .env.local com:
 *      E2E_USER=visual-test@cativa.local
 *      E2E_PASS=<senha>
 *
 * Se as variáveis estiverem ausentes, o setup grava um storageState VAZIO e
 * imprime um aviso — assim os specs de rotas públicas continuam rodando.
 */
import { chromium, request, type FullConfig } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "node:process";

// Carrega .env.local se existir (sem dep extra: parse manual simples).
function loadEnvFile(file: string) {
  try {
    const fs = require("node:fs") as typeof import("node:fs");
    if (!fs.existsSync(file)) return;
    const lines = fs.readFileSync(file, "utf8").split("\n");
    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const k = line.slice(0, eq).trim();
      let v = line.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* noop */
  }
}

export default async function globalSetup(config: FullConfig) {
  loadEnvFile(resolve(process.cwd(), ".env.local"));
  loadEnvFile(resolve(process.cwd(), ".env"));

  const baseURL =
    config.projects[0]?.use?.baseURL ??
    process.env.E2E_BASE_URL ??
    "http://localhost:8080";

  const storagePath = resolve(process.cwd(), "e2e/.auth/storageState.json");
  const dir = dirname(storagePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const email = process.env.E2E_USER;
  const password = process.env.E2E_PASS;

  if (!email || !password) {
    // Sem credenciais: grava storage vazio para não quebrar o config.
    writeFileSync(
      storagePath,
      JSON.stringify({ cookies: [], origins: [] }, null, 2),
    );
    // eslint-disable-next-line no-console
    console.warn(
      "[playwright] E2E_USER/E2E_PASS ausentes — storageState vazio gravado.\n" +
        "             Specs autenticados (rotas /app) serão pulados/falharão.",
    );
    return;
  }

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/auth/login`, { waitUntil: "domcontentloaded" });
    await page.getByLabel(/e-?mail/i).fill(email);
    await page.getByLabel(/senha/i).fill(password);
    await page.getByRole("button", { name: /entrar|acessar/i }).click();

    // Espera redirect para /app (ou /onboarding se sem tenant).
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });

    await ctx.storageState({ path: storagePath });
    // eslint-disable-next-line no-console
    console.log(`[playwright] storageState salvo em ${storagePath}`);
  } finally {
    await browser.close();
  }
}
