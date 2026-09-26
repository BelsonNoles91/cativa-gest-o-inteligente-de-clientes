#!/usr/bin/env node
/**
 * Verifica que `vite build` (produção) NÃO falha quando VITE_SUPABASE_URL e
 * VITE_SUPABASE_PUBLISHABLE_KEY estão ausentes: o vite.config.ts injeta o
 * alvo gerenciado do Lovable Cloud como fallback via `define`.
 *
 * Roteiro:
 *   1. Executa `vite build` em um cwd temporário, com um HOME temporário
 *      e sem as variáveis Supabase no ambiente. Como o cwd temporário
 *      não tem .env, `loadEnv` não injeta nada.
 *   2. Espera exit code 0 (build concluído com fallback).
 *   3. Espera que o aviso de variáveis ausentes apareça na saída.
 *
 * Uso: `node scripts/verify-missing-env-build.mjs`
 * Retorna exit 0 quando o fallback funciona, exit 1 caso contrário.
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
  // Passa a raiz do projeto como argumento posicional: o cwd temporário
  // garante que `loadEnv` não encontre nenhum .env, enquanto a raiz
  // explícita permite ao Vite resolver o index.html e os módulos.
  [viteBin, "build", projectRoot, "--mode", "production", "--config", resolve(projectRoot, "vite.config.ts")],
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

const expectedMarkers = ["Variáveis de ambiente obrigatórias ausentes"];
const missingMarkers = expectedMarkers.filter((m) => !combined.includes(m));

if (result.status !== 0) {
  console.error("✗ vite build falhou — o fallback do backend gerenciado NÃO funcionou.");
  console.error(combined.slice(0, 2000));
  process.exit(1);
}

if (missingMarkers.length > 0) {
  console.error("✗ vite build passou, mas o aviso esperado não apareceu.");
  console.error("  Marcadores ausentes:", missingMarkers);
  process.exit(1);
}

console.log("✓ Fallback funcionou: build concluído com o alvo gerenciado do backend.");
process.exit(0);
