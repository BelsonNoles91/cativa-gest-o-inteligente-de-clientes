#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(file) {
  if (!existsSync(file)) return;
  const content = readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function env(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function tokenStorageKey(projectId, supabaseUrl) {
  if (projectId) return `sb-${projectId}-auth-token`;
  if (supabaseUrl) {
    try {
      const ref = new URL(supabaseUrl).hostname.split(".")[0];
      return `sb-${ref}-auth-token`;
    } catch {
      // noop
    }
  }
  return "sb-project-auth-token";
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const supabaseUrl = env("VITE_SUPABASE_URL");
const publishableKey = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const projectId = env("VITE_SUPABASE_PROJECT_ID");
const email = env("E2E_USER");
const password = env("E2E_PASS");
const baseUrl = env("E2E_BASE_URL") || "http://127.0.0.1:4173";
const storagePath = resolve(process.cwd(), "e2e/.auth/storageState.json");

if (!supabaseUrl || !publishableKey || !email || !password) {
  console.error("VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_USER e E2E_PASS são obrigatórios.");
  process.exit(1);
}

mkdirSync(dirname(storagePath), { recursive: true });

const supabase = createClient(supabaseUrl, publishableKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (error || !data.session) {
  console.error(`Falha ao gerar storageState: ${error?.message ?? "sessão não retornada"}`);
  process.exit(1);
}

writeFileSync(
  storagePath,
  JSON.stringify(
    {
      cookies: [],
      origins: [
        {
          origin: new URL(baseUrl).origin,
          localStorage: [
            {
              name: tokenStorageKey(projectId, supabaseUrl),
              value: JSON.stringify({
                ...data.session,
                user: data.user ?? data.session.user,
                weak_password: null,
              }),
            },
          ],
        },
      ],
    },
    null,
    2,
  ),
);

await supabase.auth.signOut();
console.log(`storageState gerado em ${storagePath}`);
