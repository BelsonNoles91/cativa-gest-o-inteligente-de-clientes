#!/usr/bin/env node
/**
 * Verifica que `vite build` (produção) falha com mensagem clara quando
 * VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY estão ausentes.
 *
 * Roteiro:
 *   1. Executa `vite build` em um cwd temporário, com um HOME temporário
 *      e sem as variáveis Supabase no ambiente. Como o cwd temporário
 *      não tem .env, `loadEnv` não injeta nada.
 *   2. Espera exit code != 0.
 *   3. Espera que stderr/stdout contenha os marcadores da mensagem
 *      definida em vite.config.ts (guard de build de produção).
 *
 * Uso: `node scripts/verify-missing-env-build.mjs`
 * Retorna exit 0 quando o guard funciona, exit 1 caso contrário.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const projectRoot = resolve(process.cwd());
const viteBin = resolve(projectRoot, "node_modules/vite/bin/vite.js");

const tmpCwd = mkdtempSync(join(tmpdir(), "cativa-missing-env-"));
const tmpHome = mkdtempSync(join(tmpdir(), "cativa-missing-env-home-"));

// Env limpo: preserva PATH/Node, remove todas as VITE_SUPABASE_* e
// aponta HOME/USERPROFILE para um diretório vazio, evitando qualquer
// .env global.
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) {
  if (key.startsWith("VITE_SUPABASE_")) delete cleanEnv[key];
}
cleanEnv.HOME = tmpHome;
cleanEnv.USERPROFILE = tmpHome;

console.log("→ Rodando `vite build` sem VITE_SUPABASE_URL / _PUBLISHABLE_KEY…");

const result = spawnSync(
  process.execPath,
  [viteBin, "build", "--mode", "production", "--config", resolve(projectRoot, "vite.config.ts")],
  {
    cwd: tmpCwd,
    env: cleanEnv,
    encoding: "utf8",
    timeout: 120_000,
  },
);

// Limpeza best-effort
try { rmSync(tmpCwd, { recursive: true, force: true }); } catch {}
try { rmSync(tmpHome, { recursive: true, force: true }); } catch {}

const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;

const expectedMarkers = [
  "Variáveis de ambiente obrigatórias ausentes",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
];

const missingMarkers = expectedMarkers.filter((m) => !combined.includes(m));
const failedAsExpected = result.status !== 0;

if (!failedAsExpected) {
  console.error("✗ vite build finalizou com exit 0 — guard NÃO bloqueou o build.");
  console.error(combined.slice(0, 2000));
  process.exit(1);
}

if (missingMarkers.length > 0) {
  console.error("✗ vite build falhou, mas a mensagem esperada não apareceu.");
  console.error("  Marcadores ausentes:", missingMarkers);
  console.error("--- saída capturada ---");
  console.error(combined.slice(0, 2000));
  process.exit(1);
}

console.log("✓ Guard de env vars funcionou: build abortou com mensagem clara.");
process.exit(0);
