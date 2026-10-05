#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function requiredEnv(key) {
  const value = process.env[key]?.trim();
  if (!value)
    throw new Error(
      `${key} é obrigatório para provisionar as fixtures locais.`,
    );
  return value;
}

const localMode = process.env.E2E_LOCAL_SUPABASE === "true";
const supabaseUrl = requiredEnv("SUPABASE_URL");
const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const githubEnv = requiredEnv("GITHUB_ENV");
const runId = (process.env.GITHUB_RUN_ID || `local-${Date.now()}`)
  .replace(/[^a-zA-Z0-9._-]/g, "-")
  .slice(0, 80);

let parsedUrl;
try {
  parsedUrl = new URL(supabaseUrl);
} catch {
  throw new Error("SUPABASE_URL não é uma URL válida.");
}
const localHostname = parsedUrl.hostname.replace(/^\[|\]$/g, "");
if (
  !localMode ||
  parsedUrl.protocol !== "http:" ||
  !new Set(["localhost", "127.0.0.1", "::1"]).has(localHostname)
) {
  throw new Error(
    "Provisionamento fictício bloqueado: exige E2E_LOCAL_SUPABASE=true e URL HTTP loopback.",
  );
}
if (
  process.env.E2E_QA_PROJECT_REF !== "local" ||
  process.env.E2E_TARGET_ALLOWLIST !== "local"
) {
  throw new Error(
    "Provisionamento local exige E2E_QA_PROJECT_REF=local e E2E_TARGET_ALLOWLIST=local.",
  );
}

const fixturePassword =
  process.env.E2E_LOCAL_FIXTURE_PASSWORD || randomBytes(30).toString("base64url");
if (fixturePassword.length < 30) {
  throw new Error("E2E_LOCAL_FIXTURE_PASSWORD precisa ter pelo menos 30 caracteres.");
}
const superAdminPassword = randomBytes(30).toString("base64url");
const domain = "cativa.test";
const requestedLocalSuffix = process.env.E2E_LOCAL_FIXTURE_SUFFIX?.trim();
if (requestedLocalSuffix && !/^[a-z0-9]{6,12}$/.test(requestedLocalSuffix)) {
  throw new Error("E2E_LOCAL_FIXTURE_SUFFIX deve conter de 6 a 12 caracteres alfanuméricos minúsculos.");
}
const fixtureSuffix = requestedLocalSuffix ? `-${requestedLocalSuffix}` : "";
const tenantA_slug = `studio-teste-qa${fixtureSuffix}`;
const tenantB_slug = `studio-teste-qa-b${fixtureSuffix}`;

