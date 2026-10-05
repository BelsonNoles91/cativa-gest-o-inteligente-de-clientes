import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const projectRoot = resolve(process.cwd());
const rescanScript = resolve(projectRoot, "scripts/security-rescan.mjs");

function cleanEnvironment(overrides = {}) {
  const env = { ...process.env };
  for (const key of [
    "DATABASE_URL",
    "SUPABASE_DB_URL",
    "SUPABASE_QA_DB_URL",
    "E2E_QA_PROJECT_REF",
    "E2E_TARGET_ALLOWLIST",
    "E2E_PROTECTED_PROJECT_REFS",
    "E2E_LOCAL_SUPABASE",
    "SECURITY_SCAN_PERSIST",
  ]) {
    delete env[key];
  }
  return { ...env, ...overrides };
}

function runWithoutDatabaseConnection(env) {
  const temporaryDir = mkdtempSync(join(tmpdir(), "cativa-security-rescan-guard-"));
  const reportPath = join(temporaryDir, "report.md");
  try {
    const result = spawnSync(
      process.execPath,
      [rescanScript, "--out", reportPath],
      { cwd: projectRoot, env, encoding: "utf8", timeout: 10_000 },
    );
    return {
      result,
      reportCreated: existsSync(reportPath),
      output: `${result?.stdout ?? ""}\n${result?.stderr ?? ""}`,
    };
  } finally {
    rmSync(temporaryDir, { recursive: true, force: true });
  }
}

test("requires the explicit QA URL; ignores generic database URL variables", () => {
  const { result, reportCreated, output } = runWithoutDatabaseConnection(
    cleanEnvironment({
      SUPABASE_DB_URL:
        "postgresql://postgres:synthetic@db.uqskxftzmjsumykpkwus.supabase.co:5432/postgres",
      DATABASE_URL:
        "postgresql://postgres:synthetic@db.pegvtrvqdvzxysndddts.supabase.co:5432/postgres",
    }),
  );

  assert.equal(result?.status, 2);
  assert.match(output, /SUPABASE_QA_DB_URL ausente/);
  assert.equal(reportCreated, false);
});

test("blocks protected Supabase project refs before connecting or persisting", () => {
  const protectedRef = "uqskxftzmjsumykpkwus";
  const { result, reportCreated, output } = runWithoutDatabaseConnection(
    cleanEnvironment({
      SUPABASE_QA_DB_URL: `postgresql://postgres:synthetic@db.${protectedRef}.supabase.co:5432/postgres`,
      E2E_QA_PROJECT_REF: protectedRef,
      E2E_TARGET_ALLOWLIST: protectedRef,
      SECURITY_SCAN_PERSIST: "1",
    }),
  );

  assert.equal(result?.status, 2);
  assert.match(output, /Execução SQL destrutiva bloqueada/);
  assert.equal(reportCreated, false);
});

test("rejects non-loopback hosts even with the local-only allowlist", () => {
  const { result, reportCreated, output } = runWithoutDatabaseConnection(
    cleanEnvironment({
      SUPABASE_QA_DB_URL:
        "postgresql://postgres:synthetic@qa-database.example.invalid:5432/postgres",
      E2E_QA_PROJECT_REF: "local",
      E2E_TARGET_ALLOWLIST: "local",
      E2E_LOCAL_SUPABASE: "true",
    }),
  );

  assert.equal(result?.status, 2);
  assert.match(output, /somente um host localhost\/loopback/);
  assert.equal(reportCreated, false);
});
