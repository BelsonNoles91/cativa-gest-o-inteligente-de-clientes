import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getDestructiveE2ESkipReason,
  getE2ECredentialsSkipReason,
} from "../../e2e/_helpers/qaTarget";

const guardPath = resolve(process.cwd(), "scripts/e2e-target-check.mjs");
const dbGuardPath = resolve(process.cwd(), "scripts/e2e-db-target-check.mjs");
const localFixtureProvisionerPath = resolve(process.cwd(), "scripts/e2e-provision-local-fixtures.mjs");

function runGuard(projectRef: string, options: { destructive?: boolean; qaRef?: string; allowlist?: string } = {}) {
  const env = {
    PATH: process.env.PATH,
    VITE_SUPABASE_URL: `https://${projectRef}.supabase.co`,
    ...(options.destructive ? { E2E_DESTRUCTIVE: "true" } : {}),
    ...(options.qaRef ? { E2E_QA_PROJECT_REF: options.qaRef } : {}),
    ...(options.allowlist ? { E2E_TARGET_ALLOWLIST: options.allowlist } : {}),
  };
  return spawnSync(process.execPath, [guardPath], { encoding: "utf8", env });
}

function runLocalGuard(
  url: string,
  options: { destructive?: boolean; qaRef?: string; allowlist?: string } = {},
) {
  return spawnSync(process.execPath, [guardPath, ...(options.destructive ? ["--destructive"] : [])], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      VITE_SUPABASE_URL: url,
      E2E_LOCAL_SUPABASE: "true",
      ...(options.qaRef ? { E2E_QA_PROJECT_REF: options.qaRef } : {}),
      ...(options.allowlist ? { E2E_TARGET_ALLOWLIST: options.allowlist } : {}),
    },
  });
}

function runLocalFixtureProvisionerGuard(url: string, localMode: boolean) {
  return spawnSync(process.execPath, [localFixtureProvisionerPath], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SUPABASE_URL: url,
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-test-only-key",
      GITHUB_ENV: "/dev/null",
      E2E_LOCAL_SUPABASE: localMode ? "true" : "false",
      E2E_QA_PROJECT_REF: "local",
      E2E_TARGET_ALLOWLIST: "local",
    },
  });
}

function runDbGuard(databaseUrl: string, qaRef: string, allowlist = qaRef, local = false) {
  return spawnSync(process.execPath, [dbGuardPath], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SUPABASE_QA_DB_URL: databaseUrl,
      E2E_QA_PROJECT_REF: qaRef,
      E2E_TARGET_ALLOWLIST: allowlist,
      ...(local ? { E2E_LOCAL_SUPABASE: "true" } : {}),
    },
  });
}

