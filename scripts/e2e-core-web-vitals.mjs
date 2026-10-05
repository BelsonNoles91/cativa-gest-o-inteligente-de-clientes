#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = mkdtempSync(join(tmpdir(), "cativa-cwv-"));
const distDir = join(tempRoot, "dist");
const viteCli = resolve(projectRoot, "node_modules/vite/bin/vite.js");
const playwrightCli = resolve(projectRoot, "node_modules/@playwright/test/cli.js");
const fakeBackendUrl = "http://cativa-performance.invalid";
const env = {
  ...process.env,
  VITE_SUPABASE_URL: fakeBackendUrl,
  VITE_SUPABASE_PUBLISHABLE_KEY: "cativa-performance-local-only",
  CATIVA_CWV_DIST_DIR: distDir,
};

function run(label, executable, args, timeout) {
  console.log(`\n${label}`);
  const result = spawnSync(executable, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    timeout,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} terminou com código ${result.status ?? "indisponível"}.`);
  }
}

let exitCode = 0;
try {
  console.log("Web Vitals: build temporário e backend simulado em domínio .invalid, sem serviço externo.");
  run(
    "Build de produção temporário",
    process.execPath,
    [
      viteCli,
      "build",
      projectRoot,
      "--config",
      resolve(projectRoot, "vite.config.ts"),
      "--mode",
      "production",
      "--outDir",
      distDir,
      "--emptyOutDir",
    ],
    180_000,
  );
  run(
    "Playwright Core Web Vitals",
    process.execPath,
    [
      playwrightCli,
      "test",
      "--config",
      resolve(projectRoot, "playwright.performance.config.ts"),
      ...process.argv.slice(2),
    ],
    240_000,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  exitCode = 1;
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

process.exitCode = exitCode;
