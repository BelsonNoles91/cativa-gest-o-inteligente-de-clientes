#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SQL_REGRESSIONS = [
  ["RLS", "supabase/tests/rls-regression.sql"],
  ["IDOR multi-tenant", "supabase/tests/tenant-idor-regression.sql"],
  ["Publicação Realtime", "supabase/tests/realtime-publication-regression.sql"],
  ["Storage e cotas", "supabase/tests/storage-regression.sql"],
  ["Mídia CRM", "supabase/tests/crm-media-rls-matrix.sql"],
  ["Notas de clientes", "supabase/tests/client-notes-rls-regression.sql"],
  ["Escopo da agenda", "supabase/tests/appointment-scope-rls-regression.sql"],
  ["Referências de disponibilidade", "supabase/tests/scheduling-reference-scope-regression.sql"],
  ["Confirmação e portal", "supabase/tests/confirmation-portal-scope-regression.sql"],
  ["Catálogo e CRM", "supabase/tests/catalog-crm-scope-regression.sql"],
  ["Administração e unidades", "supabase/tests/admin-unit-scope-regression.sql"],
  ["Auditoria de referências tenant-aware", "supabase/tests/tenant-reference-catalog-audit.sql"],
  ["Quota Jev", "supabase/tests/retention-advisor-quota-regression.sql"],
  ["Histórico de security scan", "supabase/tests/security-scan-history-regression.sql"],
  ["Assinatura super_admin atômica", "supabase/tests/admin-subscription-atomic-regression.sql"],
  ["Onboarding de tenant atômico", "supabase/tests/atomic-tenant-onboarding-regression.sql"],
  ["Mutações atômicas de catálogo", "supabase/tests/catalog-atomic-mutations-regression.sql"],
  ["Consolidação de nomes de planos", "supabase/tests/plan-name-deduplication-regression.sql"],
];

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function renderJUnitXml({ cases, pending = [], generatedAt = new Date().toISOString(), targetMode = "QA" }) {
  const allCases = [...cases, ...pending.map((name) => ({
    classname: "supabase.sql",
    name,
    timeMs: 0,
    skipped: "not executed because an earlier stage did not complete",
  }))];
  const failures = allCases.filter((testCase) => testCase.failure).length;
  const errors = allCases.filter((testCase) => testCase.error).length;
  const skipped = allCases.filter((testCase) => testCase.skipped).length;
  const timeSeconds = allCases.reduce((total, testCase) => total + (testCase.timeMs ?? 0), 0) / 1000;
  const testcaseXml = allCases.map((testCase) => {
    const attributes = `classname="${xmlEscape(testCase.classname ?? "supabase.sql")}" name="${xmlEscape(testCase.name)}" time="${((testCase.timeMs ?? 0) / 1000).toFixed(3)}"`;
    if (testCase.failure) {
      return `  <testcase ${attributes}><failure type="${xmlEscape(testCase.failure.type)}" message="${xmlEscape(testCase.failure.message)}"/></testcase>`;
    }
    if (testCase.error) {
      return `  <testcase ${attributes}><error type="${xmlEscape(testCase.error.type)}" message="${xmlEscape(testCase.error.message)}"/></testcase>`;
    }
    if (testCase.skipped) {
      return `  <testcase ${attributes}><skipped message="${xmlEscape(testCase.skipped)}"/></testcase>`;
    }
    return `  <testcase ${attributes}/>`;
  }).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="Cativa Supabase SQL regressions" tests="${allCases.length}" failures="${failures}" errors="${errors}" skipped="${skipped}" time="${timeSeconds.toFixed(3)}" timestamp="${xmlEscape(generatedAt)}">`,
    "  <properties>",
    `    <property name="target_mode" value="${xmlEscape(targetMode)}"/>`,
    `    <property name="sql_regressions" value="${SQL_REGRESSIONS.length}"/>`,
    "  </properties>",
    testcaseXml,
    "</testsuite>",
    "",
  ].join("\n");
}

function runNode(args) {
  const startedAt = process.hrtime.bigint();

  return new Promise((resolveResult) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));

    child.once("error", (error) => {
      resolveResult({
        code: null,
        error,
        timeMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      });
    });
    child.once("close", (code, signal) => {
      resolveResult({
        code,
        signal,
        timeMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      });
    });
  });
}

async function main() {
  const reportPath = resolve(
    process.env.E2E_SQL_JUNIT_PATH ?? "e2e/.artifacts-qa/sql-regressions-junit.xml",
  );
  const targetMode = process.env.E2E_LOCAL_SUPABASE === "true"
    ? "local disposable QA"
    : "explicitly configured QA";
  const cases = [];
  const writeReport = (pending = []) => {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, renderJUnitXml({ cases, pending, targetMode }), "utf8");
  };

  const preflight = await runNode(["scripts/e2e-db-target-check.mjs"]);
  if (preflight.error || preflight.code !== 0) {
    cases.push({
      classname: "supabase.preflight",
      name: "QA target guard",
      timeMs: preflight.timeMs,
      error: {
        type: "QATargetGuardError",
        message: preflight.error ? "could not start the QA target guard" : `guard exited with status ${preflight.code}`,
      },
    });
    writeReport(SQL_REGRESSIONS.map(([name]) => name));
    console.error(`SQL regressions aborted by QA target guard. JUnit: ${reportPath}`);
    process.exitCode = 1;
    return;
  }

  cases.push({ classname: "supabase.preflight", name: "QA target guard", timeMs: preflight.timeMs });
  writeReport(SQL_REGRESSIONS.map(([name]) => name));

  let failureCount = 0;
  for (let index = 0; index < SQL_REGRESSIONS.length; index += 1) {
    const [name, file] = SQL_REGRESSIONS[index];
    console.log(`\n[SQL ${index + 1}/${SQL_REGRESSIONS.length}] ${name}`);
    const result = await runNode(["scripts/e2e-run-db-test.mjs", file]);
    if (result.error || result.code !== 0) {
      failureCount += 1;
      cases.push({
        classname: "supabase.sql",
        name,
        timeMs: result.timeMs,
        failure: {
          type: result.error ? "SQLRunnerStartError" : "SQLRegressionFailure",
          message: result.error ? "could not start SQL test runner" : `runner exited with status ${result.code ?? result.signal ?? "unknown"}`,
        },
      });
    } else {
      cases.push({ classname: "supabase.sql", name, timeMs: result.timeMs });
    }

    writeReport(SQL_REGRESSIONS.slice(index + 1).map(([pendingName]) => pendingName));
  }

  const passedCount = SQL_REGRESSIONS.length - failureCount;
  console.log(`\nSQL regression summary: ${passedCount}/${SQL_REGRESSIONS.length} passed, ${failureCount} failed.`);
  console.log(`JUnit report: ${reportPath}`);
  if (failureCount > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
