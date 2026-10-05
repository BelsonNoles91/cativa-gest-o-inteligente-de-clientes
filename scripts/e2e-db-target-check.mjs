#!/usr/bin/env node

const rawDatabaseUrl = process.env.SUPABASE_QA_DB_URL?.trim();
const qaProjectRef = process.env.E2E_QA_PROJECT_REF?.trim();
const allowlist = new Set(
  (process.env.E2E_TARGET_ALLOWLIST ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const protectedRefs = new Set([
  "uqskxftzmjsumykpkwus",
  "pegvtrvqdvzxysndddts",
  ...(process.env.E2E_PROTECTED_PROJECT_REFS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);

if (!rawDatabaseUrl || !qaProjectRef) {
  throw new Error("SUPABASE_QA_DB_URL e E2E_QA_PROJECT_REF são obrigatórios para testes SQL remotos.");
}

let databaseUrl;
try {
  databaseUrl = new URL(rawDatabaseUrl);
} catch {
  throw new Error("SUPABASE_QA_DB_URL precisa ser uma URL PostgreSQL válida.");
}
if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") {
  throw new Error("SUPABASE_QA_DB_URL precisa usar o protocolo PostgreSQL.");
}

if (process.env.E2E_LOCAL_SUPABASE === "true") {
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const localHostname = databaseUrl.hostname.replace(/^\[|\]$/g, "");
  if (!loopbackHosts.has(localHostname)) {
    throw new Error("Execução SQL local aceita somente um host localhost/loopback.");
  }
  if (qaProjectRef !== "local") {
    throw new Error("Execução SQL local exige E2E_QA_PROJECT_REF=local.");
  }
  if (allowlist.size !== 1 || !allowlist.has("local")) {
    throw new Error("Execução SQL local exige E2E_TARGET_ALLOWLIST=local, sem outros alvos.");
  }
  console.log("Alvo SQL QA validado: instância local descartável (credenciais ocultas).");
  process.exit(0);
}

const hostMatch = databaseUrl.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
const username = decodeURIComponent(databaseUrl.username);
const poolerMatch = username.match(/^postgres\.([a-z0-9-]+)$/i);
const isSupabasePooler = /^[a-z0-9.-]+\.pooler\.supabase\.com$/i.test(databaseUrl.hostname);
const projectRef = hostMatch?.[1] ?? (isSupabasePooler ? poolerMatch?.[1] : "") ?? "";

if (!projectRef) {
  throw new Error("Não foi possível identificar o project ref no host direto ou usuário do pooler Supabase.");
}
if (projectRef !== qaProjectRef) {
  throw new Error(`Banco QA não corresponde a E2E_QA_PROJECT_REF (${projectRef} != ${qaProjectRef}).`);
}
if (protectedRefs.has(projectRef)) {
  throw new Error(`Execução SQL destrutiva bloqueada: ${projectRef} está marcado como projeto protegido.`);
}
if (!allowlist.has(projectRef)) {
  throw new Error(`Banco QA não permitido (${projectRef}). Configure E2E_TARGET_ALLOWLIST explicitamente.`);
}

console.log(`Alvo SQL QA validado: ${projectRef} (credenciais ocultas).`);
