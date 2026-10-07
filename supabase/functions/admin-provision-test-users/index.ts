// Edge Function: admin-provision-test-users
// Provisiona contas de teste (owner, manager, frontdesk, professional, client)
// para o tenant informado. Apenas super_admin pode invocar.
//
// Idempotente: se o usuário já existir, apenas garante o vínculo correto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("SITE_URL") ?? "";
  return raw
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

function corsHeadersForRequest(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowed = getAllowedOrigins();
  const allowOrigin =
    allowed.length === 0
      ? ""
      : allowed.includes(origin)
        ? origin
        : allowed[0];
  return {
    ...corsHeaders,
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
  };
}

interface Body {
  tenant_id: string;
  password?: string;
  email_domain?: string;
}

const ROLES = ["owner", "manager", "frontdesk", "professional", "client"] as const;
type RoleKey = (typeof ROLES)[number];

interface ProvisionResult {
  role: RoleKey;
  email: string;
  user_id: string;
  status: "created" | "existing";
  password_set: boolean;
  notes?: string;
}

Deno.serve(async (req) => {
  const headers = corsHeadersForRequest(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }
  if (req.method !== "POST") {
    return json({ error: "Método não suportado" }, 405, headers);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return json({ error: "Configuração de servidor ausente" }, 500, headers);
  }

  // 1) Validar caller via JWT do header
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes.user) {
    return json({ error: "Não autenticado" }, 401, headers);
  }
  const callerId = userRes.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  const { data: profile } = await admin
    .from("profiles")
    .select("is_super_admin, full_name")
    .eq("id", callerId)
    .maybeSingle();
  if (!profile?.is_super_admin) {
    return json({ error: "Apenas super admin" }, 403, headers);
  }

  // 2) Body
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ error: "JSON inválido" }, 400, headers);
  }
  const tenantId = body.tenant_id;
  const rawPassword = typeof body.password === "string" ? body.password.trim() : "";
  const domain = (body.email_domain ?? "cativa.test").trim().toLowerCase();
  if (!tenantId || !/^[0-9a-f-]{36}$/i.test(tenantId)) {
    return json({ error: "tenant_id inválido" }, 400, headers);
  }
  if (!rawPassword) {
    return json({ error: "password é obrigatório no corpo da requisição" }, 400, headers);
  }
  if (rawPassword.length < 12) {
    return json({ error: "senha precisa ter ao menos 12 caracteres" }, 400, headers);
  }
  // Guarda contra uso acidental em produção: só aceita domínios de teste reconhecidos
  const allowedDomainSuffixes = [".test", ".local", ".example"];
  if (!allowedDomainSuffixes.some((s) => domain.endsWith(s))) {
    return json(
      { error: "email_domain deve terminar em .test, .local ou .example" },
      400,
      headers,
    );
  }
  const password = rawPassword;

  // 3) Tenant + unidade default
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, slug, name")
    .eq("id", tenantId)
    .maybeSingle();
  if (!tenant) return json({ error: "Tenant não encontrado" }, 404, headers);

  const { data: defaultUnit } = await admin
    .from("units")
    .select("id")
    .eq("tenant_id", tenantId)
    .order("is_default", { ascending: false })
    .limit(1)
    .maybeSingle();

  const results: ProvisionResult[] = [];

  // Carrega os usuários-alvo percorrendo todas as páginas do Auth. O projeto de
  // QA pode ter mais de 200 usuários; olhar apenas a primeira página faz a
  // função tentar recriar um e-mail já existente e retornar password_set=false.
  const targetEmails = new Set(
    ROLES.map((role) => `${role}.${tenant.slug}@${domain}`.toLowerCase()),
  );
  const usersByEmail = new Map<string, string>();
  const authPageSize = 200;
  // Retry com backoff para mitigar erros transitórios do Auth ("Database error
  // finding users") observados em CI. O Supabase Auth pode retornar 5xx sob
  // carga ou durante deploys internos; reexecutar algumas vezes evita falhas
  // completas do provisionamento por um erro momentâneo.
  const maxListRetries = 3;
  for (let page = 1; usersByEmail.size < targetEmails.size; page += 1) {
    let lastError: Error | null = null;
    let users: { email?: string; id: string }[] = [];
    for (let attempt = 0; attempt <= maxListRetries; attempt += 1) {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({
        page,
        perPage: authPageSize,
      });
      if (!listErr) {
        users = list?.users ?? [];
        lastError = null;
        break;
      }
      lastError = listErr;
      if (attempt < maxListRetries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
    if (lastError) {
      return json(
        { error: `Falha ao consultar usuários existentes: ${lastError.message}` },
        500,
        headers,
      );
    }

    for (const user of users) {
      const normalizedEmail = (user.email ?? "").toLowerCase();
      if (targetEmails.has(normalizedEmail)) {
        usersByEmail.set(normalizedEmail, user.id);
      }
    }

    if (users.length < authPageSize) break;
  }

  for (const role of ROLES) {
    const email = `${role}.${tenant.slug}@${domain}`.toLowerCase();
    const fullName = roleFullName(role);

    // 3.1) Reutiliza usuário existente, independentemente da página no Auth.
    const existingUserId = usersByEmail.get(email) ?? null;

    let userId: string;
    let createdNew = false;
    if (existingUserId) {
      userId = existingUserId;
      // Reseta a senha para o padrão informado, garante email confirmado
      const { error: updateUserErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (updateUserErr) {
        results.push({
          role,
          email,
          user_id: userId,
          status: "existing",
          password_set: false,
          notes: `Falha ao atualizar usuário existente: ${updateUserErr.message}`,
        });
        continue;
      }
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (createErr || !created.user) {
        results.push({
          role,
          email,
          user_id: "",
          status: "existing",
          password_set: false,
          notes: `Falha ao criar: ${createErr?.message ?? "unknown"}`,
        });
        continue;
      }
      userId = created.user.id;
      createdNew = true;
    }

    // 3.2) Garante profile
    const { error: profileErr } = await admin
      .from("profiles")
      .upsert({ id: userId, full_name: fullName }, { onConflict: "id" });
    if (profileErr) {
      results.push({
        role,
        email,
        user_id: userId,
        status: createdNew ? "created" : "existing",
        password_set: true,
        notes: `Falha ao garantir perfil: ${profileErr.message}`,
      });
      continue;
    }

    // 3.3) Vincula como membro do tenant (exceto client puro do portal)
    if (role !== "client") {
      const { data: existingMembership } = await admin
        .from("tenant_memberships")
        .select("id, role, status")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();
      if (existingMembership) {
        await admin
          .from("tenant_memberships")
          .update({ role, status: "active", accepted_at: new Date().toISOString() })
          .eq("id", existingMembership.id);
      } else {
        await admin.from("tenant_memberships").insert({
          tenant_id: tenantId,
          user_id: userId,
          role,
          status: "active",
          accepted_at: new Date().toISOString(),
        });
      }
    }

    // 3.4) Para professional: cria/atualiza registro em professionals
    if (role === "professional") {
      const { data: existingPro } = await admin
        .from("professionals")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existingPro) {
        await admin.from("professionals").insert({
          tenant_id: tenantId,
          user_id: userId,
          display_name: fullName,
          is_active: true,
        });
      }
    }

    // 3.5) Para client: cria registro em clients + client_users
    if (role === "client") {
      const { data: existingClient } = await admin
        .from("clients")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", email)
        .maybeSingle();

      let clientId: string;
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        const { data: newClient, error: cErr } = await admin
          .from("clients")
          .insert({
            tenant_id: tenantId,
            full_name: fullName,
            email,
            status: "active",
            preferred_unit_id: defaultUnit?.id ?? null,
          })
          .select("id")
          .single();
        if (cErr || !newClient) {
          results.push({
            role,
            email,
            user_id: userId,
            status: createdNew ? "created" : "existing",
            password_set: true,
            notes: `Falha ao criar cliente: ${cErr?.message}`,
          });
          continue;
        }
        clientId = newClient.id;
      }

      const { data: existingLink } = await admin
        .from("client_users")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("client_id", clientId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!existingLink) {
        await admin.from("client_users").insert({
          tenant_id: tenantId,
          client_id: clientId,
          user_id: userId,
          status: "active",
        });
      }
    }

    results.push({
      role,
      email,
      user_id: userId,
      status: createdNew ? "created" : "existing",
      password_set: true,
    });
  }

  // Não retornamos a senha — quem chamou já a forneceu.
  const safeAccounts = results.map(({ ...rest }) => rest);
  return json(
    {
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      accounts: safeAccounts,
    },
    200,
    headers,
  );
});

function roleFullName(role: RoleKey): string {
  switch (role) {
    case "owner":
      return "Proprietário Demo";
    case "manager":
      return "Gerente Demo";
    case "frontdesk":
      return "Recepção Demo";
    case "professional":
      return "Profissional Demo";
    case "client":
      return "Cliente Demo";
  }
}

function json(payload: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
