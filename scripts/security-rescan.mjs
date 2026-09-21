#!/usr/bin/env node
/**
 * Re-scan de segurança do banco (pós-migrations).
 *
 * Executa um conjunto de checagens SQL contra o Postgres do Supabase e
 * gera um resumo em Markdown. Falha (exit 1) quando houver achados
 * críticos não aceitos em `.security-allowlist.json`.
 *
 * Uso:
 *   SUPABASE_DB_URL=postgres://... node scripts/security-rescan.mjs
 *   node scripts/security-rescan.mjs --out security-report.md
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = outIndex !== -1 ? args[outIndex + 1] : "security-report.md";

const DB_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || "";
if (!DB_URL) {
  console.error(
    "SUPABASE_DB_URL ausente. Configure o secret SUPABASE_DB_URL no repositório para rodar o re-scan.",
  );
  process.exit(2);
}

const allowlistPath = resolve(process.cwd(), ".security-allowlist.json");
const allowlist = existsSync(allowlistPath)
  ? JSON.parse(readFileSync(allowlistPath, "utf8"))
  : { accepted: [] };
const accepted = new Map(
  (allowlist.accepted ?? []).map((item) => [item.id, item.reason ?? "aceito por design"]),
);

function query(sql) {
  const raw = execFileSync(
    "psql",
    [DB_URL, "-X", "-A", "-t", "-F", "\u0001", "--no-psqlrc", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
  );
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
    title: "Tabelas com escrita concedida ao papel anon",
    columns: ["tabela", "privilegio"],
    sql: `select c.relname, p.priv
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          cross join lateral (values ('INSERT'),('UPDATE'),('DELETE')) as p(priv)
          where n.nspname = 'public' and c.relkind = 'r'
            and has_table_privilege('anon', c.oid, p.priv)
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

process.exit(criticalCount > 0 ? 1 : 0);
