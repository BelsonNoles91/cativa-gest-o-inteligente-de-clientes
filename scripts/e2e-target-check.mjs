#!/usr/bin/env node

const args = new Set(process.argv.slice(2));
const rawUrl = process.env.VITE_SUPABASE_URL?.trim();

if (!rawUrl) {
  throw new Error("VITE_SUPABASE_URL é obrigatório para identificar o alvo E2E.");
}

let supabaseUrl;
try {
  supabaseUrl = new URL(rawUrl);
} catch {
  throw new Error("VITE_SUPABASE_URL precisa ser uma URL válida.");
}

const destructive = args.has("--destructive") || process.env.E2E_DESTRUCTIVE === "true";
const configuredAllowlist = (process.env.E2E_TARGET_ALLOWLIST ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

if (process.env.E2E_LOCAL_SUPABASE === "true") {
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const localHostname = supabaseUrl.hostname.replace(/^\[|\]$/g, "");
  if (
    supabaseUrl.protocol !== "http:" ||
    !loopbackHosts.has(localHostname) ||
    supabaseUrl.username ||
    supabaseUrl.password
  ) {
    throw new Error(
      "E2E_LOCAL_SUPABASE aceita somente HTTP em localhost/loopback, sem credenciais na URL.",
    );
  }
  if (destructive && process.env.E2E_QA_PROJECT_REF?.trim() !== "local") {
    throw new Error("Testes destrutivos locais exigem E2E_QA_PROJECT_REF=local.");
  }
  if (destructive && (configuredAllowlist.length !== 1 || configuredAllowlist[0] !== "local")) {
    throw new Error("Testes destrutivos locais exigem E2E_TARGET_ALLOWLIST=local, sem outros alvos.");
  }

  console.log(`Alvo Supabase E2E: instância local descartável (${supabaseUrl.origin}).`);
  console.log(`Modo E2E: ${destructive ? "destrutivo/local isolado" : "smoke local"}.`);
  process.exit(0);
}

if (supabaseUrl.protocol !== "https:") {
  throw new Error("Testes Supabase remotos exigem HTTPS.");
}
const supabaseHostMatch = supabaseUrl.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/i);
if (!supabaseHostMatch) {
  throw new Error("VITE_SUPABASE_URL deve apontar diretamente para <project-ref>.supabase.co.");
}
const projectRef = supabaseHostMatch[1];
const targets = new Map([
  ["uqskxftzmjsumykpkwus", "supabase/config.toml (CLI vinculado)"],
  ["pegvtrvqdvzxysndddts", "vite.config.ts (fallback de runtime)"],
]);

const qaProjectRef = process.env.E2E_QA_PROJECT_REF?.trim();
const allowlist = new Set(configuredAllowlist.length > 0 ? configuredAllowlist : [...targets.keys()]);
const protectedProjectRefs = new Set([
  "uqskxftzmjsumykpkwus",
  "pegvtrvqdvzxysndddts",
  ...(process.env.E2E_PROTECTED_PROJECT_REFS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
]);

if (destructive) {
  if (!qaProjectRef) {
    throw new Error(
      "Testes destrutivos exigem E2E_QA_PROJECT_REF para impedir execução acidental no projeto atual.",
    );
  }
  if (projectRef !== qaProjectRef) {
    throw new Error(
      `Testes destrutivos devem usar o projeto QA ${qaProjectRef}; alvo atual: ${projectRef}.`,
    );
  }
  if (protectedProjectRefs.has(projectRef)) {
    throw new Error(
      `Execução destrutiva bloqueada: ${projectRef} está marcado como projeto protegido, não QA.`,
    );
  }
  if (configuredAllowlist.length === 0) {
    throw new Error(
      "Testes destrutivos exigem E2E_TARGET_ALLOWLIST explícita; alvos conhecidos servem somente para smoke seguro.",
    );
  }
}

if (!allowlist.has(projectRef)) {
  throw new Error(
    `Alvo Supabase não permitido (${projectRef}). Configure E2E_TARGET_ALLOWLIST explicitamente para este projeto de testes.`,
  );
}

console.log(
  `Alvo Supabase E2E: ${targets.get(projectRef) ?? "projeto QA explicitamente autorizado"}.`,
);
console.log(`Modo E2E: ${destructive ? "destrutivo/QA" : "smoke seguro"}.`);
