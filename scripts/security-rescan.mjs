#!/usr/bin/env node
/**
 * Re-scan de segurança do banco (pós-migrations).
 *
 * Executa um conjunto de checagens SQL contra o Postgres do Supabase e
 * gera um resumo em Markdown. Falha (exit 1) quando houver achados
 * críticos não aceitos em `.security-allowlist.json`.
 *
 * Uso (QA local descartável):
 *   SUPABASE_QA_DB_URL=postgres://... E2E_QA_PROJECT_REF=local \
 *     E2E_TARGET_ALLOWLIST=local E2E_LOCAL_SUPABASE=true \
 *     SECURITY_SCAN_PERSIST=0 node scripts/security-rescan.mjs --out /tmp/security-report.md
 *
 * Todo alvo é validado por scripts/e2e-db-target-check.mjs antes da conexão.
 * `DATABASE_URL`/`SUPABASE_DB_URL` genéricos nunca são usados.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = outIndex !== -1 ? args[outIndex + 1] : "security-report.md";

const DB_URL = process.env.SUPABASE_QA_DB_URL?.trim() || "";
if (!DB_URL) {
  console.error(
    "SUPABASE_QA_DB_URL ausente. Informe explicitamente um alvo QA autorizado para rodar o re-scan.",
  );
  process.exit(2);
}

const targetGuard = spawnSync(
  process.execPath,
  [resolve(process.cwd(), "scripts/e2e-db-target-check.mjs")],
  { cwd: process.cwd(), env: process.env, encoding: "utf8" },
);
if (targetGuard?.stdout?.trim()) process.stdout.write(targetGuard.stdout);
if (!targetGuard || targetGuard.error || targetGuard.status !== 0) {
  console.error("Re-scan bloqueado antes da conexão: o alvo QA não passou pelo guard de segurança.");
  if (targetGuard?.stderr?.trim()) console.error(targetGuard.stderr.trim());
  if (targetGuard?.error) console.error("Não foi possível iniciar o guard de alvo QA.");
  process.exit(2);
}

function resolvePsqlTarget() {
  const hostCheck = spawnSync("psql", ["--version"], { encoding: "utf8" });
  if (!hostCheck.error) return { command: "psql", prefix: [DB_URL] };
  if (hostCheck.error.code !== "ENOENT") throw hostCheck.error;

  let databaseUrl;
  try {
    databaseUrl = new URL(DB_URL);
  } catch {
    throw new Error("SUPABASE_DB_URL precisa ser uma URL PostgreSQL válida.");
  }
  const hostname = databaseUrl.hostname.replace(/^\[|\]$/g, "");
  const localOnly =
    process.env.E2E_LOCAL_SUPABASE === "true" &&
    process.env.E2E_QA_PROJECT_REF === "local" &&
    (process.env.E2E_TARGET_ALLOWLIST ?? "").trim() === "local" &&
    ["localhost", "127.0.0.1", "::1"].includes(hostname) &&
    ["postgres:", "postgresql:"].includes(databaseUrl.protocol) &&
    decodeURIComponent(databaseUrl.username) === "postgres" &&
    ["/", "/postgres"].includes(databaseUrl.pathname);
  if (!localOnly) {
    throw new Error(
      "psql não está instalado; o fallback Docker só é permitido para Supabase local explicitamente isolado.",
    );
  }

  const port = databaseUrl.port || "5432";
  const listing = execFileSync(
    "docker",
    ["ps", `--filter=publish=${port}`, "--format={{json .}}"],
    { encoding: "utf8" },
  );
  const containers = listing
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
  if (containers.length !== 1) {
    throw new Error(
      `Esperado exatamente um container Supabase PostgreSQL publicando a porta ${port}; encontrados: ${containers.length}.`,
    );
  }

  console.log("psql do host ausente; varredura limitada ao container Supabase local validado.");
  return {
    command: "docker",
    prefix: ["exec", containers[0].ID, "psql", "-U", "postgres", "-d", "postgres"],
  };
}

const psqlTarget = resolvePsqlTarget();

function runPsql(args) {
  return execFileSync(psqlTarget.command, [...psqlTarget.prefix, ...args], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

const allowlistPath = resolve(process.cwd(), ".security-allowlist.json");
const allowlist = existsSync(allowlistPath)
  ? JSON.parse(readFileSync(allowlistPath, "utf8"))
  : { accepted: [] };
const accepted = new Map(
  (allowlist.accepted ?? []).map((item) => [item.id, item.reason ?? "aceito por design"]),
);

function query(sql) {
  const raw = runPsql([
    "-X",
    "-A",
    "-t",
    "-F",
    "\u0001",
    "--no-psqlrc",
    "-v",
    "ON_ERROR_STOP=1",
    "-c",
    sql,
  ]);
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\u0001"));
}

/** @type {{id: string, severity: "critical"|"warning", title: string, rows: string[][], columns: string[], sql: string}[]} */
const checks = [
  {
    id: "rls_disabled",
    severity: "critical",
    title: "Tabelas públicas sem RLS habilitada",
    columns: ["tabela"],
    sql: `select c.relname
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
          order by 1`,
  },
  {
    id: "rls_without_policies",
    severity: "critical",
    title: "Tabelas com RLS habilitada mas sem nenhuma policy (acesso totalmente bloqueado)",
    columns: ["tabela"],
    sql: `select c.relname
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
            and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
          order by 1`,
  },
  {
    id: "missing_grants",
    severity: "critical",
    title: "Tabelas públicas sem GRANT para authenticated nem service_role",
    columns: ["tabela"],
    sql: `select c.relname
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
            and not has_table_privilege('authenticated', c.oid, 'SELECT')
            and not has_table_privilege('service_role', c.oid, 'SELECT')
          order by 1`,
  },
  {
    id: "anon_writable_tables",
    severity: "critical",
    title: "Tabelas com escrita efetivamente aberta a anon (GRANT + policy permissiva)",
    columns: ["tabela", "policy", "comando"],
    sql: `select c.relname, pol.polname, pol.polcmd::text
          from pg_policy pol
          join pg_class c on c.oid = pol.polrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and pol.polcmd in ('a', 'w', 'd', '*')
            and (pol.polroles = '{0}'::oid[]
                 or exists (select 1 from unnest(pol.polroles) r
                            join pg_roles pr on pr.oid = r where pr.rolname = 'anon'))
            and has_table_privilege('anon', c.oid,
                  case pol.polcmd when 'a' then 'INSERT' when 'w' then 'UPDATE'
                                  when 'd' then 'DELETE' else 'INSERT' end)
          order by 1, 2`,
  },
  {
    id: "anon_readable_policies",
    severity: "warning",
    title: "Policies que expõem leitura a anon/public",
    columns: ["tabela", "policy", "comando"],
    sql: `select c.relname, pol.polname, pol.polcmd::text
          from pg_policy pol
          join pg_class c on c.oid = pol.polrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and (pol.polroles = '{0}'::oid[]
                 or exists (select 1 from unnest(pol.polroles) r
                            join pg_roles pr on pr.oid = r where pr.rolname = 'anon'))
          order by 1, 2`,
  },
  {
    id: "definer_without_search_path",
    severity: "critical",
    title: "Funções SECURITY DEFINER sem search_path fixo",
    columns: ["funcao"],
    sql: `select p.proname
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.prosecdef
            and (p.proconfig is null
                 or not exists (select 1 from unnest(p.proconfig) cfg where cfg like 'search_path=%'))
          order by 1`,
  },
  {
    id: "public_storage_buckets",
    severity: "warning",
    title: "Buckets de storage públicos",
    columns: ["bucket"],
    sql: `select id from storage.buckets where public order by 1`,
  },
];

