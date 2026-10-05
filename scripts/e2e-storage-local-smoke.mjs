#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, delimiter, join, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (!Number.isInteger(nodeMajor) || nodeMajor < 22) {
  throw new Error(
    "Node.js 22+ é obrigatório para os testes Supabase locais; versão atual: " +
      process.versions.node +
      ".",
  );
}

function parseCliEnv(source) {
  const values = new Map();
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    const separator = line.indexOf("=");
    if (!line || line.startsWith("#") || separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        value = value.slice(1, -1);
      }
    } else if (value.charCodeAt(0) === 39 && value.charCodeAt(value.length - 1) === 39) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function cliValue(values, ...keys) {
  for (const key of keys) {
    const value = values.get(key)?.trim();
    if (value) return value;
  }
  throw new Error(`Supabase CLI não retornou ${keys.join("/")}.`);
}

function ensureSuccess(result, action) {
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${action} terminou com código ${result.status ?? "desconhecido"}.`);
}

async function listAuthUsers(admin) {
  const users = [];
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`Não foi possível inspecionar usuários QA: ${error.message}`);
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < 200) return users;
  }
  throw new Error("Paginação de usuários excedeu o limite defensivo de 100 páginas.");
}

async function listObjectPaths(admin, bucket, prefix) {
  const { data, error } = await admin.storage.from(bucket).list(prefix, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (error) throw new Error(`Não foi possível listar o prefixo sintético ${bucket}/${prefix}: ${error.message}`);

  const paths = [];
  for (const entry of data ?? []) {
    const path = `${prefix}/${entry.name}`;
    if (entry.id === null) paths.push(...(await listObjectPaths(admin, bucket, path)));
    else paths.push(path);
  }
  return paths;
}

async function cleanupFixtures(admin, manifestPath, slugs, fixtureEmails) {
  const failures = [];
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    // The fixture provider can fail partway through creation. The caller
    // refuses pre-existing fixture identities, so exact slugs/emails remain
    // a safe fallback for cleanup of this isolated local run.
  }

  const tenantIds = (manifest?.tenants ?? []).map((tenant) => tenant.id).filter(Boolean);
  const existingTenants = await admin.from("tenants").select("id, slug").in("slug", slugs);
  if (existingTenants.error) failures.push(`consulta tenants: ${existingTenants.error.message}`);
  else {
    for (const tenant of existingTenants.data ?? []) {
      if (tenantIds.length === 0 || tenantIds.includes(tenant.id)) tenantIds.push(tenant.id);
    }
  }
  const uniqueTenantIds = [...new Set(tenantIds)];

  for (const tenantId of uniqueTenantIds) {
    for (const bucket of ["client-media", "tenant-logos"]) {
      try {
        const paths = await listObjectPaths(admin, bucket, tenantId);
        if (paths.length > 0) {
          const { error } = await admin.storage.from(bucket).remove(paths);
          if (error) failures.push(`limpeza ${bucket}/${tenantId}: ${error.message}`);
        }
      } catch (error) {
        failures.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  if (uniqueTenantIds.length > 0) {
    const { error } = await admin.from("tenants").delete().in("id", uniqueTenantIds);
    if (error) failures.push(`remoção dos tenants QA: ${error.message}`);
  }

  try {
    const users = await listAuthUsers(admin);
    const userIds = new Set([
      ...(manifest?.tenants ?? []).flatMap((tenant) => (tenant.accounts ?? []).map((account) => account.id)),
      manifest?.superAdmin?.id,
      manifest?.pendingInvitee?.id,
    ].filter(Boolean));
    const exactFixtureUsers = users.filter((user) => {
      const email = user.email?.toLowerCase() ?? "";
      return userIds.has(user.id) || fixtureEmails.has(email);
    });
    for (const user of exactFixtureUsers) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) failures.push(`remoção do usuário sintético ${user.email}: ${error.message}`);
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  if (failures.length > 0) throw new Error(`Limpeza QA local incompleta: ${failures.join("; ")}`);
}

async function getAvailableLoopbackPort() {
  const server = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(0, "127.0.0.1", resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Não foi possível reservar uma porta local para o E2E do portal.");
  }
  const { port } = address;
  await new Promise((resolvePromise, rejectPromise) => {
    server.close((error) => error ? rejectPromise(error) : resolvePromise());
  });
  return port;
}

async function waitForLocalServer(url, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
      throw new Error("Servidor Vite QA encerrou antes de aceitar conexões.");
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite may need a moment to start after the process is spawned.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  throw new Error("Servidor Vite QA não iniciou dentro de 30 segundos.");
}

async function stopLocalServer(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise((resolvePromise) => child.once("exit", resolvePromise));
  child.kill("SIGTERM");
  const forceKill = setTimeout(() => {
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }, 5_000);
  forceKill.unref();
  await exited;
  clearTimeout(forceKill);
}

async function main() {
  const workdir = process.env.SUPABASE_CLI_WORKDIR?.trim();
  if (!workdir) throw new Error("Defina SUPABASE_CLI_WORKDIR para a pasta da instância QA local descartável.");

  const status = spawnSync("supabase", ["status", "-o", "env", "--workdir", workdir], { encoding: "utf8" });
  ensureSuccess(status, "Supabase CLI status");
  const values = parseCliEnv(status.stdout);
  const supabaseUrl = cliValue(values, "API_URL", "SUPABASE_URL");
  const publishableKey = cliValue(values, "PUBLISHABLE_KEY", "SUPABASE_PUBLISHABLE_KEY", "ANON_KEY", "SUPABASE_ANON_KEY");
  const serviceRoleKey = cliValue(values, "SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SECRET_KEY");
  const databaseUrl = cliValue(values, "DB_URL", "SUPABASE_DB_URL");

  const api = new URL(supabaseUrl);
  const database = new URL(databaseUrl);
  const loopback = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    api.protocol !== "http:" || !loopback.has(api.hostname.replace(/^\[|\]$/g, "")) ||
    !["postgres:", "postgresql:"].includes(database.protocol) ||
    !loopback.has(database.hostname.replace(/^\[|\]$/g, ""))
  ) {
    throw new Error("Teste Storage recusado: o Supabase CLI não aponta para uma instância local/loopback.");
  }

  const fixtureSuffix = randomBytes(6).toString("hex");
  const tenantASlug = `studio-teste-qa-${fixtureSuffix}`;
  const tenantBSlug = `studio-teste-qa-b-${fixtureSuffix}`;
  const slugs = [tenantASlug, tenantBSlug];
  const fixtureEmails = new Set([
    `super-admin.${tenantASlug}@cativa.test`,
    `owner.${tenantASlug}@cativa.test`,
    `owner.${tenantBSlug}@cativa.test`,
    `manager.${tenantASlug}@cativa.test`,
    `frontdesk.${tenantASlug}@cativa.test`,
    `professional.${tenantASlug}@cativa.test`,
    `client.${tenantASlug}@cativa.test`,
    `invitee.${tenantASlug}@cativa.test`,
  ]);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const priorTenants = await admin.from("tenants").select("id, slug").in("slug", slugs);
  if (priorTenants.error) throw new Error(`Falha na pré-checagem dos tenants QA: ${priorTenants.error.message}`);
  const priorUsers = await listAuthUsers(admin);
  const collision = priorTenants.data?.length || priorUsers.some((user) => fixtureEmails.has(user.email?.toLowerCase() ?? ""));
  if (collision) {
    throw new Error("Fixtures locais preexistentes detectadas; nada foi alterado. Limpe-as ou use outra instância descartável.");
  }

  const tempDir = mkdtempSync(join(tmpdir(), "cativa-storage-local-"));
  const githubEnv = join(tempDir, "github-env");
  writeFileSync(githubEnv, "", { mode: 0o600 });
  const runStartedAt = new Date().toISOString();
  const baseEnv = {
    ...process.env,
    PATH: [join(process.cwd(), "node_modules", ".bin"), process.env.PATH]
      .filter(Boolean)
      .join(delimiter),
    SUPABASE_CLI_WORKDIR: workdir,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
    SUPABASE_DB_URL: databaseUrl,
    SUPABASE_QA_DB_URL: databaseUrl,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    GITHUB_ENV: githubEnv,
    E2E_LOCAL_SUPABASE: "true",
    E2E_QA_PROJECT_REF: "local",
    E2E_TARGET_ALLOWLIST: "local",
    E2E_DESTRUCTIVE: "true",
    E2E_LOCAL_FIXTURE_SUFFIX: fixtureSuffix,
  };

  const createdByThisRun = (result, action) => {
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`${action} falhou (código ${result.status ?? "desconhecido"}).`);
  };

  let testError;
  let manifestPath = "";
  try {
    console.log(`Alvo Storage: Supabase local descartável (${api.origin}); contas e objetos sintéticos serão removidos ao final.`);
    const provision = spawnSync("npm", ["run", "test:qa:provision:local"], {
      cwd: process.cwd(),
      env: baseEnv,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    // The provisioner emits GitHub mask directives containing generated
    // passwords. Keep all its stdout/stderr in memory and never print it.
    const exported = parseCliEnv(readFileSync(githubEnv, "utf8"));
    manifestPath = exported.get("E2E_FIXTURE_MANIFEST") ?? "";
    if (provision.error || provision.status !== 0) {
      const safeLog = [provision.stdout, provision.stderr]
        .join("\n")
        .split(/\r?\n/)
        .filter((line) => !line.startsWith("::add-mask::") && !/^(E2E_|SUPABASE_|VITE_)[A-Z0-9_]*=/.test(line))
        .join("\n")
        .trim()
        .slice(-2000);
      throw new Error(
        `Provisionamento de perfis sintéticos falhou (código ${provision.status ?? provision.error?.code ?? "desconhecido"}).${safeLog ? ` ${safeLog}` : ""}`,
      );
    }
    if (!manifestPath || !basename(manifestPath).startsWith("local-fixtures-")) {
      throw new Error("O provisionamento local não gerou o manifesto de fixtures esperado.");
    }

    const storageEnv = {
      ...baseEnv,
      ...Object.fromEntries(exported),
      SUPABASE_URL: supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      SUPABASE_QA_DB_URL: databaseUrl,
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
      E2E_LOCAL_SUPABASE: "true",
      E2E_QA_PROJECT_REF: "local",
      E2E_TARGET_ALLOWLIST: "local",
      E2E_DESTRUCTIVE: "true",
      E2E_STORAGE_STATE_PATH: join(tempDir, "owner-storage-state.json"),
      PW_OUTPUT_DIR: process.env.PW_OUTPUT_DIR?.trim()
        || join(process.cwd(), "e2e", `.artifacts-local-${fixtureSuffix}`),
      PW_REPORT_DIR: process.env.PW_REPORT_DIR?.trim()
        || join(process.cwd(), "e2e", `.report-local-${fixtureSuffix}`),
    };
    const roleCheck = spawnSync("node", ["scripts/e2e-role-check.mjs"], {
      cwd: process.cwd(),
      env: storageEnv,
      stdio: "inherit",
    });
    createdByThisRun(roleCheck, "Validação de login dos perfis QA locais");

    if (process.env.E2E_RUN_EXTENDED_LOCAL_E2E === "true") {
      console.log("Jornadas E2E locais ampliadas: onboarding, papéis, limites, assinatura, UX e portal.");
      const extendedArtifactRoot = process.env.PW_EXTENDED_OUTPUT_DIR?.trim()
        || mkdtempSync(join(tmpdir(), "cativa-e2e-extended-"));
      const extendedEnv = {
        ...storageEnv,
        E2E_ONBOARDING_PASS: exported.get("E2E_PASS") ?? "",
      };
      // Root-config E2E starts Vite itself on port 8080. Do not build into the
      // checkout's dist directory; portal journeys use an isolated preview
      // from a temporary build below.
      delete extendedEnv.E2E_BASE_URL;

      const bootstrap = spawnSync("npm", ["run", "test:auth:bootstrap"], {
        cwd: process.cwd(),
        env: extendedEnv,
        stdio: "inherit",
      });
      createdByThisRun(bootstrap, "Bootstrap autenticado das jornadas ampliadas");

      const profileJourneys = spawnSync("playwright", [
        "test",
        "-c",
        "playwright.config.ts",
        "e2e/multi-role-flow.spec.ts",
        "e2e/subscription-blocker.spec.ts",
        "e2e/trial-limits-feature-flags.spec.ts",
        "e2e/ux-responsiveness.spec.ts",
        "--project=iphone-14-portrait",
        "--workers",
        "1",
      ], {
        cwd: process.cwd(),
        env: {
          ...extendedEnv,
          PW_OUTPUT_DIR: join(extendedArtifactRoot, "profiles"),
          PW_REPORT_DIR: join(extendedArtifactRoot, "profiles-report"),
        },
        stdio: "inherit",
      });
      createdByThisRun(profileJourneys, "Jornadas E2E de perfil, onboarding, plano, assinatura e UX");

      // O resumo do onboarding é exercitado em viewports isolados. Redimensionar
      // o mesmo contexto autenticado durante o signup pode desalinhar o viewport
      // visual mobile e impedir o toque real no CTA final.
      const onboardingJourneys = spawnSync("playwright", [
        "test",
        "-c",
        "playwright.config.ts",
        "e2e/onboarding-flow.spec.ts",
        "--project=iphone-14-portrait",
        "--project=iphone-se",
        "--project=android-360-portrait",
        "--project=mobile-320-portrait",
        "--project=ipad-portrait",
        "--workers",
        "1",
      ], {
        cwd: process.cwd(),
        env: {
          ...extendedEnv,
          PW_OUTPUT_DIR: join(extendedArtifactRoot, "onboarding"),
          PW_REPORT_DIR: join(extendedArtifactRoot, "onboarding-report"),
        },
        stdio: "inherit",
      });
      createdByThisRun(onboardingJourneys, "Onboarding funcional em mobile, tablet e larguras estreitas");

      // A matriz de entitlements faz repetidos deep-links e restaura
      // assinaturas sintéticas. WebKit headless Linux tem encerrado seu
      // processo de rede nesse ciclo; mantém-se a cobertura móvel em Chromium,
      // enquanto as jornadas de UI/UX acima continuam cobrindo WebKit.
      const planLimitJourneys = spawnSync("playwright", [
        "test",
        "-c",
        "playwright.config.ts",
        "e2e/plan-limits.spec.ts",
        "--project=android-360-portrait",
        "--workers",
        "1",
      ], {
        cwd: process.cwd(),
        env: {
          ...extendedEnv,
          PW_OUTPUT_DIR: join(extendedArtifactRoot, "plan-limits"),
          PW_REPORT_DIR: join(extendedArtifactRoot, "plan-limits-report"),
        },
        stdio: "inherit",
      });
      createdByThisRun(planLimitJourneys, "Entitlements por plano em Chromium mobile");

      const buildDir = mkdtempSync(join(tmpdir(), "cativa-extended-build-"));
      try {
        const build = spawnSync("npm", [
          "run",
          "build",
          "--",
          "--outDir",
          buildDir,
          "--emptyOutDir",
        ], {
          cwd: process.cwd(),
          env: extendedEnv,
          stdio: "inherit",
        });
        createdByThisRun(build, "Build isolado das jornadas de portal");

        const port = await getAvailableLoopbackPort();
        const baseUrl = `http://127.0.0.1:${port}`;
        const preview = spawn("vite", [
          "preview",
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
          "--strictPort",
          "--outDir",
          buildDir,
        ], {
          cwd: process.cwd(),
          env: extendedEnv,
          stdio: "ignore",
        });
        try {
          await waitForLocalServer(baseUrl, preview);

          // Generate the auth state for the exact temporary preview origin;
          // Playwright does not reuse localStorage across port changes.
          const smokeEnv = {
            ...extendedEnv,
            E2E_BASE_URL: baseUrl,
            PW_OUTPUT_DIR: join(extendedArtifactRoot, "portal"),
            PW_REPORT_DIR: join(extendedArtifactRoot, "portal-report"),
          };
          const smokeAuthState = spawnSync("node", ["scripts/generate-storage-state.mjs"], {
            cwd: process.cwd(),
            env: smokeEnv,
            stdio: "inherit",
          });
          createdByThisRun(smokeAuthState, "Storage state autenticado para o preview E2E");

          const portalJourneys = spawnSync("playwright", [
            "test",
            "-c",
            "playwright.smoke.config.ts",
            "e2e/diagnostics/local-confirmation-center.spec.ts",
            "e2e/diagnostics/local-portal-booking.spec.ts",
            "e2e/diagnostics/local-portal-self-service.spec.ts",
            "--project=iphone-14-portrait",
            "--workers",
            "1",
          ], {
            cwd: process.cwd(),
            env: smokeEnv,
            stdio: "inherit",
          });
          createdByThisRun(portalJourneys, "Jornadas E2E de confirmação e autosserviço do portal");
        } finally {
          await stopLocalServer(preview);
        }
      } finally {
        rmSync(buildDir, { recursive: true, force: true });
      }
    } else if (process.env.E2E_RUN_LOCAL_PORTAL_BOOKING === "true") {
      console.log("Jornada do portal em build de produção isolado e Supabase QA descartável.");
      const buildDir = mkdtempSync(join(tmpdir(), "cativa-portal-build-"));
      const portalArtifactRoot = process.env.PW_PORTAL_BOOKING_OUTPUT_DIR?.trim()
        || mkdtempSync(join(tmpdir(), "cativa-portal-booking-"));
      const storageStatePath = join(tempDir, "empty-storage-state.json");
      writeFileSync(storageStatePath, JSON.stringify({ cookies: [], origins: [] }), { mode: 0o600 });

      try {
        const build = spawnSync("npm", [
          "run",
          "build",
          "--",
          "--outDir",
          buildDir,
          "--emptyOutDir",
        ], {
          cwd: process.cwd(),
          env: storageEnv,
          stdio: "inherit",
        });
        createdByThisRun(build, "Build isolado para jornada de agendamento do portal");

        const port = await getAvailableLoopbackPort();
        const baseUrl = "http://127.0.0.1:" + port;
        const vite = spawn("vite", [
          "preview",
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
          "--strictPort",
          "--outDir",
          buildDir,
        ], {
          cwd: process.cwd(),
          env: storageEnv,
          stdio: "ignore",
        });
        try {
        await waitForLocalServer(baseUrl, vite);
        const portalEnv = {
          ...storageEnv,
          E2E_BASE_URL: baseUrl,
          E2E_STORAGE_STATE_PATH: storageStatePath,
          PW_OUTPUT_DIR: portalArtifactRoot,
          PW_REPORT_DIR: process.env.PW_PORTAL_BOOKING_REPORT_DIR?.trim()
            || join(portalArtifactRoot, "report"),
        };
        const portalBooking = spawnSync("playwright", [
          "test",
          "-c",
          "playwright.smoke.config.ts",
          "e2e/diagnostics/local-portal-booking.spec.ts",
          "--project=iphone-14-portrait",
          "--workers",
          "1",
        ], {
          cwd: process.cwd(),
          env: portalEnv,
          stdio: "inherit",
        });
        createdByThisRun(portalBooking, "Jornada de autoagendamento do portal QA local");
        } finally {
          await stopLocalServer(vite);
        }
      } finally {
        rmSync(buildDir, { recursive: true, force: true });
      }
    } else if (process.env.E2E_RUN_LOCAL_AUTHENTICATED_CONTRAST === "true") {
      console.log("A11y contrast authenticated: owner QA synthetic, themes claro/escuro, mobile/tablet.");
      const outputDir = process.env.PW_AUTH_A11Y_OUTPUT_DIR?.trim()
        || mkdtempSync(join(tmpdir(), "cativa-auth-a11y-"));
      const reportDir = process.env.PW_AUTH_A11Y_REPORT_DIR?.trim()
        || join(outputDir, "report");
      const contrastEnv = {
        ...storageEnv,
        PW_OUTPUT_DIR: outputDir,
        PW_REPORT_DIR: reportDir,
      };
      delete contrastEnv.E2E_BASE_URL;
      const contrast = spawnSync("playwright", [
        "test",
        "-c",
        "playwright.config.ts",
        "e2e/visual/a11y-contrast.spec.ts",
        "--grep",
        "rotas autenticadas",
        "--project=iphone-se",
        "--project=android-360-portrait",
        "--project=ipad-portrait",
        "--workers",
        "1",
      ], {
        cwd: process.cwd(),
        env: contrastEnv,
        stdio: "inherit",
      });
      createdByThisRun(contrast, "Contraste WCAG claro/escuro nas rotas autenticadas QA locais");
    } else if (process.env.E2E_RUN_NAVIGATION_SCENARIOS === "true") {
      console.log("Cenários de navegação autenticados: execução isolada para diagnóstico.");
      const navigationArgs = [
        "test",
        "e2e/visual/navigation-scenarios.spec.ts",
        "--project=iphone-14-portrait",
        "--project=iphone-se",
        "--workers",
        "1",
      ];
      if (process.env.E2E_UPDATE_NAVIGATION_SNAPSHOT === "true") {
        navigationArgs.push("--update-snapshots");
      }
      const navigation = spawnSync("playwright", navigationArgs, {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(navigation, "Cenários de navegação autenticados QA locais");
    } else if (process.env.E2E_RUN_AGENDA_CONFIRMATION_SCENARIO === "true") {
      console.log("Jornada Agenda → Confirmações: execução isolada para diagnóstico.");
      const bootstrap = spawnSync("npm", ["run", "test:auth:bootstrap"], {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(bootstrap, "Bootstrap autenticado da jornada Agenda → Confirmações");
      const visualFixtures = spawnSync("node", ["scripts/e2e-prepare-visual-fixtures.mjs"], {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(visualFixtures, "Fixture da jornada Agenda → Confirmações");
      const agendaArgs = [
        "test",
        "e2e/visual/agenda-to-confirmation.spec.ts",
        "--project=iphone-14-portrait",
        "--workers",
        "1",
      ];
      if (process.env.E2E_UPDATE_AGENDA_CONFIRMATION_SNAPSHOT === "true") {
        agendaArgs.push("--update-snapshots");
      }
      const agenda = spawnSync("playwright", agendaArgs, {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(agenda, "Jornada Agenda → Confirmações QA locais");
    } else if (process.env.E2E_RUN_AUTHENTICATED_QA === "true") {
      console.log("Suíte funcional autenticada: jornadas QA nos perfis sintéticos provisionados.");
      const buildDir = mkdtempSync(join(tmpdir(), "cativa-auth-qa-build-"));
      const artifactRoot = process.env.PW_AUTH_QA_OUTPUT_DIR?.trim()
        || mkdtempSync(join(tmpdir(), "cativa-auth-qa-"));
      try {
        const build = spawnSync("npm", [
          "run",
          "build",
          "--",
          "--outDir",
          buildDir,
          "--emptyOutDir",
        ], {
          cwd: process.cwd(),
          env: storageEnv,
          stdio: "inherit",
        });
        createdByThisRun(build, "Build isolado da suíte funcional autenticada");

        const port = await getAvailableLoopbackPort();
        const baseUrl = `http://127.0.0.1:${port}`;
        const preview = spawn("vite", [
          "preview",
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
          "--strictPort",
          "--outDir",
          buildDir,
        ], {
          cwd: process.cwd(),
          env: storageEnv,
          stdio: "ignore",
        });
        try {
          await waitForLocalServer(baseUrl, preview);
          const authenticatedEnv = {
            ...storageEnv,
            E2E_BASE_URL: baseUrl,
            PW_OUTPUT_DIR: join(artifactRoot, "artifacts"),
            PW_REPORT_DIR: join(artifactRoot, "report"),
          };
          const smokeAuthState = spawnSync("node", ["scripts/generate-storage-state.mjs"], {
            cwd: process.cwd(),
            env: authenticatedEnv,
            stdio: "inherit",
          });
          createdByThisRun(smokeAuthState, "Storage state da suíte funcional autenticada");

          const authenticated = spawnSync("playwright", [
            "test",
            "-c",
            "playwright.smoke.config.ts",
            "e2e/diagnostics/auth-smoke.spec.ts",
            "e2e/diagnostics/app-shell-smoke.spec.ts",
            "e2e/diagnostics/audit-rpc-security.spec.ts",
            "e2e/diagnostics/portal-booking.spec.ts",
            "e2e/diagnostics/crm-media.spec.ts",
            "e2e/diagnostics/tenant-switch.spec.ts",
            "e2e/diagnostics/plan-limits.spec.ts",
            "e2e/diagnostics/client-limit.spec.ts",
            "e2e/diagnostics/import-export-clients.spec.ts",
            "e2e/diagnostics/import-export-services.spec.ts",
            "e2e/diagnostics/import-export-team.spec.ts",
            "--project=iphone-14-portrait",
            "--workers",
            "1",
          ], {
            cwd: process.cwd(),
            env: authenticatedEnv,
            stdio: "inherit",
          });
          createdByThisRun(authenticated, "Suíte funcional autenticada QA local");
        } finally {
          await stopLocalServer(preview);
        }
      } finally {
        rmSync(buildDir, { recursive: true, force: true });
      }
    } else if (process.env.E2E_RUN_GO_LIVE_READINESS === "true") {
      console.log("Checklist Go-Live: configurações, limites, assinatura e exportação com owner sintético.");
      const readinessEnv = {
        ...storageEnv,
        PW_OUTPUT_DIR: process.env.PW_GO_LIVE_OUTPUT_DIR?.trim()
          || join(tempDir, "go-live-artifacts"),
        PW_REPORT_DIR: process.env.PW_GO_LIVE_REPORT_DIR?.trim()
          || join(tempDir, "go-live-report"),
      };
      delete readinessEnv.E2E_BASE_URL;
      const readiness = spawnSync("playwright", [
        "test",
        "-c",
        "playwright.config.ts",
        "e2e/go-live-readiness.spec.ts",
        "--project=iphone-14-portrait",
        "--workers",
        "1",
      ], {
        cwd: process.cwd(),
        env: readinessEnv,
        stdio: "inherit",
      });
      createdByThisRun(readiness, "Checklist Go-Live QA local");
    } else if (process.env.E2E_RUN_RBAC_AND_INVITE_E2E === "true") {
      console.log("Matriz RBAC e convite de equipe no preview isolado com perfis QA sintéticos.");
      const buildDir = mkdtempSync(join(tmpdir(), "cativa-rbac-build-"));
      const artifactRoot = process.env.PW_RBAC_INVITE_OUTPUT_DIR?.trim()
        || mkdtempSync(join(tmpdir(), "cativa-rbac-invite-"));
      try {
        const build = spawnSync("npm", [
          "run",
          "build",
          "--",
          "--outDir",
          buildDir,
          "--emptyOutDir",
        ], {
          cwd: process.cwd(),
          env: storageEnv,
          stdio: "inherit",
        });
        createdByThisRun(build, "Build isolado da matriz RBAC e convites");

        const port = await getAvailableLoopbackPort();
        const baseUrl = `http://127.0.0.1:${port}`;
        const preview = spawn("vite", [
          "preview",
          "--host",
          "127.0.0.1",
          "--port",
          String(port),
          "--strictPort",
          "--outDir",
          buildDir,
        ], {
          cwd: process.cwd(),
          env: storageEnv,
          stdio: "ignore",
        });
        try {
          await waitForLocalServer(baseUrl, preview);
          const inviteEnv = {
            ...storageEnv,
            E2E_BASE_URL: baseUrl,
            PW_OUTPUT_DIR: join(artifactRoot, "artifacts"),
            PW_REPORT_DIR: join(artifactRoot, "report"),
          };
          const smokeAuthState = spawnSync("node", ["scripts/generate-storage-state.mjs"], {
            cwd: process.cwd(),
            env: inviteEnv,
            stdio: "inherit",
          });
          createdByThisRun(smokeAuthState, "Storage state da matriz RBAC e convites");

          const result = spawnSync("playwright", [
            "test",
            "-c",
            "playwright.smoke.config.ts",
            "e2e/diagnostics/role-based-access.spec.ts",
            "e2e/diagnostics/team-invite.spec.ts",
            "--project=iphone-14-portrait",
            "--workers",
            "1",
          ], {
            cwd: process.cwd(),
            env: inviteEnv,
            stdio: "inherit",
          });
          createdByThisRun(result, "Matriz RBAC e convite de equipe QA local");
        } finally {
          await stopLocalServer(preview);
        }
      } finally {
        rmSync(buildDir, { recursive: true, force: true });
      }
    } else if (process.env.E2E_RUN_BACKEND_MATRIX === "true") {
      const scripts = [
        "test:backend:concurrency",
        "test:backend:soak",
        "test:backend:mixed",
        "test:backend:multitenant",
      ];
      for (const script of scripts) {
        console.log(`Executando ${script} contra a instância Supabase QA local descartável.`);
        const result = spawnSync("npm", ["run", script], {
          cwd: process.cwd(),
          env: storageEnv,
          stdio: "inherit",
        });
        createdByThisRun(result, `Teste backend ${script} QA local`);
      }
    } else if (process.env.E2E_RUN_OFFLINE_AGENDA === "true") {
      console.log("Jornada de agenda offline: build isolado, fila local, falha 503 e sincronização no QA local.");
      const buildDir = mkdtempSync(join(tmpdir(), "cativa-offline-build-"));
      // Keep the generated storageState origin identical to the preview server
      // origin; Playwright does not apply localStorage state across host aliases.
      const offlineEnv = {
        ...storageEnv,
        E2E_BASE_URL: "http://[::1]:4173",
        PW_PREVIEW_OUT_DIR: buildDir,
        PW_OUTPUT_DIR: process.env.PW_OFFLINE_OUTPUT_DIR?.trim()
          || join(tempDir, "offline-artifacts"),
        PW_REPORT_DIR: process.env.PW_OFFLINE_REPORT_DIR?.trim()
          || join(tempDir, "offline-report"),
      };
      try {
        const bootstrap = spawnSync("npm", ["run", "test:auth:bootstrap"], {
          cwd: process.cwd(),
          env: offlineEnv,
          stdio: "inherit",
        });
        createdByThisRun(bootstrap, "Bootstrap autenticado da jornada offline");
        const build = spawnSync("npm", [
          "run",
          "build",
          "--",
          "--outDir",
          buildDir,
          "--emptyOutDir",
        ], {
          cwd: process.cwd(),
          env: offlineEnv,
          stdio: "inherit",
        });
        createdByThisRun(build, "Build isolado de produção da jornada offline");
        const offline = spawnSync("playwright", [
          "test",
          "-c",
          "playwright.pwa.config.ts",
          "--workers",
          "1",
        ], {
          cwd: process.cwd(),
          env: offlineEnv,
          stdio: "inherit",
        });
        createdByThisRun(offline, "Jornada de agenda offline QA local");
      } finally {
        rmSync(buildDir, { recursive: true, force: true });
      }
    } else if (process.env.E2E_RUN_AUTHENTICATED_LAYOUT_GEOMETRY === "true") {
      console.log("Geometria de dialogs/BottomNav e acessibilidade mobile autenticadas em QA local.");
      const visualArtifactRoot = process.env.PW_AUTH_LAYOUT_OUTPUT_DIR?.trim()
        || mkdtempSync(join(tmpdir(), "cativa-auth-layout-"));
      const visualEnv = {
        ...storageEnv,
        PW_OUTPUT_DIR: join(visualArtifactRoot, "artifacts"),
        PW_REPORT_DIR: join(visualArtifactRoot, "report"),
      };
      delete visualEnv.E2E_BASE_URL;

      const bootstrap = spawnSync("npm", ["run", "test:auth:bootstrap"], {
        cwd: process.cwd(),
        env: visualEnv,
        stdio: "inherit",
      });
      createdByThisRun(bootstrap, "Bootstrap autenticado dos testes geométricos mobile");

      const visualFixtures = spawnSync("node", ["scripts/e2e-prepare-visual-fixtures.mjs"], {
        cwd: process.cwd(),
        env: visualEnv,
        stdio: "inherit",
      });
      createdByThisRun(visualFixtures, "Preparação segura das fixtures visuais sintéticas");

      const visual = spawnSync("playwright", [
        "test",
        "-c",
        "playwright.config.ts",
        "e2e/visual/dialog-overflow.spec.ts",
        "e2e/visual/bottom-nav-overlap.spec.ts",
        "e2e/visual/a11y-mobile.spec.ts",
        "--project=iphone-se",
        "--project=android-360-portrait",
        "--project=mobile-320-portrait",
        "--workers",
        "1",
      ], {
        cwd: process.cwd(),
        env: visualEnv,
        stdio: "inherit",
      });
      createdByThisRun(visual, "Geometria e acessibilidade mobile autenticadas QA locais");
    } else if (process.env.E2E_SKIP_VISUAL_AUTH_CRITICAL === "true") {
      console.log("Suíte visual autenticada crítica omitida a pedido; executando somente matrizes complementares.");
    } else if (process.env.E2E_UPDATE_VISUAL_SNAPSHOTS === "true") {
      console.log("Atualização opt-in de snapshots: apenas rotas autenticadas no QA local.");
      const bootstrap = spawnSync("npm", ["run", "test:auth:bootstrap"], {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(bootstrap, "Preparação dos perfis visuais QA locais");

      const prepare = spawnSync("node", ["scripts/e2e-prepare-visual-fixtures.mjs"], {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(prepare, "Estabilização das fixtures visuais QA locais");

      const visualArgs = [
        "test",
        "e2e/visual/public-routes.spec.ts",
        "-g",
        "rotas autenticadas",
        "--project=iphone-14-portrait",
        "--project=iphone-se",
        "--project=android-360-portrait",
        "--workers",
        "1",
      ];
      const update = spawnSync("playwright", [...visualArgs, "--update-snapshots"], {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(update, "Atualização dos snapshots autenticados QA locais");

      const verify = spawnSync("playwright", visualArgs, {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(verify, "Verificação dos snapshots atualizados no QA local");
    } else {
      const visual = spawnSync("npm", ["run", "test:visual:auth:critical"], {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(visual, "Regressão visual autenticada no QA local");
    }

    if (process.env.E2E_RUN_AUTHENTICATED_LAYOUT_MATRIX === "true") {
      const layoutGrep = process.env.E2E_AUTHENTICATED_LAYOUT_GREP?.trim() || "rotas autenticadas";
      console.log(
        layoutGrep === "rotas autenticadas"
          ? "Matriz completa de layout autenticado: rotas, navegadores e breakpoints QA locais."
          : "Matriz filtrada de layout autenticado em QA local.",
      );
      const layout = spawnSync("playwright", [
        "test",
        "-c",
        "playwright.layout.config.ts",
        "e2e/visual/layout-matrix.spec.ts",
        "--grep",
        layoutGrep,
        "--workers",
        "1",
      ], {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(layout, "Matriz completa de layout autenticado QA local");
    } else if (process.env.E2E_RUN_WAITLIST_LAYOUT_MATRIX === "true") {
      console.log("Matriz de layout da lista de espera: navegadores e breakpoints QA locais.");
      const layout = spawnSync("playwright", [
        "test",
        "-c",
        "playwright.layout.config.ts",
        "e2e/visual/layout-matrix.spec.ts",
        "--grep",
        "app-waitlist",
        "--workers",
        "1",
      ], {
        cwd: process.cwd(),
        env: storageEnv,
        stdio: "inherit",
      });
      createdByThisRun(layout, "Matriz de layout da lista de espera no QA local");
    }

    const storage = spawnSync("npm", ["run", "test:storage:check"], {
      cwd: process.cwd(),
      env: storageEnv,
      stdio: "inherit",
    });
    createdByThisRun(storage, "Matriz Storage via API local");
  } catch (error) {
    testError = error;
  } finally {
    try {
      // No fixture identity existed before this run; remove only the exact
      // tenant slugs and auth emails owned by this isolated helper.
      await cleanupFixtures(
        admin,
        manifestPath || resolve(process.cwd(), "e2e/.artifacts-qa/no-manifest.json"),
        slugs,
        fixtureEmails,
      );
      if (manifestPath) {
        const expectedDir = resolve(process.cwd(), "e2e/.artifacts-qa");
        if (resolve(manifestPath).startsWith(`${expectedDir}/`)) rmSync(manifestPath, { force: true });
      }
    } catch (cleanupError) {
      if (testError) {
        testError = new Error(`${testError instanceof Error ? testError.message : String(testError)}; ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      } else testError = cleanupError;
    }
    rmSync(tempDir, { recursive: true, force: true });
  }

  if (testError) throw testError;
  console.log(`Matriz Storage local concluída e limpa (run iniciada em ${runStartedAt}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
