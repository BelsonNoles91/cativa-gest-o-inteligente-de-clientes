#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://uqskxftzmjsumykpkwus.supabase.co";
const SERVICE_ROLE_KEY = "sb_secret_MuTi0QUaPfIjNeX5UzGH4w_XDDLw7hF";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function createAuthUser(email, password) {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listErr) throw listErr;
  const existing = list.users.find(u => u.email === email);
  if (existing) {
    console.log(`✅ Usuário já existe: ${email} → ${existing.id}`);
    return existing.id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: email.split("@")[0] },
  });
  if (error) throw error;
  console.log(`✅ Usuário criado: ${email} → ${data.user.id}`);
  return data.user.id;
}

async function createTenant(name, slug, segment, ownerId) {
  const { data: existing } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log(`✅ Tenant já existe: ${slug} → ${existing[0].id}`);
    return existing[0].id;
  }
  const { data, error } = await supabase
    .from("tenants")
    .insert({ name, slug, segment, created_by: ownerId, status: "active" })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`✅ Tenant criado: ${slug} → ${data.id}`);
  return data.id;
}

async function createUnit(tenantId, name) {
  const { data: existing } = await supabase
    .from("units")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("name", name)
    .limit(1);
  if (existing && existing.length > 0) {
    console.log(`✅ Unidade já existe: ${name} → ${existing[0].id}`);
    return existing[0].id;
  }
  const { data, error } = await supabase
    .from("units")
    .insert({ tenant_id: tenantId, name, is_default: true })
    .select("id")
    .single();
  if (error) throw error;
  console.log(`✅ Unidade criada: ${name} → ${data.id}`);
  return data.id;
}

async function ensureMembership(userId, tenantId, role) {
  const { data: existing } = await supabase
    .from("tenant_memberships")
    .select("id, role")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .limit(1);
  if (existing && existing.length > 0) {
    if (existing[0].role !== role) {
      const { error } = await supabase
        .from("tenant_memberships")
        .update({ role })
        .eq("id", existing[0].id);
      if (error) throw error;
      console.log(`✅ Membership atualizado para ${role}`);
    } else {
      console.log(`✅ Membership já existe: ${role}`);
    }
    return;
  }
  const { error } = await supabase
    .from("tenant_memberships")
    .insert({ user_id: userId, tenant_id: tenantId, role, status: "active" });
  if (error) throw error;
  console.log(`✅ Membership criado: ${role}`);
}

async function main() {
  console.log("=== Cativa Create Test Users ===\n");

  const ownerId = await createAuthUser("owner.studio-teste-qa@cativa.test", "Cativa@2026");
  const tenantId = await createTenant("Studio Teste QA", "studio-teste-qa", "salao", ownerId);
  await createUnit(tenantId, "Unidade Principal");
  await ensureMembership(ownerId, tenantId, "owner");

  const users = [
    { email: "manager.studio-teste-qa@cativa.test", pass: "Cativa@2026", role: "manager" },
    { email: "frontdesk.studio-teste-qa@cativa.test", pass: "Cativa@2026", role: "frontdesk" },
    { email: "professional.studio-teste-qa@cativa.test", pass: "Cativa@2026", role: "professional" },
  ];

  for (const u of users) {
    try {
      const userId = await createAuthUser(u.email, u.pass);
      await ensureMembership(userId, tenantId, u.role);
    } catch (err) {
      console.error(`❌ Erro com ${u.email}:`, err.message);
    }
  }

  console.log("\n✅ Setup de usuários de teste concluído!");
  console.log(`   Tenant ID: ${tenantId}`);
  console.log(`   Owner ID:  ${ownerId}`);
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