const results = [];
let criticalCount = 0;
let warningCount = 0;
let acceptedCount = 0;

for (const check of checks) {
  let rows = [];
  try {
    rows = query(check.sql);
  } catch (error) {
    results.push({
      ...check,
      error: error instanceof Error ? error.message : String(error),
      rows: [],
    });
    continue;
  }

  const findings = rows.map((row) => {
    const id = `${check.id}:${row[0]}`;
    const isAccepted = accepted.has(id) || accepted.has(check.id);
    if (isAccepted) acceptedCount++;
    else if (check.severity === "critical") criticalCount++;
    else warningCount++;
    return { row, accepted: isAccepted, reason: accepted.get(id) ?? accepted.get(check.id) };
  });

  results.push({ ...check, findings });
}

const lines = [];
lines.push("## Re-scan de segurança do banco");
lines.push("");
lines.push(
  criticalCount === 0
    ? `Achados críticos: **0** · avisos: **${warningCount}** · aceitos: **${acceptedCount}**`
    : `Achados críticos: **${criticalCount}** · avisos: **${warningCount}** · aceitos: **${acceptedCount}**`,
);
lines.push("");

for (const check of results) {
  if (check.error) {
    lines.push(`### ⚠️ ${check.title}`);
    lines.push("");
    lines.push("Não foi possível executar a checagem:");
    lines.push("");
    lines.push("```");
    lines.push(check.error.trim().split("\n").slice(-5).join("\n"));
    lines.push("```");
    lines.push("");
    continue;
  }

  const open = check.findings.filter((f) => !f.accepted);
  const ok = open.length === 0;
  const icon = ok ? "✅" : check.severity === "critical" ? "❌" : "⚠️";
  lines.push(`### ${icon} ${check.title}`);
  lines.push("");
  if (check.findings.length === 0) {
    lines.push("Nenhum achado.");
  } else {
    lines.push(`| ${check.columns.join(" | ")} | status |`);
    lines.push(`| ${check.columns.map(() => "---").join(" | ")} | --- |`);
    for (const f of check.findings) {
      const status = f.accepted ? `aceito — ${f.reason}` : check.severity;
      lines.push(`| ${f.row.join(" | ")} | ${status} |`);
    }
  }
  lines.push("");
}

