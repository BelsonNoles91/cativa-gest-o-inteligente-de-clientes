#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "VITE_SUPABASE_URL (ou SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findOwnerTenant() {
  const { data: users, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) throw listError;

  const owner = users.users.find(u => u.email === "owner.studio-teste-qa@cativa.test");
  if (!owner) {
    console.log("❌ Usuário owner.studio-teste-qa@cativa.test não encontrado");
    return null;
  }
  console.log("✅ Owner encontrado:", owner.id);

  const { data: members, error: memberError } = await supabase
    .from("team_members")
    .select("tenant_id, role")
    .eq("user_id", owner.id)
    .limit(1);

  if (memberError) throw memberError;
  if (!members || members.length === 0) {
    console.log("❌ Owner não está associado a nenhuma tenant em team_members");
    return null;
  }

  const tenantId = members[0].tenant_id;
  console.log("✅ Tenant do owner:", tenantId);
  return { ownerId: owner.id, tenantId };
}

async function createTestUser(email, password) {
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({
    perPage: 1000,
  });
  if (listError) throw listError;

  const found = existing.users.find(u => u.email === email);
  if (found) {
    console.log(`✅ Usuário ${email} já existe:`, found.id);
    return found.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: email.split(".")[0] },
  });

  if (error) throw error;
  console.log(`✅ Usuário criado: ${email} → ${data.user.id}`);
  return data.user.id;
}

async function ensureTeamMember(userId, tenantId, role) {
  const { data: existing } = await supabase
    .from("team_members")
    .select("id")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .limit(1);

  if (existing && existing.length > 0) {
    const { error: updError } = await supabase
      .from("team_members")
      .update({ role })
      .eq("user_id", userId)
      .eq("tenant_id", tenantId);
    if (updError) throw updError;
    console.log(`✅ Role atualizada para ${role}`);
  } else {
    const { error: insError } = await supabase
      .from("team_members")
      .insert({ user_id: userId, tenant_id: tenantId, role });
    if (insError) throw insError;
    console.log(`✅ Team member criado: ${role}`);
  }
}

async function applyMigration() {
  const sql = `
CREATE OR REPLACE FUNCTION public.create_team_invitation(
  _tenant_id uuid,
  _email text,
  _role app_role,
  _message text DEFAULT NULL,
  _expires_in_days int DEFAULT 14
)
RETURNS TABLE (
  id uuid,
  token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_token text;
  v_invite public.team_invitations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;
  IF NOT (
    public.has_any_tenant_role(v_user, _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para convidar nesta loja' USING errcode = '42501';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel inválido para convite' USING errcode = '22023';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.team_invitations (
    tenant_id, email, role, invited_by, message, expires_at, token
  ) VALUES (
    _tenant_id, lower(_email), _role, v_user, _message,
    now() + make_interval(days => GREATEST(_expires_in_days, 1)),
    v_token
  )
  RETURNING * INTO v_invite;

  UPDATE public.team_invitations
     SET token = NULL
   WHERE public.team_invitations.id = v_invite.id;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, v_user, 'team.invitation_created', 'team_invitation', v_invite.id,
            jsonb_build_object('email', lower(_email), 'role', _role));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  id := v_invite.id;
  token := v_token;
  expires_at := v_invite.expires_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_invitation(uuid, text, app_role, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_provision_team_invitation(
  _tenant_id uuid,
  _email text,
  _role app_role,
  _message text DEFAULT NULL,
  _expires_in_days int DEFAULT 14
)
RETURNS TABLE (
  id uuid,
  token text,
  email text,
  role app_role,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_invite public.team_invitations;
  v_existing public.team_invitations;
  v_tenant public.tenants;
  v_token text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode provisionar usuários' USING errcode = '42501';
  END IF;
  IF v_email IS NULL OR v_email !~ '^.+@.+\\..+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING errcode = '22023';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel inválido para convite de equipe' USING errcode = '22023';
  END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE public.tenants.id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING errcode = 'P0002';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  SELECT * INTO v_existing
    FROM public.team_invitations
   WHERE public.team_invitations.tenant_id = _tenant_id
     AND lower(public.team_invitations.email) = v_email
     AND public.team_invitations.status = 'pending'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.team_invitations
       SET role = _role,
           message = COALESCE(_message, public.team_invitations.message),
           expires_at = now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
           token = v_token,
           updated_at = now()
     WHERE public.team_invitations.id = v_existing.id
     RETURNING * INTO v_invite;
  ELSE
    INSERT INTO public.team_invitations (
      tenant_id, email, role, invited_by, message, expires_at, token
    ) VALUES (
      _tenant_id, v_email, _role, auth.uid(), _message,
      now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
      v_token
    )
    RETURNING * INTO v_invite;
  END IF;

  UPDATE public.team_invitations
     SET token = NULL
   WHERE public.team_invitations.id = v_invite.id;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, auth.uid(),
            'admin.team.invitation_provisioned', 'team_invitation', v_invite.id,
            jsonb_build_object('email', v_email, 'role', _role));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  id := v_invite.id;
  token := v_token;
  email := v_invite.email;
  role := v_invite.role;
  expires_at := v_invite.expires_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_provision_team_invitation(uuid, text, app_role, text, integer) TO authenticated;
`;

  // Não podemos executar DDL via PostgREST. Salvamos o SQL para execução manual.
  console.log("⚠️ A migração SQL precisa ser aplicada manualmente no SQL Editor do Supabase.");
  console.log("   Salvando script em scripts/remote-migration-fix.sql ...");
  const fs = await import("node:fs");
  fs.writeFileSync("scripts/remote-migration-fix.sql", sql);
  return false;
}

async function main() {
  console.log("=== Cativa Remote Fix ===\n");

  const tenantInfo = await findOwnerTenant();
  if (!tenantInfo) {
    console.log("\n⚠️ Não foi possível identificar a tenant do owner.");
    process.exit(1);
  }

  const { tenantId } = tenantInfo;

  // Criar usuários de teste
  const users = [
    { email: "manager.studio-teste-qa@cativa.test", pass: "Cativa@2026", role: "manager" },
    { email: "frontdesk.studio-teste-qa@cativa.test", pass: "Cativa@2026", role: "frontdesk" },
    { email: "professional.studio-teste-qa@cativa.test", pass: "Cativa@2026", role: "professional" },
  ];

  for (const u of users) {
    try {
      const userId = await createTestUser(u.email, u.pass);
      await ensureTeamMember(userId, tenantId, u.role);
    } catch (err) {
      console.error(`❌ Erro com ${u.email}:`, err.message);
    }
  }

  await applyMigration();

  console.log("\n✅ Usuários de teste criados/atualizados com sucesso!");
  console.log("⚠️  Aplique o arquivo scripts/remote-migration-fix.sql no SQL Editor do Supabase.");
}

main().catch(err => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
