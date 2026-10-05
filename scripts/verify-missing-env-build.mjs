#!/usr/bin/env node
/**
 * Verifica que `vite build` (produção) falha de forma explícita quando
 * VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY estão ausentes, em vez de
 * publicar silenciosamente apontando para um projeto Supabase fallback.
 *
 * Roteiro:
 *   1. Executa o Vite sem configuração Supabase e confirma falha segura.
 *   2. Executa outra build isolada com um host `.invalid` sintético.
 *   3. Confirma que o bundle usa exatamente o alvo fornecido, sem incluir o
 *      fallback antigo de outro projeto.
 *   4. Faz build de desenvolvimento sem env e confirma que o fallback é
 *      exclusivamente loopback com uma chave placeholder.
 *   5. Remove somente diretórios temporários próprios; nunca toca em `dist/`.
 *
 * Uso: `node scripts/verify-missing-env-build.mjs`
 * Retorna exit 0 quando a falha segura e a seleção explícita do alvo passam.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const viteBin = resolve(projectRoot, "node_modules/vite/bin/vite.js");
const viteConfig = resolve(projectRoot, "vite.config.ts");
const viteArgs = [
  viteBin,
  "build",
  projectRoot,
  "--config",
  viteConfig,
];

function runBuild(env, outputDir, mode = "production") {
  return spawnSync(
    process.execPath,
    [...viteArgs, "--mode", mode, "--outDir", outputDir, "--emptyOutDir"],
    { cwd: projectRoot, env, encoding: "utf8", timeout: 180_000 },
  );
}

function listJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}

// Env limpo: remove todas as VITE_SUPABASE_* do ambiente.
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) {
  if (key.startsWith("VITE_SUPABASE_")) cleanEnv[key] = "";
}
// Simulate GitHub Actions, where configured secrets may exist as env vars but
// intentionally contain empty strings when they are not configured.
cleanEnv.VITE_SUPABASE_URL = "";
cleanEnv.VITE_SUPABASE_PUBLISHABLE_KEY = "";
cleanEnv.VITE_SUPABASE_ANON_KEY = "";

console.log("→ Verificando bloqueio de produção sem VITE_SUPABASE_URL / _PUBLISHABLE_KEY…");

let result;
const missingEnvDir = mkdtempSync(join(tmpdir(), "cativa-missing-env-build-"));
try {
  result = runBuild(cleanEnv, join(missingEnvDir, "dist"));
} finally {
  rmSync(missingEnvDir, { recursive: true, force: true });
}

const combined = `${result?.stdout ?? ""}\n${result?.stderr ?? ""}`;

if (!result || result.error) {
  console.error("✗ Não foi possível iniciar a verificação do vite build.");
  console.error(combined.slice(0, 2000));
  process.exit(1);
}

if (result.status === 0) {
  console.error("✗ vite build passou sem alvo explícito; o fallback pode direcionar ao Supabase errado.");
  process.exit(1);
}

if (
  !combined.includes("Variáveis de ambiente obrigatórias ausentes") ||
  !combined.includes("Build de produção abortado por segurança") ||
  !combined.includes("VITE_SUPABASE_URL") ||
  !combined.includes("VITE_SUPABASE_PUBLISHABLE_KEY")
) {
  console.error("✗ vite build falhou, mas sem a mensagem de configuração segura esperada.");
  console.error(combined.slice(0, 2000));
  process.exit(1);
}

console.log("✓ Build de produção bloqueado corretamente: configure o alvo Supabase explícito antes de publicar.");

const explicitTarget = "https://qa-build-only.invalid";
const explicitDir = mkdtempSync(join(tmpdir(), "cativa-explicit-target-build-"));
const explicitOutput = join(explicitDir, "dist");
const explicitEnv = {
  ...cleanEnv,
  VITE_SUPABASE_URL: explicitTarget,
  VITE_SUPABASE_PUBLISHABLE_KEY: "qa-public-key-not-a-secret",
};

let explicitResult;
let bundle = "";
try {
  explicitResult = runBuild(explicitEnv, explicitOutput);
  if (
    explicitResult.status === 0 &&
    existsSync(join(explicitOutput, "assets"))
  ) {
    bundle = listJavaScriptFiles(join(explicitOutput, "assets"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
  }
} finally {
  rmSync(explicitDir, { recursive: true, force: true });
}

if (!explicitResult || explicitResult.error || explicitResult.status !== 0) {
  const explicitOutputText = `${explicitResult?.stdout ?? ""}\n${explicitResult?.stderr ?? ""}`;
  console.error("✗ Build isolado com alvo Supabase explícito falhou.");
  console.error(explicitOutputText.slice(-2000));
  process.exit(1);
}

if (
  !bundle.includes(explicitTarget) ||
  bundle.includes("pegvtrvqdvzxysndddts.supabase.co")
) {
  console.error("✗ Bundle não preservou o alvo Supabase explícito de forma isolada.");
  process.exit(1);
}

console.log("✓ Build isolado aponta somente para o host sintético explicitamente configurado.");

const localFallback = "http://127.0.0.1:54321";
const developmentDir = mkdtempSync(join(tmpdir(), "cativa-local-only-build-"));
const developmentOutput = join(developmentDir, "dist");
let developmentResult;
let developmentBundle = "";
try {
  developmentResult = runBuild(cleanEnv, developmentOutput, "development");
  if (
    developmentResult.status === 0 &&
    existsSync(join(developmentOutput, "assets"))
  ) {
    developmentBundle = listJavaScriptFiles(join(developmentOutput, "assets"))
      .map((path) => readFileSync(path, "utf8"))
      .join("\n");
  }
} finally {
  rmSync(developmentDir, { recursive: true, force: true });
}

if (!developmentResult || developmentResult.error || developmentResult.status !== 0) {
  console.error("✗ Build de desenvolvimento sem env falhou.");
  process.exit(1);
}

if (
  !developmentBundle.includes(localFallback) ||
  !developmentBundle.includes("local-development-key-not-configured") ||
  developmentBundle.includes("pegvtrvqdvzxysndddts.supabase.co") ||
  developmentBundle.includes("uqskxftzmjsumykpkwus.supabase.co")
) {
  console.error("✗ Fallback de desenvolvimento não está isolado em loopback.");
  process.exit(1);
}

console.log("✓ Build de desenvolvimento sem env aponta apenas para loopback com chave placeholder.");
process.exit(0);