if (criticalCount > 0) {
  lines.push(
    "> Corrija os achados críticos com uma nova migration ou registre-os em `.security-allowlist.json` com justificativa.",
  );
  lines.push("");
}

const report = lines.join("\n");
writeFileSync(resolve(process.cwd(), outFile), report, "utf8");
console.log(report);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`, "utf8");
}

// --- Histórico: grava a execução no banco (tabelas security_scans/_findings) ---
function exec(sql) {
  runPsql(["-X", "-q", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-c", sql]);
}

function quote(value) {
  if (value === null || value === undefined || value === "") return "null";
  return `$sec$${String(value)}$sec$`;
}

if (process.env.SECURITY_SCAN_PERSIST !== "0") {
  try {
    const migrations = (process.env.SECURITY_SCAN_MIGRATIONS || "")
      .split(/[\n,]/)
      .map((m) => m.trim())
      .filter(Boolean);
    const payload = {
      source: process.env.GITHUB_ACTIONS ? "ci" : "local",
      git_ref: process.env.GITHUB_REF_NAME || null,
      git_sha: process.env.GITHUB_SHA || null,
      pull_request: process.env.SECURITY_SCAN_PR ? Number(process.env.SECURITY_SCAN_PR) : null,
      migrations,
      critical_count: criticalCount,
      warning_count: warningCount,
      accepted_count: acceptedCount,
      findings: results.flatMap((check) =>
        (check.findings ?? []).map((f) => ({
          check_id: check.id,
          title: check.title,
          severity: check.severity,
          object_name: f.row[0] ?? "",
          details: Object.fromEntries(check.columns.map((c, i) => [c, f.row[i] ?? null])),
          accepted: f.accepted,
          accepted_reason: f.reason ?? null,
        })),
      ),
    };

    exec(`
      with payload as (select ${quote(JSON.stringify(payload))}::jsonb as j),
      ins as (
        insert into public.security_scans
          (source, git_ref, git_sha, pull_request, migrations, critical_count, warning_count, accepted_count, report_md)
        select j->>'source', j->>'git_ref', j->>'git_sha',
               nullif(j->>'pull_request','')::int,
               coalesce(array(select jsonb_array_elements_text(j->'migrations')), '{}'),
               (j->>'critical_count')::int, (j->>'warning_count')::int, (j->>'accepted_count')::int,
               ${quote(report)}
        from payload
        returning id
      )
      insert into public.security_scan_findings
        (scan_id, check_id, title, severity, object_name, details, accepted, accepted_reason)
      select ins.id, f->>'check_id', f->>'title', f->>'severity', f->>'object_name',
             coalesce(f->'details','{}'::jsonb), (f->>'accepted')::boolean, f->>'accepted_reason'
      from ins, payload, jsonb_array_elements(payload.j->'findings') f;
    `);
    console.log("Histórico de scan gravado em public.security_scans.");
  } catch (error) {
    console.warn(
      `Não foi possível gravar o histórico do scan: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

process.exit(criticalCount > 0 ? 1 : 0);
