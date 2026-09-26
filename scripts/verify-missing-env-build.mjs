#!/usr/bin/env node
/**
 * Verifica que `vite build` (produção) NÃO falha quando VITE_SUPABASE_URL e
 * VITE_SUPABASE_PUBLISHABLE_KEY estão ausentes: o vite.config.ts injeta o
 * alvo gerenciado do Lovable Cloud como fallback via `define`.
 *
 * Roteiro:
 *   1. Afasta temporariamente o `.env` da raiz (renomeia para .env.bak-verify)
 *      e remove as variáveis VITE_SUPABASE_* do ambiente.
 *   2. Executa `vite build` na raiz do projeto.
 *   3. Restaura o `.env` (sempre, mesmo em falha).
 *   4. Espera exit code 0 (build concluído com fallback) e o aviso de
 *      variáveis ausentes na saída.
 *
 * Uso: `node scripts/verify-missing-env-build.mjs`
 * Retorna exit 0 quando o fallback funciona, exit 1 caso contrário.
 */
import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const viteBin = resolve(projectRoot, "node_modules/vite/bin/vite.js");
const envFile = resolve(projectRoot, ".env");
const envBackup = resolve(projectRoot, ".env.bak-verify");
const hadEnv = existsSync(envFile);

// Env limpo: remove todas as VITE_SUPABASE_* do ambiente.
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) {
  if (key.startsWith("VITE_SUPABASE_")) delete cleanEnv[key];
}

console.log("→ Rodando `vite build` sem VITE_SUPABASE_URL / _PUBLISHABLE_KEY…");

if (hadEnv) renameSync(envFile, envBackup);
let result;
try {
  result = spawnSync(
    process.execPath,
    [viteBin, "build", "--mode", "production"],
    { cwd: projectRoot, env: cleanEnv, encoding: "utf8", timeout: 180_000 },
  );
} finally {
  if (hadEnv) renameSync(envBackup, envFile);
}

const combined = `${result?.stdout ?? ""}\n${result?.stderr ?? ""}`;

if (!result || result.status !== 0) {
  console.error("✗ vite build falhou — o fallback do backend gerenciado NÃO funcionou.");
  console.error(combined.slice(0, 2000));
  process.exit(1);
}

if (!combined.includes("Variáveis de ambiente obrigatórias ausentes")) {
  console.error("✗ vite build passou, mas o aviso esperado não apareceu.");
  process.exit(1);
}

console.log("✓ Fallback funcionou: build concluído com o alvo gerenciado do backend.");
process.exit(0);
