import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

function loadEnvFile(file) {
  if (!readFileSync(file, "utf8")) return;
  const content = readFileSync(file, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const accounts = [
  { label: "owner", email: process.env.E2E_USER, pass: process.env.E2E_PASS },
  { label: "manager", email: process.env.E2E_MANAGER_USER, pass: process.env.E2E_MANAGER_PASS },
  { label: "frontdesk", email: process.env.E2E_FRONTDESK_USER, pass: process.env.E2E_FRONTDESK_PASS },
  { label: "professional", email: process.env.E2E_PROFESSIONAL_USER, pass: process.env.E2E_PROFESSIONAL_PASS },
];

const supabase = createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  for (const acc of accounts) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: acc.email, password: acc.pass });
    if (error || !data.session) {
      console.log(`FAIL ${acc.label}: ${error?.message}`);
      continue;
    }
    const uid = data.user.id;
    const [{ data: memb }, { data: prof }] = await Promise.all([
      supabase.from("tenant_memberships").select("role, tenant_id").eq("user_id", uid).eq("status", "active"),
      supabase.from("profiles").select("is_super_admin").eq("id", uid).maybeSingle(),
    ]);
    console.log(`${acc.label}: uid=${uid.slice(0,8)} role=${memb?.[0]?.role || "none"} super=${prof?.is_super_admin || false}`);
    
    // Verifica se tem role em profiles
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
    if (profile?.role) {
      console.log(`  → profiles.role = ${profile.role}`);
    }
  }
}

main().catch(console.error);