const admin = createClient(supabaseUrl, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

function ensureData(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function findAuthUser(email) {
  const perPage = 200;
  for (let page = 1; page <= 100; page += 1) {
    const result = await admin.auth.admin.listUsers({ page, perPage });
    if (result.error)
      throw new Error(`listar usuários Auth: ${result.error.message}`);
    const users = result.data.users ?? [];
    const match = users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match;
    if (users.length < perPage) return null;
  }
  throw new Error("Paginação Auth excedeu o limite defensivo de 100 páginas.");
}

async function ensureAuthUser({
  email,
  fullName,
  password,
}) {
  const existing = await findAuthUser(email);
  let user;
  if (existing) {
    const updated = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (updated.error || !updated.data.user) {
      throw new Error(
        `atualizar usuário fictício ${email}: ${updated.error?.message ?? "usuário ausente"}`,
      );
    }
    user = updated.data.user;
  } else {
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (created.error || !created.data.user) {
      throw new Error(
        `criar usuário fictício ${email}: ${created.error?.message ?? "usuário ausente"}`,
      );
    }
    user = created.data.user;
  }

  ensureData(
    await admin
      .from("profiles")
      .upsert(
        { id: user.id, full_name: fullName },
        { onConflict: "id" },
      ),
    `garantir profile de ${email}`,
  );
  return user;
}

function promoteLocalSuperAdmin(userId, email) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error("ID inválido para a fixture local de super-admin.");
  }
  const expectedSuperAdminEmail = `super-admin.${tenantA_slug}@${domain}`.toLowerCase();
  if (email.toLowerCase() !== expectedSuperAdminEmail) {
    throw new Error("A promoção local está restrita à conta sintética super-admin desta execução QA.");
  }

  const rawDatabaseUrl = requiredEnv("SUPABASE_DB_URL");
  let databaseUrl;
  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error("SUPABASE_DB_URL não é uma URL válida para promover a fixture local.");
  }
  const hostname = databaseUrl.hostname.replace(/^\[|\]$/g, "");
  if (
    !new Set(["localhost", "127.0.0.1", "::1"]).has(hostname) ||
    !["postgres:", "postgresql:"].includes(databaseUrl.protocol)
  ) {
    throw new Error("Promoção de super-admin permitida somente no banco QA local/loopback.");
  }
  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, "")) || "postgres";
  const databaseUser = decodeURIComponent(databaseUrl.username || "postgres");
  if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
    throw new Error("Nome do banco inválido para a fixture QA local.");
  }
  if (databaseUser !== "postgres") {
    throw new Error("A promoção local exige a conta padrão postgres do Supabase descartável.");
  }

  const sql = `BEGIN;
ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_super_admin_changes_trg;
ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_self_super_admin;
DO $promotion$
DECLARE
  updated_rows integer;
BEGIN
  UPDATE public.profiles AS profile
     SET is_super_admin = true,
         updated_at = now()
   WHERE profile.id = '${userId}'::uuid
     AND profile.full_name = 'Super Admin QA Local'
     AND EXISTS (
       SELECT 1 FROM auth.users AS auth_user
        WHERE auth_user.id = profile.id
          AND lower(auth_user.email) = '${expectedSuperAdminEmail}'
     );
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  IF updated_rows <> 1 THEN
    RAISE EXCEPTION 'A fixture sintética super-admin não foi encontrada ou não corresponde.';
  END IF;
END
$promotion$;
ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_self_super_admin;
ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_super_admin_changes_trg;
COMMIT;`;

  const psqlArgs = [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-h",
    hostname,
    "-p",
    databaseUrl.port || "5432",
    "-U",
    databaseUser,
    "-d",
    databaseName,
    "-f",
    "-",
  ];
  const connectionEnv = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(databaseUrl.password),
    PGSSLMODE: "disable",
  };

  try {
    execFileSync("psql", psqlArgs, { input: sql, encoding: "utf8", env: connectionEnv });
    return;
  } catch {
    // Some local developer environments do not install the PostgreSQL client.
    // The fallback is still bound to the one running Supabase DB container
    // publishing this loopback database port.
  }

  try {
    const containers = execFileSync(
      "docker",
      ["ps", "--filter", `publish=${databaseUrl.port}`, "--format", "{{.Names}}"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    )
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter((name) => name.startsWith("supabase_db_"));
    if (containers.length !== 1) {
      throw new Error("Não foi possível identificar um único container de banco Supabase para o port QA.");
    }
    execFileSync(
      "docker",
      ["exec", "-i", containers[0], "psql", "-U", "postgres", "-d", databaseName, "-X", "-v", "ON_ERROR_STOP=1", "-f", "-"],
      { input: sql, encoding: "utf8" },
    );
  } catch {
    throw new Error(
      "Não foi possível promover a conta sintética de super-admin; instale psql ou mantenha o container Supabase local QA acessível.",
    );
  }
}

async function ensureTenant({ slug, name, ownerId }) {
  const tenant = ensureData(
    await admin
      .from("tenants")
      .upsert(
        {
          slug,
          name,
          segment: "salao",
          status: "active",
          timezone: "America/Sao_Paulo",
          created_by: ownerId,
        },
        { onConflict: "slug" },
      )
      .select("id, slug, name")
      .single(),
    `criar tenant ${slug}`,
  );

  const existingUnit = ensureData(
    await admin
      .from("units")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle(),
    `buscar unidade do tenant ${slug}`,
  );
  const unit =
    existingUnit ??
    ensureData(
      await admin
        .from("units")
        .insert({
          tenant_id: tenant.id,
          name: "Unidade Principal QA",
          is_default: true,
        })
        .select("id")
        .single(),
      `criar unidade do tenant ${slug}`,
    );
  return { ...tenant, unitId: unit.id };
}

async function ensureActiveSubscription(tenant, overrideLimits = null) {
  const plan = ensureData(
    await admin.from("plans").select("id").eq("code", "studio").maybeSingle(),
    "buscar plano Studio para a fixture local",
  );
  if (!plan?.id) {
    throw new Error(
      "O plano Studio não existe no banco local; não é possível liberar as jornadas autenticadas.",
    );
  }

  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  ensureData(
    await admin.from("tenant_subscriptions").upsert(
      {
        tenant_id: tenant.id,
        plan_id: plan.id,
        status: "active",
        current_period_start: startsAt.toISOString(),
        current_period_end: endsAt.toISOString(),
        override_limits: overrideLimits ?? {},
        notes: "Fixture fictícia do job E2E local; sem cobrança real.",
      },
      { onConflict: "tenant_id" },
    ),
    `ativar assinatura fictícia do tenant ${tenant.slug}`,
  );
}

