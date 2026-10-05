#!/usr/bin/env node

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const allowedTests = new Set([
  "supabase/tests/rls-regression.sql",
  "supabase/tests/tenant-idor-regression.sql",
  "supabase/tests/realtime-publication-regression.sql",
  "supabase/tests/storage-regression.sql",
  "supabase/tests/crm-media-rls-matrix.sql",
  "supabase/tests/client-notes-rls-regression.sql",
  "supabase/tests/appointment-scope-rls-regression.sql",
  "supabase/tests/scheduling-reference-scope-regression.sql",
  "supabase/tests/confirmation-portal-scope-regression.sql",
  "supabase/tests/catalog-crm-scope-regression.sql",
  "supabase/tests/admin-unit-scope-regression.sql",
  "supabase/tests/tenant-reference-catalog-audit.sql",
  "supabase/tests/retention-advisor-quota-regression.sql",
  "supabase/tests/security-scan-history-regression.sql",
  "supabase/tests/atomic-tenant-onboarding-regression.sql",
  "supabase/tests/admin-subscription-atomic-regression.sql",
  "supabase/tests/catalog-atomic-mutations-regression.sql",
  "supabase/tests/plan-name-deduplication-regression.sql",
]);
const requestedFile = process.argv[2];

if (!allowedTests.has(requestedFile)) {
  console.error("Informe um arquivo SQL de regressão permitido.");
  process.exit(2);
}

const sqlFile = resolve(process.cwd(), requestedFile);
if (!existsSync(sqlFile)) {
  console.error(`Arquivo de teste não encontrado: ${requestedFile}`);
  process.exit(2);
}

const guard = spawnSync(process.execPath, ["scripts/e2e-db-target-check.mjs"], {
  stdio: "inherit",
});
if (guard.status !== 0) process.exit(guard.status ?? 1);

const databaseUrl = process.env.SUPABASE_QA_DB_URL?.trim();
if (!databaseUrl) {
  console.error("SUPABASE_QA_DB_URL ausente.");
  process.exit(2);
}

function run(command, args, options = {}) {
  const spawnOptions = { stdio: "inherit", ...options };
  if (options.input !== undefined) spawnOptions.stdio = ["pipe", "inherit", "inherit"];
  const result = spawnSync(command, args, spawnOptions);
  if (result.error?.code === "ENOENT") return null;
  if (result.error) throw result.error;
  return result.status ?? 1;
}

const hostPsqlResult = run("psql", [
  databaseUrl,
  "-X",
  "-v",
  "ON_ERROR_STOP=1",
  "-f",
  sqlFile,
]);

if (hostPsqlResult !== null) process.exit(hostPsqlResult);

// A host psql install is optional for a disposable local Supabase stack. Never
// use Docker as a fallback for a remote target or a broadly configured allowlist.
let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("SUPABASE_QA_DB_URL inválida.");
  process.exit(2);
}

const localOnly =
  process.env.E2E_LOCAL_SUPABASE === "true" &&
  process.env.E2E_QA_PROJECT_REF === "local" &&
  (process.env.E2E_TARGET_ALLOWLIST ?? "").trim() === "local" &&
  ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname.replace(/^\[|\]$/g, "")) &&
  parsedUrl.protocol.startsWith("postgres") &&
  decodeURIComponent(parsedUrl.username) === "postgres" &&
  (parsedUrl.pathname === "/postgres" || parsedUrl.pathname === "/");

if (!localOnly) {
  console.error(
    "psql não está instalado; o fallback Docker só é permitido para Supabase local explicitamente isolado.",
  );
  process.exit(2);
}

const port = parsedUrl.port || "5432";
let containers;
try {
  const listing = execFileSync(
    "docker",
    ["ps", `--filter=publish=${port}`, "--format={{json .}}"],
    { encoding: "utf8" },
  );
  containers = listing
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(
      (container) =>
        container.State === "running" &&
        container.Names?.startsWith("supabase_db_") &&
        container.Image?.startsWith("public.ecr.aws/supabase/postgres:") &&
        container.Labels?.split(",").some((label) => label.startsWith("com.supabase.cli.project=")),
    );
} catch (error) {
  console.error(
    `Não foi possível localizar o container PostgreSQL local correspondente: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(2);
}

if (containers.length !== 1) {
  console.error(
    `Esperado exatamente um container Supabase PostgreSQL publicando a porta ${port}; encontrados: ${containers.length}.`,
  );
  process.exit(2);
}

console.log("psql do host ausente; executando regressão no container Supabase local validado.");
const sql = readFileSync(sqlFile);
const dockerResult = run(
  "docker",
  [
    "exec",
    "-i",
    containers[0].ID,
    "psql",
    "-U",
    "postgres",
    "-d",
    "postgres",
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "-",
  ],
  { input: sql },
);

process.exit(dockerResult ?? 2);
