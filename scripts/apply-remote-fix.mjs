#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

function env(key) {
  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

const SUPABASE_URL = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
const SERVICE_ROLE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const TENANT_SLUG = env("E2E_TENANT_SLUG");

const QA_USERS = [
  { role: "owner", email: env("E2E_USER"), password: env("E2E_PASS") },
  { role: "manager", email: env("E2E_MANAGER_USER"), password: env("E2E_MANAGER_PASS") },
  {
    role: "frontdesk",
    email: env("E2E_FRONTDESK_USER"),
    password: env("E2E_FRONTDESK_PASS"),
  },
  {
    role: "professional",
    email: env("E2E_PROFESSIONAL_USER"),
    password: env("E2E_PROFESSIONAL_PASS"),
  },
];

const requiredEnvByRole = {
  owner: ["E2E_USER", "E2E_PASS"],
  manager: ["E2E_MANAGER_USER", "E2E_MANAGER_PASS"],
  frontdesk: ["E2E_FRONTDESK_USER", "E2E_FRONTDESK_PASS"],
  professional: ["E2E_PROFESSIONAL_USER", "E2E_PROFESSIONAL_PASS"],
};

const missing = [];
if (!SUPABASE_URL) missing.push("VITE_SUPABASE_URL (ou SUPABASE_URL)");
if (!SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
for (const user of QA_USERS) {
  const [emailEnv, passEnv] = requiredEnvByRole[user.role];
  if (!user.email) missing.push(emailEnv);
  if (!user.password) missing.push(passEnv);
}

if (missing.length > 0) {
  throw new Error(`Variáveis obrigatórias ausentes: ${[...new Set(missing)].join(", ")}`);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) return users;
  }
}

async function ensureAuthUser(email, password, cachedUsers) {
  const normalized = email.toLowerCase();
  const existing = cachedUsers.find((user) => (user.email ?? "").toLowerCase() === normalized);
  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  if (error || !data.user) throw error ?? new Error(`Falha ao criar usuário QA ${email}`);
  cachedUsers.push(data.user);
  return data.user.id;
}

async function findOwnerTenant(ownerId) {
  let query = supabase
    .from("tenant_memberships")
    .select("tenant_id, role, status, tenants:tenants!inner(slug)")
    .eq("user_id", ownerId)
    .eq("role", "owner")
    .eq("status", "active");
  if (TENANT_SLUG) query = query.eq("tenants.slug", TENANT_SLUG);

  const { data, error } = await query.limit(2);
  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      TENANT_SLUG
        ? `Owner QA não possui membership owner ativo no tenant ${TENANT_SLUG}.`
        : "Owner QA não possui membership owner ativo.",
    );
  }
  if (!TENANT_SLUG && data.length > 1) {
    throw new Error("Owner QA pertence a mais de um tenant; configure E2E_TENANT_SLUG.");
  }
  return data[0].tenant_id;
}

async function ensureProfile(userId, email) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, full_name: email.split("@")[0] }, { onConflict: "id" });
  if (error) throw error;
}

async function ensureMembership(userId, tenantId, role) {
  const { data: existing, error: readError } = await supabase
    .from("tenant_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (readError) throw readError;

  const values = {
    role,
    status: "active",
    accepted_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await supabase.from("tenant_memberships").update(values).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("tenant_memberships")
    .insert({ tenant_id: tenantId, user_id: userId, ...values });
  if (error) throw error;
}

async function main() {
  const users = await listAllUsers();
  const owner = QA_USERS[0];
  const ownerId = await ensureAuthUser(owner.email, owner.password, users);
  await ensureProfile(ownerId, owner.email);
  const tenantId = await findOwnerTenant(ownerId);

  for (const qaUser of QA_USERS) {
    const userId =
      qaUser.role === "owner"
        ? ownerId
        : await ensureAuthUser(qaUser.email, qaUser.password, users);
    await ensureProfile(userId, qaUser.email);
    await ensureMembership(userId, tenantId, qaUser.role);
    console.log(`OK ${qaUser.role}: conta e membership QA validados.`);
  }

  console.log(`OK tenant QA: ${tenantId}`);
  console.log("Nenhuma migration ou alteração de schema foi aplicada por este script.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
