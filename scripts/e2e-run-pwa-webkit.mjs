#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nodeMajor = Number(process.versions.node.split(".")[0]);

function requireValue(name) {
  if (!process.env[name]?.trim()) throw new Error(`${name} é obrigatório para este gate local.`);
}

function validateLocalTarget() {
  if (nodeMajor < 22) throw new Error("O gate PWA WebKit exige Node.js 22 ou superior.");
  for (const name of [
    "VITE_SUPABASE_URL",
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "E2E_USER",
    "E2E_PASS",
    "E2E_TENANT_SLUG",
  ]) requireValue(name);

  const backendUrl = new URL(process.env.VITE_SUPABASE_URL);
  const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
  if (backendUrl.protocol !== "http:" || !loopback.has(backendUrl.hostname.replace(/^\[|\]$/g, ""))) {
    throw new Error("O gate PWA WebKit só pode usar Supabase HTTP em localhost/loopback.");
  }
  if (
    process.env.E2E_LOCAL_SUPABASE !== "true" ||
    process.env.E2E_QA_PROJECT_REF?.trim() !== "local" ||
    (process.env.E2E_TARGET_ALLOWLIST ?? "").trim() !== "local"
  ) {
    throw new Error("O gate destrutivo PWA exige exclusivamente o alvo Supabase local descartável.");
  }

  const baseUrl = new URL(process.env.E2E_BASE_URL ?? "http://cativa.localhost:4173");
  const localWebHost = baseUrl.hostname === "cativa.localhost";
  if (
    baseUrl.protocol !== "http:" ||
    baseUrl.port !== "4173" ||
    !localWebHost ||
    baseUrl.username ||
    baseUrl.password
  ) {
    throw new Error("O app PWA deve usar http://cativa.localhost:4173, sem credenciais na URL.");
  }

  const storageState = resolve(projectRoot, process.env.E2E_STORAGE_STATE_PATH ?? "e2e/.auth/storageState.json");
  if (!existsSync(storageState)) throw new Error("O storageState sintético não existe; execute o bootstrap E2E local antes.");

  const previewOutDir = resolve(projectRoot, process.env.PW_PREVIEW_OUT_DIR ?? "dist");
  for (const file of ["index.html", "sw.js"]) {
    if (!existsSync(join(previewOutDir, file))) {
      throw new Error(`Build PWA ausente em ${previewOutDir}; gere o build de produção antes do gate.`);
    }
  }

  return { baseUrl: baseUrl.href, previewOutDir };
}

function runTargetGuard(env) {
  const guard = spawnSync(
    process.execPath,
    [join(projectRoot, "scripts/e2e-target-check.mjs"), "--destructive"],
    { cwd: projectRoot, env, stdio: "inherit" },
  );
  if (guard.error) throw guard.error;
  if (guard.status !== 0) throw new Error("O guard de alvo Supabase recusou o teste.");
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForPreview(preview) {
  const healthUrl = "http://[::1]:4173";
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (preview.spawnError) throw preview.spawnError;
    if (preview.exitCode !== null || preview.signalCode !== null) {
      throw new Error("O preview Vite local encerrou antes de ficar pronto.");
    }
    try {
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(500) });
      if (response.ok) return;
    } catch {
      // A readiness probe é restrita a loopback; continua até o preview iniciar.
    }
    await sleep(250);
  }
  throw new Error("O preview Vite local não ficou pronto em 30 segundos.");
}

function waitForChild(child) {
  return new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveExit(code ?? (signal ? 1 : 0)));
  });
}

async function stopPreview(preview) {
  if (!preview || preview.pid === undefined || preview.exitCode !== null || preview.signalCode !== null) return;
  try {
    process.kill(preview.pid, "SIGCONT");
  } catch {
    // O preview pode não estar pausado.
  }
  const stopped = waitForChild(preview).catch(() => undefined);
  preview.kill("SIGTERM");
  await Promise.race([stopped, sleep(3_000)]);
  if (preview.exitCode === null && preview.signalCode === null) preview.kill("SIGKILL");
}

async function main() {
  const { baseUrl, previewOutDir } = validateLocalTarget();
  const env = {
    ...process.env,
    E2E_BASE_URL: baseUrl,
    E2E_PWA_EXTERNAL_PREVIEW: "true",
    PW_PREVIEW_OUT_DIR: previewOutDir,
    PW_OUTPUT_DIR: process.env.PW_OUTPUT_DIR ?? "e2e/.artifacts-pwa-webkit-offline",
    PW_REPORT_DIR: process.env.PW_REPORT_DIR ?? "e2e/.report-pwa-webkit-offline",
  };
  runTargetGuard(env);

  const viteEntry = resolve(projectRoot, "node_modules/vite/bin/vite.js");
  const preview = spawn(
    process.execPath,
    [viteEntry, "preview", "--outDir", previewOutDir, "--host", "::1", "--port", "4173", "--strictPort"],
    { cwd: projectRoot, env, stdio: "inherit" },
  );
  preview.once("error", (error) => {
    preview.spawnError = error;
  });
  let runner;
  let interrupted = false;
  const interrupt = (signal) => {
    interrupted = true;
    if (runner?.exitCode === null) runner.kill(signal);
    void stopPreview(preview);
  };
  process.once("SIGINT", () => interrupt("SIGINT"));
  process.once("SIGTERM", () => interrupt("SIGTERM"));

  try {
    await waitForPreview(preview);
    if (interrupted) return 130;

    env.E2E_PWA_PREVIEW_PID = String(preview.pid);
    runner = spawn(
      process.execPath,
      [
        resolve(projectRoot, "node_modules/playwright/cli.js"),
        "test",
        "--config",
        resolve(projectRoot, "playwright.pwa.webkit.config.ts"),
        "--project",
        "mobile-webkit-pwa-offline",
      ],
      { cwd: projectRoot, env, stdio: "inherit" },
    );
    return await waitForChild(runner);
  } finally {
    await stopPreview(preview);
  }
}

main()
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Falha no runner PWA WebKit."}\n`);
    process.exitCode = 1;
  });
