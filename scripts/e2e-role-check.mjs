#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

async function validate(label, email, password, supabaseUrl, publishableKey) {
  if (!email || !password) {
    return { label, ok: false, detail: "credenciais ausentes" };
  }

  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { label, ok: false, detail: error.message };
    }
    await supabase.auth.signOut();
    return {
      label,
      ok: true,
      detail: data.user?.email ?? email,
    };
  } catch (error) {
    return {
      label,
      ok: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

const supabaseUrl = env("VITE_SUPABASE_URL");
const publishableKey = env("VITE_SUPABASE_PUBLISHABLE_KEY");

if (!supabaseUrl || !publishableKey) {
  console.error("VITE_SUPABASE_URL/VITE_SUPABASE_PUBLISHABLE_KEY ausentes.");
  process.exit(1);
}

const checks = await Promise.all([
  validate("owner", env("E2E_USER"), env("E2E_PASS"), supabaseUrl, publishableKey),
  validate(
    "manager",
    env("E2E_MANAGER_USER"),
    env("E2E_MANAGER_PASS"),
    supabaseUrl,
    publishableKey,
  ),
  validate(
    "frontdesk",
    env("E2E_FRONTDESK_USER"),
    env("E2E_FRONTDESK_PASS"),
    supabaseUrl,
    publishableKey,
  ),
  validate(
    "professional",
    env("E2E_PROFESSIONAL_USER"),
    env("E2E_PROFESSIONAL_PASS"),
    supabaseUrl,
    publishableKey,
  ),
]);

console.log("Cativa E2E role check");
console.log("");
for (const check of checks) {
  console.log(`${check.ok ? "OK " : "WARN"} ${check.label}: ${check.detail}`);
}

if (checks.some((check) => !check.ok)) {
  process.exit(1);
}