async function ensureMembership(tenantId, userId, role) {
  ensureData(
    await admin.from("tenant_memberships").upsert(
      {
        tenant_id: tenantId,
        user_id: userId,
        role,
        status: "active",
        accepted_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id,user_id" },
    ),
    `vincular perfil ${role} ao tenant`,
  );
}

async function ensureProfessional(tenant, user, displayName) {
  const existing = ensureData(
    await admin
      .from("professionals")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    "buscar profissional fictício",
  );
  if (existing) return existing;
  return ensureData(
    await admin
      .from("professionals")
      .insert({
        tenant_id: tenant.id,
        unit_id: tenant.unitId,
        user_id: user.id,
        display_name: displayName,
        role_title: "Profissional de QA",
        is_active: true,
      })
      .select("id")
      .single(),
    "criar profissional fictício",
  );
}

async function ensureConfirmationService(tenant) {
  const payload = {
    tenant_id: tenant.id,
    name: "Serviço QA E2E",
    description: "Fixture determinística para confirmação e agenda offline.",
    internal_code: "E2E-CONFIRMATION",
    duration_minutes: 30,
    is_active: true,
    is_public: false,
  };
  const existing = ensureData(
    await admin
      .from("services")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("internal_code", payload.internal_code)
      .limit(1)
      .maybeSingle(),
    "buscar serviço QA da central de confirmação",
  );
  return ensureData(
    existing
      ? await admin
          .from("services")
          .update(payload)
          .eq("id", existing.id)
          .select("id")
          .single()
      : await admin.from("services").insert(payload).select("id").single(),
    "garantir serviço QA da central de confirmação",
  );
}

async function ensureClient(tenant, user, fullName) {
  const email = user.email;
  const existing = ensureData(
    await admin
      .from("clients")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("email", email)
      .limit(1)
      .maybeSingle(),
    "buscar cliente fictício",
  );
  const client =
    existing ??
    ensureData(
      await admin
        .from("clients")
        .insert({
          tenant_id: tenant.id,
          preferred_unit_id: tenant.unitId,
          full_name: fullName,
          email,
          status: "active",
          origin: "public_link",
        })
        .select("id")
        .single(),
      "criar cliente fictício",
    );
  ensureData(
    await admin.from("client_users").upsert(
      {
        tenant_id: tenant.id,
        client_id: client.id,
        user_id: user.id,
        status: "active",
        booking_origin: "public_link",
      },
      { onConflict: "tenant_id,user_id" },
    ),
    "vincular cliente fictício ao portal",
  );
  return client;
}

async function ensurePortalBookingCatalog(tenant, professional) {
  const serviceName = "Serviço QA Portal Local";
  const servicePayload = {
    tenant_id: tenant.id,
    name: serviceName,
    description:
      "Serviço sintético para a jornada de autoagendamento no portal.",
    internal_code: "QA-PORTAL-LOCAL",
    duration_minutes: 30,
    buffer_before_minutes: 0,
    buffer_after_minutes: 0,
    processing_minutes: 0,
    min_advance_hours: 0,
    // A janela sintética longa dá ao teste de concorrência dias independentes
    // sem alterar as políticas de tenants reais.
    max_advance_days: 180,
    is_active: true,
    is_featured: true,
    is_public: true,
    position: 0,
  };
  const existingService = ensureData(
    await admin
      .from("services")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("internal_code", servicePayload.internal_code)
      .limit(1)
      .maybeSingle(),
    "buscar serviço de agendamento do portal",
  );
  const service = existingService
    ? ensureData(
        await admin
          .from("services")
          .update(servicePayload)
          .eq("id", existingService.id)
          .select("id")
          .single(),
        "atualizar serviço de agendamento do portal",
      )
    : ensureData(
        await admin
          .from("services")
          .insert(servicePayload)
          .select("id")
          .single(),
        "criar serviço de agendamento do portal",
      );

  const existingPrice = ensureData(
    await admin
      .from("service_prices")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("service_id", service.id)
      .eq("currency", "BRL")
      .limit(1)
      .maybeSingle(),
    "buscar preço do serviço do portal",
  );
  const pricePayload = {
    tenant_id: tenant.id,
    service_id: service.id,
    amount_cents: 10000,
    currency: "BRL",
    is_default: true,
  };
  ensureData(
    existingPrice
      ? await admin
          .from("service_prices")
          .update(pricePayload)
          .eq("id", existingPrice.id)
      : await admin.from("service_prices").insert(pricePayload),
    "garantir preço do serviço do portal",
  );

  for (let weekday = 0; weekday <= 6; weekday += 1) {
    const businessHours = ensureData(
      await admin
        .from("unit_business_hours")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("unit_id", tenant.unitId)
        .eq("weekday", weekday)
        .limit(1)
        .maybeSingle(),
      `buscar horário da unidade QA no dia ${weekday}`,
    );
    const businessPayload = {
      tenant_id: tenant.id,
      unit_id: tenant.unitId,
      weekday,
      opens_at: "08:00",
      closes_at: "18:00",
      is_closed: false,
    };
    ensureData(
      businessHours
        ? await admin
            .from("unit_business_hours")
            .update(businessPayload)
            .eq("id", businessHours.id)
        : await admin.from("unit_business_hours").insert(businessPayload),
      `garantir horário da unidade QA no dia ${weekday}`,
    );

    const availability = ensureData(
      await admin
        .from("professional_availability")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("professional_id", professional.id)
        .eq("unit_id", tenant.unitId)
        .eq("weekday", weekday)
        .limit(1)
        .maybeSingle(),
      `buscar disponibilidade QA no dia ${weekday}`,
    );
    const availabilityPayload = {
      tenant_id: tenant.id,
      professional_id: professional.id,
      unit_id: tenant.unitId,
      weekday,
      starts_at: "08:00",
      ends_at: "18:00",
      is_active: true,
    };
    ensureData(
      availability
        ? await admin
            .from("professional_availability")
            .update(availabilityPayload)
            .eq("id", availability.id)
        : await admin
            .from("professional_availability")
            .insert(availabilityPayload),
      `garantir disponibilidade QA no dia ${weekday}`,
    );
  }

  return { serviceId: service.id, professionalId: professional.id };
}

function exportForNextStep(key, value, { secret = false } = {}) {
  if (!value || /[\r\n]/.test(value))
    throw new Error(`Valor inválido para ${key}.`);
  if (secret && process.env.GITHUB_ACTIONS === "true") {
    process.stdout.write(`::add-mask::${value}\n`);
  }
  appendFileSync(githubEnv, `${key}=${value}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

async function main() {
  const superAdmin = await ensureAuthUser({
    email: `super-admin.${tenantA_slug}@${domain}`,
    fullName: "Super Admin QA Local",
    password: superAdminPassword,
  });
  promoteLocalSuperAdmin(superAdmin.id, superAdmin.email);
  const promotedProfile = ensureData(
    await admin
      .from("profiles")
      .select("is_super_admin")
      .eq("id", superAdmin.id)
      .single(),
    "verificar promoção do super-admin sintético",
  );
  if (promotedProfile.is_super_admin !== true) {
    throw new Error("A fixture local de super-admin não recebeu a permissão esperada.");
  }
  const ownerA = await ensureAuthUser({
    email: `owner.${tenantA_slug}@${domain}`,
    fullName: "Proprietário QA Local",
    password: fixturePassword,
  });
  const ownerB = await ensureAuthUser({
    email: `owner.${tenantB_slug}@${domain}`,
    fullName: "Proprietário QA Tenant B",
    password: fixturePassword,
  });
  const tenantA = await ensureTenant({
    slug: tenantA_slug,
    name: "Studio Teste QA",
    ownerId: ownerA.id,
  });
  const tenantB = await ensureTenant({
    slug: tenantB_slug,
    name: "Studio Teste QA B",
    ownerId: ownerB.id,
  });
  await ensureActiveSubscription(tenantA, {
    max_units: 2,
    max_active_clients: 3,
  });
  await ensureActiveSubscription(tenantB);

  const accountRows = [
    { role: "owner", tenant: tenantA, user: ownerA },
    { role: "owner", tenant: tenantB, user: ownerB },
  ];
  for (const role of ["manager", "frontdesk", "professional", "client"]) {
    const fullName = {
      manager: "Gerente QA Local",
      frontdesk: "Recepção QA Local",
      professional: "Profissional QA Local",
      client: "Cliente QA Local",
    }[role];
    const user = await ensureAuthUser({
      email: `${role}.${tenantA_slug}@${domain}`,
      fullName,
      password: fixturePassword,
    });
    accountRows.push({ role, tenant: tenantA, user });
  }

  const pendingInvitee = await ensureAuthUser({
    email: `invitee.${tenantA_slug}@${domain}`,
    fullName: "Convidado Pendente QA Local",
    password: fixturePassword,
  });

  for (const account of accountRows) {
    if (account.role !== "client") {
      await ensureMembership(account.tenant.id, account.user.id, account.role);
    }
  }
  const professional = accountRows.find(
    (account) => account.role === "professional",
  );
  const client = accountRows.find((account) => account.role === "client");
  if (!professional || !client)
    throw new Error("Fixtures locais de profissional/cliente incompletas.");
  const professionalFixture = await ensureProfessional(
    tenantA,
    professional.user,
    "Profissional QA Local",
  );
  await ensureClient(tenantA, client.user, "Cliente QA Local");
  await ensureConfirmationService(tenantA);
  const portalBookingFixture = await ensurePortalBookingCatalog(
    tenantA,
    professionalFixture,
  );

  const roles = new Map(
    accountRows
      .filter((account) => account.tenant.id === tenantA.id)
      .map((account) => [account.role, account.user]),
  );
  const credentials = {
    E2E_SUPER_ADMIN_USER: superAdmin.email,
    E2E_SUPER_ADMIN_PASS: superAdminPassword,
    E2E_USER: roles.get("owner")?.email,
    E2E_PASS: fixturePassword,
    E2E_TENANT_SLUG: tenantA.slug,
    E2E_MANAGER_USER: roles.get("manager")?.email,
    E2E_MANAGER_PASS: fixturePassword,
    E2E_FRONTDESK_USER: roles.get("frontdesk")?.email,
    E2E_FRONTDESK_PASS: fixturePassword,
    E2E_PROFESSIONAL_USER: roles.get("professional")?.email,
    E2E_PROFESSIONAL_PASS: fixturePassword,
    E2E_CLIENT_USER: roles.get("client")?.email,
    E2E_CLIENT_PASS: fixturePassword,
    E2E_INVITEE_USER: pendingInvitee.email,
    E2E_INVITEE_PASS: fixturePassword,
    E2E_TENANT_B_USER: ownerB.email,
    E2E_TENANT_B_PASS: fixturePassword,
    E2E_TENANT_B_SLUG: tenantB.slug,
    E2E_TENANT_A_ID: tenantA.id,
    E2E_TENANT_B_ID: tenantB.id,
    E2E_RUN_ID: runId,
    E2E_SEED_FIXTURES: "true",
  };
  for (const [key, value] of Object.entries(credentials)) {
    exportForNextStep(key, value, { secret: key.endsWith("_PASS") });
  }

  const manifestDir = join(process.cwd(), "e2e", ".artifacts-qa");
  mkdirSync(manifestDir, { recursive: true });
  const manifestPath = join(manifestDir, `local-fixtures-${runId}.json`);
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        runId,
        createdAt: new Date().toISOString(),
        target: parsedUrl.origin,
        ephemeral: true,
        tenants: [
          {
            id: tenantA.id,
            slug: tenantA.slug,
            unitId: tenantA.unitId,
            portalBooking: portalBookingFixture,
            accounts: accountRows
              .filter((account) => account.tenant.id === tenantA.id)
              .map(({ role, user }) => ({
                role,
                id: user.id,
                email: user.email,
              })),
          },
          {
            id: tenantB.id,
            slug: tenantB.slug,
            unitId: tenantB.unitId,
            accounts: [{ role: "owner", id: ownerB.id, email: ownerB.email }],
          },
        ],
        superAdmin: { id: superAdmin.id, email: superAdmin.email },
        pendingInvitee: { id: pendingInvitee.id, email: pendingInvitee.email },
        localLimitOverrides: { max_units: 2, max_active_clients: 3 },
        passwordsIncluded: false,
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  exportForNextStep("E2E_FIXTURE_MANIFEST", manifestPath);

  console.log(
    `Fixtures sintéticas locais prontas (run_id=${runId}): sete perfis/contas e um convidado pendente, dois tenants, portal e limites reduzidos.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
