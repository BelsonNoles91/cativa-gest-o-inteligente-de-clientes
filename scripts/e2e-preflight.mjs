#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const requireAuth = args.has("--require-auth");

function loadEnvFile(file) {
  if (!existsSync(file)) return { found: false, loaded: 0 };
  const content = readFileSync(file, "utf8");
  let loaded = 0;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
      loaded++;
    }
  }
  return { found: true, loaded };
}

function readEnv(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function mask(value) {
  if (!value) return "ausente";
  if (value.length <= 6) return "***";
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function printStatus(label, ok, detail) {
  const prefix = ok ? "OK " : "WARN";
  console.log(`${prefix} ${label}: ${detail}`);
}

async function checkSupabaseReachability(baseUrl) {
  if (!baseUrl) {
    return { ok: false, detail: "VITE_SUPABASE_URL ausente" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${baseUrl}/auth/v1/settings`, {
      method: "GET",
      signal: controller.signal,
      headers: { apikey: publishableKey || "" },
    });
    if (!response.ok) {
      return {
        ok: false,
        detail: `endpoint respondeu ${response.status}`,
      };
    }
    return { ok: true, detail: "endpoint auth/v1/settings acessível" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { ok: false, detail: message };
  } finally {
    clearTimeout(timeout);
  }
}

async function validateCredentials(baseUrl, key, email, password) {
  if (!baseUrl || !key || !email || !password) {
    return { ok: false, detail: "dados insuficientes para validar login" };
  }

  const supabase = createClient(baseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return {
        ok: false,
        detail: error.message,
      };
    }
    await supabase.auth.signOut();
    return {
      ok: true,
      detail: "login válido com credenciais QA (identidade ocultada)",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    return { ok: false, detail: message };
  }
}

const envLocal = loadEnvFile(resolve(process.cwd(), ".env.local"));
const env = loadEnvFile(resolve(process.cwd(), ".env"));

const supabaseUrl = readEnv("VITE_SUPABASE_URL");
const publishableKey = readEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
const e2eUser = readEnv("E2E_USER");
const e2ePass = readEnv("E2E_PASS");
const e2eBaseUrl = readEnv("E2E_BASE_URL") || "http://127.0.0.1:8080";

const hasPublicBaseline = existsSync(
  resolve(
    process.cwd(),
    "e2e/__screenshots__/visual/public-routes.spec.ts/login-iphone-14-portrait.png",
  ),
);
const supabaseReachability = await checkSupabaseReachability(supabaseUrl);
const authValidation =
  e2eUser && e2ePass
    ? await validateCredentials(
        supabaseUrl,
        publishableKey,
        e2eUser,
        e2ePass,
      )
    : { ok: false, detail: "credenciais ausentes" };

console.log("Cativa E2E preflight");
console.log("");
printStatus(
  ".env.local",
  envLocal.found,
  envLocal.found ? `${envLocal.loaded} variáveis carregadas` : "arquivo não encontrado",
);
printStatus(
  ".env",
  env.found,
  env.found ? `${env.loaded} variáveis carregadas` : "arquivo não encontrado",
);
printStatus(
  "Supabase URL",
  Boolean(supabaseUrl),
  supabaseUrl || "VITE_SUPABASE_URL ausente",
);
printStatus(
  "Publishable key",
  Boolean(publishableKey),
  publishableKey ? mask(publishableKey) : "VITE_SUPABASE_PUBLISHABLE_KEY ausente",
);
printStatus(
  "E2E user",
  Boolean(e2eUser),
  e2eUser ? "configurado (identidade ocultada)" : "E2E_USER ausente",
);
printStatus(
  "E2E password",
  Boolean(e2ePass),
  e2ePass ? "configurada (valor ocultado)" : "E2E_PASS ausente",
);
printStatus("E2E base URL", true, e2eBaseUrl);
printStatus(
  "Baseline pública",
  hasPublicBaseline,
  hasPublicBaseline
    ? "snapshot público de login encontrado"
    : "baseline pública de login não encontrada",
);
printStatus(
  "Supabase reachability",
  supabaseReachability.ok,
  supabaseReachability.detail,
);
printStatus(
  "E2E auth validation",
  authValidation.ok,
  authValidation.detail,
);

console.log("");
if (!e2eUser || !e2ePass) {
  console.log(
    "Fase autenticada indisponível: configure E2E_USER e E2E_PASS em .env.local para validar /app/* e portal.",
  );
}

if (e2eUser && e2ePass && !authValidation.ok) {
  console.log(
    `Credenciais atuais não destravam a fase autenticada: ${authValidation.detail}.`,
  );
}

if (requireAuth && (!e2eUser || !e2ePass)) {
  console.error("");
  console.error(
    "Preflight falhou: credenciais E2E ausentes para a validação autenticada.",
  );
  process.exit(1);
}

if (requireAuth && !supabaseReachability.ok && !authValidation.ok) {
  console.error("");
  console.error(
    `Preflight falhou: Supabase inacessível para a validação autenticada (${supabaseReachability.detail}).`,
  );
  process.exit(1);
}

if (requireAuth && !authValidation.ok) {
  console.error("");
  console.error(
    `Preflight falhou: credenciais E2E inválidas ou não utilizáveis (${authValidation.detail}).`,
  );
  process.exit(1);
}

console.log("");
console.log(
  requireAuth
    ? "Preflight autenticado concluído."
    : "Preflight concluído.",
);