describe("guard do alvo Supabase E2E", () => {
  it("permite execução destrutiva somente para projeto QA explícito e não protegido", () => {
    expect(getDestructiveE2ESkipReason({
      VITE_SUPABASE_URL: "https://isolated-qa-project.supabase.co",
      E2E_QA_PROJECT_REF: "isolated-qa-project",
      E2E_TARGET_ALLOWLIST: "isolated-qa-project",
    })).toBeUndefined();

    expect(getDestructiveE2ESkipReason({
      VITE_SUPABASE_URL: "https://uqskxftzmjsumykpkwus.supabase.co",
      E2E_QA_PROJECT_REF: "uqskxftzmjsumykpkwus",
      E2E_TARGET_ALLOWLIST: "uqskxftzmjsumykpkwus",
    })).toMatch(/protegido/i);
    expect(getDestructiveE2ESkipReason({
      VITE_SUPABASE_URL: "https://pegvtrvqdvzxysndddts.supabase.co",
      E2E_QA_PROJECT_REF: "pegvtrvqdvzxysndddts",
      E2E_TARGET_ALLOWLIST: "pegvtrvqdvzxysndddts",
    })).toMatch(/protegido/i);
  });

  it("permite escrita só na instância local explicitamente isolada", () => {
    expect(getDestructiveE2ESkipReason({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      E2E_LOCAL_SUPABASE: "true",
      E2E_QA_PROJECT_REF: "local",
      E2E_TARGET_ALLOWLIST: "local",
    })).toBeUndefined();

    expect(getDestructiveE2ESkipReason({
      VITE_SUPABASE_URL: "https://uqskxftzmjsumykpkwus.supabase.co",
      E2E_LOCAL_SUPABASE: "true",
      E2E_QA_PROJECT_REF: "local",
      E2E_TARGET_ALLOWLIST: "local",
    })).toMatch(/localhost\/loopback/i);

    expect(getDestructiveE2ESkipReason({
      VITE_SUPABASE_URL: "http://127.0.0.1:54321",
      E2E_LOCAL_SUPABASE: "true",
      E2E_QA_PROJECT_REF: "local",
      E2E_TARGET_ALLOWLIST: "local,uqskxftzmjsumykpkwus",
    })).toMatch(/exclusivamente local/i);

    expect(getDestructiveE2ESkipReason({
      VITE_SUPABASE_URL: "http://[::1]:54321",
      E2E_LOCAL_SUPABASE: "true",
      E2E_QA_PROJECT_REF: "local",
      E2E_TARGET_ALLOWLIST: "local",
    })).toBeUndefined();
    expect(getDestructiveE2ESkipReason({
      VITE_SUPABASE_URL: "http://user:pass@localhost:54321",
      E2E_LOCAL_SUPABASE: "true",
      E2E_QA_PROJECT_REF: "local",
      E2E_TARGET_ALLOWLIST: "local",
    })).toMatch(/sem credenciais/i);

    expect(runLocalGuard("http://localhost:54321", {
      destructive: true,
      qaRef: "local",
      allowlist: "local",
    }).status).toBe(0);
    expect(runLocalGuard("http://[::1]:54321", {
      destructive: true,
      qaRef: "local",
      allowlist: "local",
    }).status).toBe(0);
    expect(runLocalGuard("http://127.0.0.1:54321", {
      destructive: true,
      qaRef: "local",
      allowlist: "local,uqskxftzmjsumykpkwus",
    }).status).not.toBe(0);
    expect(runLocalGuard("https://uqskxftzmjsumykpkwus.supabase.co", {
      destructive: true,
      qaRef: "local",
      allowlist: "local",
    }).status).not.toBe(0);

    const remoteProvision = runLocalFixtureProvisionerGuard(
      "https://uqskxftzmjsumykpkwus.supabase.co",
      true,
    );
    expect(remoteProvision.status).not.toBe(0);
    expect(remoteProvision.stderr).toMatch(/loopback/i);

    const unmarkedProvision = runLocalFixtureProvisionerGuard("http://127.0.0.1:1", false);
    expect(unmarkedProvision.status).not.toBe(0);
    expect(unmarkedProvision.stderr).toMatch(/Provisionamento fictício bloqueado/i);
  });

  it("bloqueia alvo sem allowlist, URL divergente, HTTP ou hostname enganoso", () => {
    const base = {
      E2E_QA_PROJECT_REF: "isolated-qa-project",
      E2E_TARGET_ALLOWLIST: "isolated-qa-project",
    };
    expect(getDestructiveE2ESkipReason({
      ...base,
      VITE_SUPABASE_URL: "http://isolated-qa-project.supabase.co",
    })).toMatch(/HTTPS/);
    expect(getDestructiveE2ESkipReason({
      ...base,
      VITE_SUPABASE_URL: "https://another-project.supabase.co",
    })).toMatch(/não corresponde/i);
    expect(getDestructiveE2ESkipReason({
      ...base,
      VITE_SUPABASE_URL: "https://isolated-qa-project.supabase.co.attacker.example",
    })).toMatch(/diretamente/i);
    expect(getDestructiveE2ESkipReason({
      ...base,
      E2E_TARGET_ALLOWLIST: "",
      VITE_SUPABASE_URL: "https://isolated-qa-project.supabase.co",
    })).toMatch(/ALLOWLIST/);
  });

  it("exige credenciais E2E fornecidas explicitamente", () => {
    expect(getE2ECredentialsSkipReason({})).toMatch(/E2E_USER\/E2E_PASS/);
    expect(getE2ECredentialsSkipReason({ E2E_USER: "qa@example.test" })).toMatch(/E2E_USER\/E2E_PASS/);
    expect(getE2ECredentialsSkipReason({ E2E_USER: " ", E2E_PASS: " " })).toMatch(/E2E_USER\/E2E_PASS/);
    expect(getE2ECredentialsSkipReason({ E2E_USER: "qa@example.test", E2E_PASS: "synthetic-secret" })).toBeUndefined();
  });

  it("permite smoke no projeto protegido sem autorizar mutações", () => {
    const result = runGuard("uqskxftzmjsumykpkwus");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("smoke seguro");
  });

  it("bloqueia operação destrutiva mesmo quando o projeto protegido é declarado como QA", () => {
    const result = runGuard("uqskxftzmjsumykpkwus", {
      destructive: true,
      qaRef: "uqskxftzmjsumykpkwus",
      allowlist: "uqskxftzmjsumykpkwus",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("projeto protegido");

    const managedBackend = runGuard("pegvtrvqdvzxysndddts", {
      destructive: true,
      qaRef: "pegvtrvqdvzxysndddts",
      allowlist: "pegvtrvqdvzxysndddts",
    });
    expect(managedBackend.status).not.toBe(0);
    expect(managedBackend.stderr).toContain("projeto protegido");
  });

  it("permite mutações somente quando ref QA e allowlist nomeiam o mesmo projeto isolado", () => {
    const result = runGuard("isolated-qa-project", {
      destructive: true,
      qaRef: "isolated-qa-project",
      allowlist: "isolated-qa-project",
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("destrutivo/QA");
  });

  it("exige uma referência QA e correspondência exata com o alvo", () => {
    const missingQa = runGuard("pegvtrvqdvzxysndddts", { destructive: true });
    expect(missingQa.status).not.toBe(0);
    expect(missingQa.stderr).toContain("E2E_QA_PROJECT_REF");

    const mismatch = runGuard("pegvtrvqdvzxysndddts", {
      destructive: true,
      qaRef: "another-qa-project",
    });
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toContain("devem usar o projeto QA");

    const noExplicitAllowlist = runGuard("isolated-qa-project", {
      destructive: true,
      qaRef: "isolated-qa-project",
    });
    expect(noExplicitAllowlist.status).not.toBe(0);
    expect(noExplicitAllowlist.stderr).toContain("E2E_TARGET_ALLOWLIST explícita");
  });

  it("bloqueia qualquer alvo não listado explicitamente", () => {
    const result = runGuard("isolated-qa-project", {
      destructive: true,
      qaRef: "isolated-qa-project",
      allowlist: "another-qa-project",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("não permitido");

    const deceptiveHost = spawnSync(process.execPath, [guardPath], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        VITE_SUPABASE_URL: "https://uqskxftzmjsumykpkwus.supabase.co.attacker.example",
      },
    });
    expect(deceptiveHost.status).not.toBe(0);
    expect(deceptiveHost.stderr).toContain("apontar diretamente");
  });

  it("valida ref QA em URL direta e conexão pooler sem imprimir credenciais", () => {
    const direct = runDbGuard(
      "postgres://postgres:secret@db.qa-project-123.supabase.co:5432/postgres",
      "qa-project-123",
    );
    expect(direct.status).toBe(0);
    expect(direct.stdout).toContain("qa-project-123");
    expect(direct.stdout).not.toContain("secret");

    const pooler = runDbGuard(
      "postgres://postgres.qa-project-123:secret@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      "qa-project-123",
    );
    expect(pooler.status).toBe(0);
    expect(pooler.stdout).not.toContain("secret");
  });

  it("bloqueia DB URL com ref divergente, protegido ou não allowlisted", () => {
    const mismatch = runDbGuard(
      "postgres://postgres:secret@db.project-a.supabase.co:5432/postgres",
      "project-b",
    );
    expect(mismatch.status).not.toBe(0);
    expect(mismatch.stderr).toContain("não corresponde");

    const protectedTarget = runDbGuard(
      "postgres://postgres:secret@db.uqskxftzmjsumykpkwus.supabase.co:5432/postgres",
      "uqskxftzmjsumykpkwus",
    );
    expect(protectedTarget.status).not.toBe(0);
    expect(protectedTarget.stderr).toContain("projeto protegido");

    const managedBackend = runDbGuard(
      "postgres://postgres:secret@db.pegvtrvqdvzxysndddts.supabase.co:5432/postgres",
      "pegvtrvqdvzxysndddts",
    );
    expect(managedBackend.status).not.toBe(0);
    expect(managedBackend.stderr).toContain("projeto protegido");

    const notAllowed = runDbGuard(
      "postgres://postgres:secret@db.qa-project-123.supabase.co:5432/postgres",
      "qa-project-123",
      "other-project",
    );
    expect(notAllowed.status).not.toBe(0);
    expect(notAllowed.stderr).toContain("não permitido");

    const deceptivePooler = runDbGuard(
      "postgres://postgres.qa-project-123:secret@attacker.example:6543/postgres",
      "qa-project-123",
    );
    expect(deceptivePooler.status).not.toBe(0);
    expect(deceptivePooler.stderr).toContain("Não foi possível identificar");
  });

  it("permite testes SQL destrutivos somente em Supabase local explicitamente isolado", () => {
    const local = runDbGuard(
      "postgresql://postgres:local-secret@127.0.0.1:56202/postgres",
      "local",
      "local",
      true,
    );
    expect(local.status).toBe(0);
    expect(local.stdout).toContain("local descartável");
    expect(local.stdout).not.toContain("local-secret");

    const remoteHost = runDbGuard(
      "postgresql://postgres:secret@db.qa-project.supabase.co:5432/postgres",
      "local",
      "local",
      true,
    );
    expect(remoteHost.status).not.toBe(0);
    expect(remoteHost.stderr).toContain("localhost/loopback");

    const expandedAllowlist = runDbGuard(
      "postgresql://postgres:local-secret@127.0.0.1:56202/postgres",
      "local",
      "local,uqskxftzmjsumykpkwus",
      true,
    );
    expect(expandedAllowlist.status).not.toBe(0);
    expect(expandedAllowlist.stderr).toContain("E2E_TARGET_ALLOWLIST=local");
  });
});
