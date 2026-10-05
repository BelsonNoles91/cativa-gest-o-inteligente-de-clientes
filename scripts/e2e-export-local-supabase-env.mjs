#!/usr/bin/env node
import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

function parseCliEnv(source) {
  const values = new Map();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function appendGithubEnv(path, key, value) {
  if (!value || /[\r\n]/.test(value)) {
    throw new Error(`Valor local inválido para ${key}.`);
  }
  appendFileSync(path, `${key}=${value}\n`, { encoding: "utf8", mode: 0o600 });
}

const githubEnv = process.env.GITHUB_ENV;
if (!githubEnv) {
  throw new Error("Este exportador deve ser executado em um job do GitHub Actions.");
}

const statusArgs = ["status", "-o", "env"];
const supabaseWorkdir = process.env.SUPABASE_CLI_WORKDIR?.trim();
if (supabaseWorkdir) statusArgs.push("--workdir", supabaseWorkdir);

const output = execFileSync("supabase", statusArgs, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const cliEnv = parseCliEnv(output);
const apiUrl = cliEnv.get("API_URL") || cliEnv.get("SUPABASE_URL") || "";
const publicKey =
  cliEnv.get("PUBLISHABLE_KEY") ||
  cliEnv.get("SUPABASE_PUBLISHABLE_KEY") ||
  cliEnv.get("ANON_KEY") ||
  cliEnv.get("SUPABASE_ANON_KEY") ||
  "";
const serviceKey =
  cliEnv.get("SERVICE_ROLE_KEY") ||
  cliEnv.get("SUPABASE_SERVICE_ROLE_KEY") ||
  cliEnv.get("SECRET_KEY") ||
  "";
const databaseUrl = cliEnv.get("DB_URL") || cliEnv.get("SUPABASE_DB_URL") || "";

let parsedUrl;
try {
  parsedUrl = new URL(apiUrl);
} catch {
  throw new Error("supabase status não retornou uma URL de API local válida.");
}
const localHostname = parsedUrl.hostname.replace(/^\[|\]$/g, "");
if (parsedUrl.protocol !== "http:" || !new Set(["localhost", "127.0.0.1", "::1"]).has(localHostname)) {
  throw new Error("Recusado: o Supabase CLI não está apontando para localhost/loopback.");
}
if (!publicKey || !serviceKey || !databaseUrl) {
  throw new Error("supabase status não retornou as chaves e a URL do banco locais esperadas.");
}

for (const secret of [publicKey, serviceKey, databaseUrl, cliEnv.get("JWT_SECRET") || ""]) {
  if (secret) process.stdout.write(`::add-mask::${secret}\n`);
}

appendGithubEnv(githubEnv, "SUPABASE_URL", apiUrl);
appendGithubEnv(githubEnv, "SUPABASE_ANON_KEY", publicKey);
appendGithubEnv(githubEnv, "SUPABASE_SERVICE_ROLE_KEY", serviceKey);
appendGithubEnv(githubEnv, "SUPABASE_DB_URL", databaseUrl);
appendGithubEnv(githubEnv, "SUPABASE_QA_DB_URL", databaseUrl);
appendGithubEnv(githubEnv, "VITE_SUPABASE_URL", apiUrl);
appendGithubEnv(githubEnv, "VITE_SUPABASE_PUBLISHABLE_KEY", publicKey);
appendGithubEnv(githubEnv, "E2E_LOCAL_SUPABASE", "true");
appendGithubEnv(githubEnv, "E2E_QA_PROJECT_REF", "local");
appendGithubEnv(githubEnv, "E2E_TARGET_ALLOWLIST", "local");
appendGithubEnv(githubEnv, "E2E_DESTRUCTIVE", "true");
appendGithubEnv(githubEnv, "E2E_TENANT_SLUG", "studio-teste-qa");
appendGithubEnv(githubEnv, "E2E_EMAIL_DOMAIN", "cativa.test");

console.log("Ambiente Supabase local descartável exportado para os próximos passos do job.");
