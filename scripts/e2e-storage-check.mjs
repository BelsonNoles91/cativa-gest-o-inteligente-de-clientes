#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_ROLES = ["owner", "manager", "frontdesk", "professional"];

function loadEnvFile(file) {
  if (!existsSync(file)) return { found: false, loaded: 0 };
  const content = readFileSync(file, "utf8");
  let loaded = 0;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (!key) continue;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
      loaded++;
    }
  }
  return { found: true, loaded };
}

function readEnv(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function printStatus(label, ok, detail) {
  const prefix = ok ? "OK " : "WARN";
  console.log(`${prefix} ${label}: ${detail}`);
}

function requireEnv(key) {
  const value = readEnv(key);
  if (!value) {
    throw new Error(`${key} ausente`);
  }
  return value;
}

function storageErrorStatus(error) {
  return String(error?.statusCode ?? error?.status ?? "");
}

function assertPolicyDenial(error, action, role, { allowNotFound = false } = {}) {
  const status = storageErrorStatus(error);
  const expectedStatuses = allowNotFound ? ["400", "403", "404"] : ["400", "403"];
  if (!error || !expectedStatuses.includes(status)) {
    throw new Error(
      `${action} para ${role} deveria ser negado por RLS (HTTP ${status || "sem erro"}).`,
    );
  }
}

function assertMimeTypeDenial(error, mimeType, role) {
  const status = storageErrorStatus(error);
  if (!error || !["400", "415"].includes(status) || !/mime|file.?type|content.?type/i.test(error.message ?? "")) {
    throw new Error(
      `Upload ${mimeType} para ${role} deveria ser negado pela allowlist MIME (HTTP ${status || "sem erro"}).`,
    );
  }
}

function assertLogoLimitDenial(error, role) {
  const status = storageErrorStatus(error);
  if (!error || !["400", "413"].includes(status) || !/size|large|limit|exceed/i.test(error.message ?? "")) {
    throw new Error(
      `Logo acima de 2 MiB para ${role} deveria ser negado pelo limite do bucket (HTTP ${status || "sem erro"}).`,
    );
  }
}

function makePdfFixture(size, marker = "") {
  const encoder = new TextEncoder();
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 1 1] /Contents 4 0 R /Resources << >> >>\nendobj\n",
    "4 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n",
  ];
  let document = `%PDF-1.4\n${marker ? `% ${marker}\n` : ""}`;
  const offsets = [0];
  for (const object of objects) {
    offsets.push(encoder.encode(document).byteLength);
    document += object;
  }
  const xrefOffset = encoder.encode(document).byteLength;
  document += `xref\n0 5\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const bytes = encoder.encode(document);
  if (size === undefined) return bytes;
  if (!Number.isSafeInteger(size) || size < bytes.byteLength) {
    throw new Error(`Não há espaço suficiente para a fixture PDF válida (${size} bytes disponíveis).`);
  }
  const padded = new Uint8Array(size);
  padded.set(bytes);
  padded.fill(0x20, bytes.byteLength);
  return padded;
}

async function runStorageRoleMatrix({
  supabaseUrl,
  publishableKey,
  bucket,
  tenantAId,
  tenantBId,
  tenantAPath,
  tenantAMarker,
}) {
  const cleanupKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const cleanupClient = createClient(supabaseUrl, cleanupKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const trackedPaths = [];
  const trackedLogoPaths = [];
  const runMarker = `${Date.now()}-${randomUUID()}`;
  const roles = [
    {
      role: "owner",
      email: requireEnv("E2E_USER"),
      password: requireEnv("E2E_PASS"),
      tenantId: tenantAId,
    },
    {
      role: "manager",
      email: requireEnv("E2E_MANAGER_USER"),
      password: requireEnv("E2E_MANAGER_PASS"),
      tenantId: tenantAId,
    },
    {
      role: "frontdesk",
      email: requireEnv("E2E_FRONTDESK_USER"),
      password: requireEnv("E2E_FRONTDESK_PASS"),
      tenantId: tenantAId,
    },
    {
      role: "professional",
      email: requireEnv("E2E_PROFESSIONAL_USER"),
      password: requireEnv("E2E_PROFESSIONAL_PASS"),
      tenantId: tenantAId,
    },
    {
      role: "client",
      email: requireEnv("E2E_CLIENT_USER"),
      password: requireEnv("E2E_CLIENT_PASS"),
      tenantId: null,
    },
    {
      role: "tenant-b-owner",
      email: requireEnv("E2E_TENANT_B_USER"),
      password: requireEnv("E2E_TENANT_B_PASS"),
      tenantId: tenantBId,
    },
  ];

  const tenantBPath = `${tenantBId}/${randomUUID()}/__storage-matrix-${runMarker}-tenant-b.txt`;
  const tenantBMarker = `tenant-b-${runMarker}`;
  trackedPaths.push(tenantBPath);

  try {
    const tenantBOwner = roles.find((entry) => entry.role === "tenant-b-owner");
    if (!tenantBOwner) throw new Error("Fixture owner do tenant B ausente.");
    const tenantBClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { error: tenantBAuthError } = await tenantBClient.auth.signInWithPassword({
      email: tenantBOwner.email,
      password: tenantBOwner.password,
    });
    if (tenantBAuthError) throw tenantBAuthError;
    const { error: tenantBUploadError } = await tenantBClient.storage.from(bucket).upload(
      tenantBPath,
      new Blob([`${tenantBMarker}\n`], { type: "text/plain" }),
      { contentType: "text/plain", upsert: false },
    );
    if (tenantBUploadError) throw tenantBUploadError;
    const { error: tenantBSignOutError } = await tenantBClient.auth.signOut();
    if (tenantBSignOutError) throw tenantBSignOutError;

    const owner = roles.find((entry) => entry.role === "owner");
    if (!owner) throw new Error("Fixture owner do tenant A ausente.");
    const { data: subscription, error: subscriptionReadError } = await cleanupClient
      .from("tenant_subscriptions")
      .select("id, override_limits")
      .eq("tenant_id", tenantAId)
      .maybeSingle();
    if (subscriptionReadError) throw subscriptionReadError;
    if (!subscription?.id) throw new Error("Assinatura de QA do tenant A ausente para validar a cota de Storage.");

    const quotaPath = `${tenantAId}/${randomUUID()}/__storage-quota-${runMarker}.pdf`;
    trackedPaths.push(quotaPath);
    const quotaLimitBytes = 1024 * 1024;
    const originalLimits = subscription.override_limits ?? {};
    const quotaOwner = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let quotaOverrideSet = false;
    let quotaSessionStarted = false;

    try {
      const { error: quotaAuthError } = await quotaOwner.auth.signInWithPassword({
        email: owner.email,
        password: owner.password,
      });
      if (quotaAuthError) throw quotaAuthError;
      quotaSessionStarted = true;

      const { data: currentUsage, error: currentUsageError } = await quotaOwner.rpc(
        "tenant_storage_bytes_used",
        { _tenant_id: tenantAId },
      );
      if (currentUsageError) throw currentUsageError;
      const usedBefore = Number(currentUsage ?? 0);
      const exactFitSize = quotaLimitBytes - usedBefore;
      if (!Number.isSafeInteger(usedBefore) || exactFitSize < 1) {
        throw new Error(`Uso prévio de Storage incompatível com o cenário de cota (${usedBefore} bytes).`);
      }

      quotaOverrideSet = true;
      const { error: quotaUpdateError } = await cleanupClient
        .from("tenant_subscriptions")
        .update({ override_limits: { ...originalLimits, max_storage_mb: 1 } })
        .eq("id", subscription.id);
      if (quotaUpdateError) throw quotaUpdateError;

      const { error: exactFitError } = await quotaOwner.storage.from(bucket).upload(
        quotaPath,
        new Blob([makePdfFixture(exactFitSize)], { type: "application/pdf" }),
        { contentType: "application/pdf", upsert: false },
      );
      if (exactFitError) throw new Error(`Upload exatamente até a cota foi negado: ${exactFitError.message}`);

      const { data: exactUsage, error: exactUsageError } = await quotaOwner.rpc(
        "tenant_storage_bytes_used",
        { _tenant_id: tenantAId },
      );
      if (exactUsageError) throw exactUsageError;
      if (Number(exactUsage) !== quotaLimitBytes) {
        throw new Error(`Cota após upload exato ficou em ${exactUsage} bytes, esperado ${quotaLimitBytes}.`);
      }

      const { error: overwriteError } = await quotaOwner.storage.from(bucket).upload(
        quotaPath,
        new Blob([makePdfFixture(exactFitSize + 1)], { type: "application/pdf" }),
        { contentType: "application/pdf", upsert: true },
      );
      if (!overwriteError || !["400", "500"].includes(storageErrorStatus(overwriteError))) {
        throw new Error(`Overwrite acima da cota deveria ser negado (HTTP 400/500; recebido ${storageErrorStatus(overwriteError) || "sem erro"}).`);
      }

      const { data: usageAfterRejectedOverwrite, error: usageAfterRejectedOverwriteError } = await quotaOwner.rpc(
        "tenant_storage_bytes_used",
        { _tenant_id: tenantAId },
      );
      if (usageAfterRejectedOverwriteError) throw usageAfterRejectedOverwriteError;
      if (Number(usageAfterRejectedOverwrite) !== quotaLimitBytes) {
        throw new Error("Overwrite acima da cota alterou o total persistido de Storage.");
      }

      const overLimitPath = `${tenantAId}/${randomUUID()}/__storage-over-limit-${runMarker}.txt`;
      trackedPaths.push(overLimitPath);
      const { error: extraFileError } = await quotaOwner.storage.from(bucket).upload(
        overLimitPath,
        new Blob(["x"], { type: "text/plain" }),
        { contentType: "text/plain", upsert: false },
      );
      if (!extraFileError || !["400", "500"].includes(storageErrorStatus(extraFileError))) {
        throw new Error(`Novo arquivo além da cota deveria ser negado (HTTP 400/500; recebido ${storageErrorStatus(extraFileError) || "sem erro"}).`);
      }

      const { error: quotaRemoveError } = await quotaOwner.storage.from(bucket).remove([quotaPath]);
      if (quotaRemoveError) throw quotaRemoveError;
      const { data: usageAfterCleanup, error: usageAfterCleanupError } = await quotaOwner.rpc(
        "tenant_storage_bytes_used",
        { _tenant_id: tenantAId },
      );
      if (usageAfterCleanupError) throw usageAfterCleanupError;
      if (Number(usageAfterCleanup) !== usedBefore) {
        throw new Error("Remover arquivo não restaurou o uso de Storage anterior ao teste de cota.");
      }

      const concurrentFileSize = Math.floor((quotaLimitBytes - usedBefore) / 2) + 1;
      for (let round = 1; round <= 8; round += 1) {
        const pairPaths = [
          `${tenantAId}/${randomUUID()}/__storage-race-${runMarker}-${round}-a.pdf`,
          `${tenantAId}/${randomUUID()}/__storage-race-${runMarker}-${round}-b.pdf`,
        ];
        trackedPaths.push(...pairPaths);
        const results = await Promise.all(
          pairPaths.map((path) => quotaOwner.storage.from(bucket).upload(
            path,
            new Blob([makePdfFixture(concurrentFileSize)], { type: "application/pdf" }),
            { contentType: "application/pdf", upsert: false },
          )),
        );
        const acceptedCount = results.filter((result) => !result.error).length;
        const rejected = results.find((result) => result.error)?.error;
        if (acceptedCount !== 1 || !rejected || !["400", "500"].includes(storageErrorStatus(rejected))) {
          throw new Error(`Disputa de cota ${round}/8 deveria aceitar exatamente um upload e negar o outro; aceitos=${acceptedCount}, status=${storageErrorStatus(rejected) || "nenhum"}.`);
        }

        const { data: usageDuringRace, error: usageDuringRaceError } = await quotaOwner.rpc(
          "tenant_storage_bytes_used",
          { _tenant_id: tenantAId },
        );
        if (usageDuringRaceError) throw usageDuringRaceError;
        if (Number(usageDuringRace) > quotaLimitBytes) {
          throw new Error(`Corrida de uploads excedeu a cota: ${usageDuringRace} > ${quotaLimitBytes} bytes.`);
        }

        const { error: raceCleanupError } = await cleanupClient.storage.from(bucket).remove(pairPaths);
        if (raceCleanupError) throw new Error(`Limpeza da disputa de cota ${round}/8 falhou: ${raceCleanupError.message}`);
        const { data: usageAfterRaceCleanup, error: usageAfterRaceCleanupError } = await quotaOwner.rpc(
          "tenant_storage_bytes_used",
          { _tenant_id: tenantAId },
        );
        if (usageAfterRaceCleanupError) throw usageAfterRaceCleanupError;
        if (Number(usageAfterRaceCleanup) !== usedBefore) {
          throw new Error(`A disputa de cota ${round}/8 deixou bytes residuais após a limpeza.`);
        }
      }
    } finally {
      const cleanupFailures = [];
      try {
        const { error: privilegedCleanupError } = await cleanupClient.storage.from(bucket).remove([quotaPath]);
        if (privilegedCleanupError) cleanupFailures.push(`limpeza: ${privilegedCleanupError.message}`);
      } catch (error) {
        cleanupFailures.push(`limpeza: ${error instanceof Error ? error.message : String(error)}`);
      }
      if (quotaOverrideSet) {
        try {
          const { error: restoreLimitsError } = await cleanupClient
            .from("tenant_subscriptions")
            .update({ override_limits: originalLimits })
            .eq("id", subscription.id);
          if (restoreLimitsError) cleanupFailures.push(`restauração da cota: ${restoreLimitsError.message}`);
          const { data: restoredSubscription, error: verifyRestoreError } = await cleanupClient
            .from("tenant_subscriptions")
            .select("override_limits")
            .eq("id", subscription.id)
            .maybeSingle();
          if (verifyRestoreError) cleanupFailures.push(`verificação da cota restaurada: ${verifyRestoreError.message}`);
          else if (JSON.stringify(restoredSubscription?.override_limits ?? {}) !== JSON.stringify(originalLimits)) {
            cleanupFailures.push("verificação da cota restaurada: override_limits não corresponde ao valor original");
          }
        } catch (error) {
          cleanupFailures.push(`restauração da cota: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (quotaSessionStarted) {
        try {
          const { error: quotaSignOutError } = await quotaOwner.auth.signOut();
          if (quotaSignOutError) cleanupFailures.push(`encerramento da sessão: ${quotaSignOutError.message}`);
        } catch (error) {
          cleanupFailures.push(`encerramento da sessão: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      if (cleanupFailures.length > 0) {
        throw new Error(`Falha no finally do teste de cota: ${cleanupFailures.join("; ")}`);
      }
    }
    printStatus("Cota do plano", true, "limite exato, overwrite, arquivo excedente e 8 disputas concorrentes; assinatura restaurada");

    for (const actor of roles) {
      const client = createClient(supabaseUrl, publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error: authError } = await client.auth.signInWithPassword({
        email: actor.email,
        password: actor.password,
      });
      if (authError) throw new Error(`Login da matriz Storage (${actor.role}): ${authError.message}`);

      try {
        for (const baseline of [
          { tenantId: tenantAId, path: tenantAPath, marker: tenantAMarker },
          { tenantId: tenantBId, path: tenantBPath, marker: tenantBMarker },
        ]) {
          const expectedRead = actor.tenantId === baseline.tenantId;
          const { data, error } = await client.storage.from(bucket).createSignedUrl(baseline.path, 60);
          if (!expectedRead) {
            assertPolicyDenial(error, `Leitura de ${baseline.tenantId}`, actor.role, { allowNotFound: true });
            continue;
          }
          if (error || !data?.signedUrl) {
            throw new Error(`Leitura do próprio tenant falhou para ${actor.role}: ${error?.message ?? "URL ausente"}`);
          }
          const response = await fetch(data.signedUrl);
          if (!response.ok || !(await response.text()).includes(baseline.marker)) {
            throw new Error(`Download/signed URL não validou conteúdo para ${actor.role}.`);
          }
        }

        const wrongTenantIds = actor.tenantId === tenantAId
          ? [tenantBId]
          : actor.tenantId === tenantBId
            ? [tenantAId]
            : [tenantAId, tenantBId];
        for (const wrongTenantId of wrongTenantIds) {
          const deniedPath = `${wrongTenantId}/${randomUUID()}/__storage-denied-${runMarker}-${actor.role}.txt`;
          trackedPaths.push(deniedPath);
          const { error } = await client.storage.from(bucket).upload(
            deniedPath,
            new Blob([`denied-${actor.role}`], { type: "text/plain" }),
            { contentType: "text/plain", upsert: false },
          );
          assertPolicyDenial(error, `Upload cross-tenant em ${wrongTenantId}`, actor.role);
        }

        if (actor.tenantId) {
          for (const mimeType of ["text/html", "image/svg+xml"]) {
            const deniedPath = `${actor.tenantId}/${randomUUID()}/__storage-mime-denied-${runMarker}.${mimeType === "text/html" ? "html" : "svg"}`;
            trackedPaths.push(deniedPath);
            const { error } = await client.storage.from(bucket).upload(
              deniedPath,
              new Blob(["active-content-fixture"], { type: mimeType }),
              { contentType: mimeType, upsert: false },
            );
            assertMimeTypeDenial(error, mimeType, actor.role);
          }
          printStatus("Allowlist MIME", true, `${actor.role}: text/html e image/svg+xml recusados pelo Storage`);
        }

        if (actor.tenantId) {
          const objectPath = `${actor.tenantId}/${randomUUID()}/__storage-matrix-${runMarker}-${actor.role}.pdf`;
          const originalContent = makePdfFixture(undefined, `initial-${actor.role}-${runMarker}`);
          const updatedContent = makePdfFixture(undefined, `updated-${actor.role}-${runMarker}`);
          trackedPaths.push(objectPath);

          const { error: uploadError } = await client.storage.from(bucket).upload(
            objectPath,
            new Blob([originalContent], { type: "application/pdf" }),
            { contentType: "application/pdf", upsert: false },
          );
          if (uploadError) throw new Error(`Upload permitido falhou para ${actor.role}: ${uploadError.message}`);

          const { error: updateError } = await client.storage.from(bucket).upload(
            objectPath,
            new Blob([updatedContent], { type: "application/pdf" }),
            { contentType: "application/pdf", upsert: true },
          );
          if (updateError) throw new Error(`Sobrescrita permitida falhou para ${actor.role}: ${updateError.message}`);

          const { data: updatedUrl, error: signedError } = await client.storage.from(bucket).createSignedUrl(objectPath, 60);
          if (signedError || !updatedUrl?.signedUrl) {
            throw new Error(`URL assinada pós-update falhou para ${actor.role}: ${signedError?.message ?? "URL ausente"}`);
          }
          const updatedResponse = await fetch(updatedUrl.signedUrl);
          const downloadedContent = new Uint8Array(await updatedResponse.arrayBuffer());
          if (
            !updatedResponse.ok ||
            downloadedContent.length !== updatedContent.length ||
            downloadedContent.some((byte, index) => byte !== updatedContent[index])
          ) {
            throw new Error(`Conteúdo após overwrite não confere para ${actor.role}.`);
          }

          const { error: removeError } = await client.storage.from(bucket).remove([objectPath]);
          if (removeError) throw new Error(`Remoção permitida falhou para ${actor.role}: ${removeError.message}`);
          const { error: afterDeleteError } = await client.storage.from(bucket).createSignedUrl(objectPath, 60);
          assertPolicyDenial(afterDeleteError, "Leitura após remoção", actor.role, { allowNotFound: true });
        }

        if (actor.role === "owner" && actor.tenantId === tenantAId) {
          const allowedLogoPath = `${tenantAId}/${randomUUID()}/__storage-logo-allow-${runMarker}.png`;
          trackedLogoPaths.push(allowedLogoPath);
          const { error: allowedLogoError } = await client.storage.from("tenant-logos").upload(
            allowedLogoPath,
            new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" }),
            { contentType: "image/png", upsert: false },
          );
          if (allowedLogoError) throw new Error(`PNG permitido no bucket de logo foi negado: ${allowedLogoError.message}`);

          const svgLogoPath = `${tenantAId}/${randomUUID()}/__storage-logo-denied-${runMarker}.svg`;
          trackedLogoPaths.push(svgLogoPath);
          const { error: svgLogoError } = await client.storage.from("tenant-logos").upload(
            svgLogoPath,
            new Blob(["<svg xmlns=\"http://www.w3.org/2000/svg\"><script>alert(1)</script></svg>"], { type: "image/svg+xml" }),
            { contentType: "image/svg+xml", upsert: false },
          );
          assertMimeTypeDenial(svgLogoError, "image/svg+xml", actor.role);

          const oversizedLogoPath = `${tenantAId}/${randomUUID()}/__storage-logo-over-limit-${runMarker}.png`;
          trackedLogoPaths.push(oversizedLogoPath);
          const { error: oversizedLogoError } = await client.storage.from("tenant-logos").upload(
            oversizedLogoPath,
            new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" }),
            { contentType: "image/png", upsert: false },
          );
          assertLogoLimitDenial(oversizedLogoError, actor.role);
          printStatus("Tenant logos", true, "PNG aceito; SVG e arquivos acima de 2 MiB recusados");
        }
      } finally {
        const { error: signOutError } = await client.auth.signOut();
        if (signOutError) throw new Error(`Falha ao encerrar sessão da matriz (${actor.role}): ${signOutError.message}`);
      }

      printStatus("Matriz Storage", true, `${actor.role}: leitura, upload, overwrite, remoção e isolamento validados`);
    }
  } finally {
    for (const target of [
      { bucket, paths: trackedPaths },
      { bucket: "tenant-logos", paths: trackedLogoPaths },
    ]) {
      if (target.paths.length === 0) continue;
      const { error: cleanupError } = await cleanupClient.storage.from(target.bucket).remove(target.paths);
      if (cleanupError) throw new Error(`Limpeza privilegiada do bucket ${target.bucket} falhou: ${cleanupError.message}`);

      const remaining = await Promise.all(
        target.paths.map(async (path) => {
          const { data, error } = await cleanupClient.storage.from(target.bucket).createSignedUrl(path, 5);
          return !error && Boolean(data?.signedUrl);
        }),
      );
      if (remaining.some(Boolean)) throw new Error(`A matriz Storage deixou objeto sintético sem limpeza no bucket ${target.bucket}.`);
    }
  }
}

async function main() {
  const envLocal = loadEnvFile(resolve(process.cwd(), ".env.local"));
  const env = loadEnvFile(resolve(process.cwd(), ".env"));

  const targetGuard = spawnSync(
    process.execPath,
    [resolve(process.cwd(), "scripts/e2e-target-check.mjs"), "--destructive"],
    { env: process.env, stdio: "inherit" },
  );
  if (targetGuard.error) throw targetGuard.error;
  if (targetGuard.status !== 0) {
    throw new Error("Storage check bloqueado: declare explicitamente um alvo QA descartável.");
  }

  const supabaseUrl = requireEnv("VITE_SUPABASE_URL");
  const publishableKey = requireEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const email = requireEnv("E2E_USER");
  const password = requireEnv("E2E_PASS");
  const bucket = readEnv("E2E_STORAGE_BUCKET") || "client-media";

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log("Cativa storage check");
  console.log("");
  printStatus(
    ".env.local",
    envLocal.found,
    envLocal.found ? `${envLocal.loaded} variáveis carregadas` : "arquivo não encontrado",
  );
  printStatus(
    ".env",
    env.found,
    env.found ? `${env.loaded} variáveis carregadas` : "arquivo não encontrado",
  );

  let uploadedPath = "";

  try {
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (authError) throw authError;

    const userId = authData.user?.id;
    if (!userId) throw new Error("login não retornou usuário autenticado");

    printStatus("Auth", true, `login válido para ${authData.user.email ?? email}`);

    const { data: memberships, error: membershipsError } = await supabase
      .from("tenant_memberships")
      .select("tenant_id, role, tenants:tenants!inner(id, name, slug)")
      .eq("user_id", userId)
      .eq("status", "active")
      .in("role", ALLOWED_ROLES)
      .limit(5);
    if (membershipsError) throw membershipsError;

    const membership = memberships?.[0];
    if (!membership?.tenant_id) {
      throw new Error(
        `usuário ${email} não possui membership ativa com papel permitido`,
      );
    }

    const tenantId = membership.tenant_id;
    const role = membership.role ?? "sem papel";
    const tenantName = membership.tenants?.name ?? tenantId;
    printStatus("Tenant", true, `${tenantName} (${role})`);

    const { data: clientRecord, error: clientError } = await supabase
      .from("clients")
      .select("id")
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (clientError) {
      printStatus(
        "Cliente",
        false,
        `não foi possível buscar cliente existente; usando id sintético (${clientError.message})`,
      );
    } else {
      printStatus(
        "Cliente",
        Boolean(clientRecord?.id),
        clientRecord?.id
          ? `cliente existente ${clientRecord.id}`
          : "nenhum cliente encontrado; usando id sintético",
      );
    }

    const clientId = clientRecord?.id ?? randomUUID();
    const marker = `cativa-storage-check-${Date.now()}-${randomUUID()}`;
    const fileName = `__e2e-storage-check-${Date.now()}.txt`;
    const path = `${tenantId}/${clientId}/${fileName}`;
    const body = new Blob([`${marker}\n`], { type: "text/plain" });

    const otherTenantId = requireEnv("E2E_TENANT_B_ID");
    if (otherTenantId === tenantId) {
      throw new Error("Fixtures inválidas: tenant A e tenant B precisam ser distintos.");
    }

    const crossTenantPath = `${otherTenantId}/${clientId}/__e2e-storage-denied-${randomUUID()}.txt`;
    const { error: crossTenantError } = await supabase.storage
      .from(bucket)
      .upload(
        crossTenantPath,
        new Blob(["isolamento cross-tenant\n"], { type: "text/plain" }),
        { contentType: "text/plain", upsert: false },
      );
    if (!crossTenantError) {
      const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
      const cleanupClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error: crossTenantCleanupError } = await cleanupClient.storage
        .from(bucket)
        .remove([crossTenantPath]);
      if (crossTenantCleanupError) {
        throw new Error(
          `Falha de isolamento cross-tenant e limpeza do objeto de teste: ${crossTenantCleanupError.message}`,
        );
      }
      throw new Error("Falha de segurança: Storage aceitou upload para tenant alheio.");
    }

    const denialStatus = String(crossTenantError.statusCode ?? "");
    if (!["400", "403"].includes(denialStatus)) {
      throw new Error(
        `Upload cross-tenant falhou por motivo inesperado (HTTP ${denialStatus || "desconhecido"}).`,
      );
    }
    printStatus("Isolamento cross-tenant", true, `upload para tenant B negado (HTTP ${denialStatus})`);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, body, {
        contentType: "text/plain",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    uploadedPath = path;
    printStatus("Upload", true, `${bucket}/${path}`);

    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60);
    if (signedError) throw signedError;
    if (!signedData?.signedUrl) throw new Error("Supabase não retornou signedUrl");

    printStatus("Signed URL", true, "URL assinada emitida por 60 segundos");

    const response = await fetch(signedData.signedUrl);
    if (!response.ok) {
      throw new Error(`URL assinada respondeu HTTP ${response.status}`);
    }

    const content = await response.text();
    if (!content.includes(marker)) {
      throw new Error("conteúdo lido pela URL assinada não confere");
    }

    printStatus("Download", true, "conteúdo validado via URL assinada");

    await runStorageRoleMatrix({
      supabaseUrl,
      publishableKey,
      bucket,
      tenantAId: tenantId,
      tenantBId: otherTenantId,
      tenantAPath: path,
      tenantAMarker: marker,
    });
  } finally {
    let cleanupFailure;
    if (uploadedPath) {
      const { error: removeError } = await supabase.storage
        .from(readEnv("E2E_STORAGE_BUCKET") || "client-media")
        .remove([uploadedPath]);

      printStatus(
        "Cleanup",
        !removeError,
        removeError
          ? `falha ao remover ${uploadedPath}: ${removeError.message}`
          : `objeto removido: ${uploadedPath}`,
      );
      if (removeError) cleanupFailure = removeError.message;
    }

    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError && !cleanupFailure) cleanupFailure = signOutError.message;
    if (cleanupFailure) throw new Error(`Storage check não limpou a sessão/objeto: ${cleanupFailure}`);
  }

  console.log("");
  console.log("Storage check concluído.");
}

main().catch((error) => {
  console.error("");
  console.error(
    `Storage check falhou: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
