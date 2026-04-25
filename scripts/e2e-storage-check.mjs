#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
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

async function main() {
  const envLocal = loadEnvFile(resolve(process.cwd(), ".env.local"));
  const env = loadEnvFile(resolve(process.cwd(), ".env"));

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
    const body = new Blob([`${marker}\n`], { type: "text/plain;charset=utf-8" });

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, body, {
        contentType: "text/plain;charset=utf-8",
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
  } finally {
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
    }

    await supabase.auth.signOut();
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
