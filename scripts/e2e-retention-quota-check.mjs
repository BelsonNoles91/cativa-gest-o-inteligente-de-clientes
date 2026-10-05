#!/usr/bin/env node
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} ausente.`);
  return value;
}

const supabaseUrl = requiredEnv("SUPABASE_URL");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const target = new URL(supabaseUrl);
const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (
  process.env.E2E_LOCAL_SUPABASE !== "true" ||
  process.env.E2E_QA_PROJECT_REF !== "local" ||
  process.env.E2E_TARGET_ALLOWLIST?.trim() !== "local" ||
  target.protocol !== "http:" ||
  !loopbackHosts.has(target.hostname.replace(/^\[|\]$/g, ""))
) {
  throw new Error("Teste de quota concorrente permitido somente em Supabase local descartável/loopback.");
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const runSuffix = randomBytes(8).toString("hex");
const email = `retention-quota-${runSuffix}@cativa.test`;
const password = randomUUID();
const tenantSlug = `retention-quota-${runSuffix}`;
const dailyLimit = 5;
const concurrentCalls = 32;
let userId;
let tenantId;
let testError;

try {
  const { data: createdUser, error: createUserError } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createUserError) throw new Error(`Criação do usuário sintético falhou: ${createUserError.message}`);
  userId = createdUser.user.id;

  const { error: profileError } = await client.from("profiles").upsert({
    id: userId,
    full_name: `Retention Quota ${runSuffix}`,
    is_super_admin: false,
  });
  if (profileError) throw new Error(`Criação do perfil sintético falhou: ${profileError.message}`);

  const { data: createdTenant, error: tenantError } = await client
    .from("tenants")
    .insert({ name: `Retention Quota ${runSuffix}`, slug: tenantSlug, segment: "salao", created_by: userId })
    .select("id")
    .single();
  if (tenantError) throw new Error(`Criação do tenant sintético falhou: ${tenantError.message}`);
  tenantId = createdTenant.id;

  const results = await Promise.all(
    Array.from({ length: concurrentCalls }, () => client.rpc("reserve_retention_advisor_evaluation", {
      _tenant_id: tenantId,
      _daily_limit: dailyLimit,
    })),
  );
  const rpcError = results.find((result) => result.error)?.error;
  if (rpcError) throw new Error(`RPC concorrente de quota falhou: ${rpcError.code ?? "sem código"}`);

  const accepted = results.filter((result) => result.data === true).length;
  const rejected = results.filter((result) => result.data === false).length;
  if (accepted !== dailyLimit || rejected !== concurrentCalls - dailyLimit) {
    throw new Error(`Quota concorrente incorreta: aceitas=${accepted}, negadas=${rejected}, esperado=${dailyLimit}/${concurrentCalls - dailyLimit}.`);
  }

  console.log(`Quota concorrente local passou: ${concurrentCalls} chamadas simultâneas, ${accepted} reservas aceitas e ${rejected} negadas.`);
} catch (error) {
  testError = error;
} finally {
  const cleanupErrors = [];
  if (tenantId) {
    const { error } = await client.from("tenants").delete().eq("id", tenantId);
    if (error) cleanupErrors.push(`tenant sintético: ${error.message}`);
  }
  if (userId) {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) cleanupErrors.push(`usuário sintético: ${error.message}`);
  }
  if (cleanupErrors.length > 0) {
    const cleanupError = new Error(`Limpeza da quota concorrente falhou: ${cleanupErrors.join("; ")}`);
    if (testError) cleanupError.cause = testError;
    throw cleanupError;
  }
}

if (testError) throw testError;
