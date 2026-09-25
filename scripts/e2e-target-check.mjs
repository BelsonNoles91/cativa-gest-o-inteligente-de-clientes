#!/usr/bin/env node

const rawUrl = process.env.VITE_SUPABASE_URL?.trim();

if (!rawUrl) {
  throw new Error("VITE_SUPABASE_URL é obrigatório para identificar o alvo E2E.");
}

const projectRef = new URL(rawUrl).hostname.split(".")[0];
const targets = new Map([
  ["uqskxftzmjsumykpkwus", "supabase/config.toml (CLI vinculado)"],
  ["pegvtrvqdvzxysndddts", "vite.config.ts (fallback de runtime)"],
]);

console.log(
  `Alvo Supabase E2E: ${targets.get(projectRef) ?? "projeto diferente dos dois refs conhecidos"}.`,
);
