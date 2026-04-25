-- =============================================================================
-- Cativa — Aplicação segura de schema faltante (idempotente)
-- Este script pode ser executado múltiplas vezes sem erro.
-- =============================================================================

-- =============================================================================
-- EXTENSÕES
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUMS (safe — ignora se já existir)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'super_admin', 'owner', 'manager', 'frontdesk', 'professional', 'client'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_segment') THEN
    CREATE TYPE public.tenant_segment AS ENUM (
      'salao', 'clinica_estetica', 'lash_brow', 'barbearia', 'esmalteria', 'wellness'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tenant_status') THEN
    CREATE TYPE public.tenant_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'suspended');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membership_status') THEN
    CREATE TYPE public.membership_status AS ENUM ('active', 'invited', 'suspended');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_invitation_status') THEN
    CREATE TYPE public.team_invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
  END IF;
END $$;

-- =============================================================================
-- HELPER: updated_at trigger (idempotente)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- PROFILES (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     TEXT,
  avatar_url    TEXT,
  phone         TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-cria profile quando novo usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', SPLIT_PART(NEW.email, '@', 1)),
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- TENANTS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  segment       public.tenant_segment NOT NULL,
  status        public.tenant_status NOT NULL DEFAULT 'trialing',
  timezone      TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  currency      TEXT NOT NULL DEFAULT 'BRL',
  locale        TEXT NOT NULL DEFAULT 'pt-BR',
  trial_ends_at TIMESTAMPTZ,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tenants_set_updated_at ON public.tenants;
CREATE TRIGGER tenants_set_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- UNITS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.units (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  address_line1 TEXT,
  address_line2 TEXT,
  city          TEXT,
  state         TEXT,
  postal_code   TEXT,
  country       TEXT DEFAULT 'BR',
  phone         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS units_tenant_idx ON public.units(tenant_id);

DROP TRIGGER IF EXISTS units_set_updated_at ON public.units;
CREATE TRIGGER units_set_updated_at
BEFORE UPDATE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- TENANT MEMBERSHIPS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          public.app_role NOT NULL,
  status        public.membership_status NOT NULL DEFAULT 'active',
  invited_email TEXT,
  invited_at    TIMESTAMPTZ,
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS tenant_memberships_user_idx ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS tenant_memberships_tenant_idx ON public.tenant_memberships(tenant_id);

DROP TRIGGER IF EXISTS tenant_memberships_set_updated_at ON public.tenant_memberships;
CREATE TRIGGER tenant_memberships_set_updated_at
BEFORE UPDATE ON public.tenant_memberships
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- PERMISSIONS + ROLE_PERMISSIONS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.permissions (
  key         TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role           public.app_role NOT NULL,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_key)
);

-- Catálogo inicial (idempotente via ON CONFLICT)
INSERT INTO public.permissions (key, description) VALUES
  ('tenant.read',       'Visualizar dados do estabelecimento'),
  ('tenant.update',     'Editar dados do estabelecimento'),
  ('units.manage',      'Gerenciar unidades'),
  ('team.manage',       'Gerenciar equipe e convites'),
  ('settings.update',   'Atualizar configurações e branding'),
  ('clients.manage',    'Gerenciar clientes'),
  ('appointments.manage','Gerenciar agendamentos'),
  ('appointments.read', 'Visualizar agendamentos'),
  ('services.manage',   'Gerenciar serviços e pacotes'),
  ('analytics.read',    'Visualizar analytics'),
  ('audit.read',        'Visualizar logs de auditoria')
ON CONFLICT (key) DO NOTHING;

-- Mapeamento por papel (idempotente)
INSERT INTO public.role_permissions (role, permission_key)
SELECT 'owner'::public.app_role, key FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key) VALUES
  ('manager', 'tenant.read'),
  ('manager', 'tenant.update'),
  ('manager', 'units.manage'),
  ('manager', 'team.manage'),
  ('manager', 'settings.update'),
  ('manager', 'clients.manage'),
  ('manager', 'appointments.manage'),
  ('manager', 'appointments.read'),
  ('manager', 'services.manage'),
  ('manager', 'analytics.read'),
  ('frontdesk', 'tenant.read'),
  ('frontdesk', 'clients.manage'),
  ('frontdesk', 'appointments.manage'),
  ('frontdesk', 'appointments.read'),
  ('professional', 'tenant.read'),
  ('professional', 'appointments.read'),
  ('client', 'tenant.read')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- TENANT SETTINGS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.tenant_settings (
  tenant_id           UUID PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url            TEXT,
  brand_primary       TEXT,
  brand_secondary     TEXT,
  brand_accent        TEXT,
  whatsapp_phone      TEXT,
  default_unit_id     UUID REFERENCES public.units(id) ON DELETE SET NULL,
  appointment_buffer_minutes INTEGER NOT NULL DEFAULT 0,
  cancellation_policy TEXT,
  preferences         JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS tenant_settings_set_updated_at ON public.tenant_settings;
CREATE TRIGGER tenant_settings_set_updated_at
BEFORE UPDATE ON public.tenant_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- UNIT SETTINGS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.unit_settings (
  unit_id     UUID PRIMARY KEY REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  opening_hours JSONB NOT NULL DEFAULT '{}'::JSONB,
  preferences   JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS unit_settings_set_updated_at ON public.unit_settings;
CREATE TRIGGER unit_settings_set_updated_at
BEFORE UPDATE ON public.unit_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- PROFESSIONALS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.professionals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  unit_id       UUID REFERENCES public.units(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  display_name  TEXT NOT NULL,
  role_title    TEXT,
  bio           TEXT,
  color         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS professionals_tenant_idx ON public.professionals(tenant_id);
CREATE INDEX IF NOT EXISTS professionals_unit_idx ON public.professionals(unit_id);

DROP TRIGGER IF EXISTS professionals_set_updated_at ON public.professionals;
CREATE TRIGGER professionals_set_updated_at
BEFORE UPDATE ON public.professionals
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- AUDIT LOGS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity      TEXT,
  entity_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_tenant_idx ON public.audit_logs(tenant_id, created_at DESC);

-- =============================================================================
-- TEAM INVITATIONS (idempotente)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  role          public.app_role NOT NULL,
  token         TEXT UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  token_hash    TEXT,
  status        public.team_invitation_status NOT NULL DEFAULT 'pending',
  invited_by    UUID,
  message       TEXT,
  expires_at    TIMESTAMPTZ,
  accepted_by   UUID,
  accepted_at   TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT team_invitations_email_format CHECK (email ~* '^.+@.+\..+$'),
  CONSTRAINT team_invitations_role_not_super CHECK (role <> 'super_admin'::public.app_role)
);

-- Remove NOT NULL da coluna token se existia
ALTER TABLE public.team_invitations ALTER COLUMN token DROP NOT NULL;

-- Índices team_invitations
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_unique_pending
ON public.team_invitations (tenant_id, LOWER(email))
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS team_invitations_tenant_status_idx
ON public.team_invitations (tenant_id, status);

CREATE INDEX IF NOT EXISTS team_invitations_email_status_idx
ON public.team_invitations (LOWER(email), status);

CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_token_hash_idx
ON public.team_invitations (token_hash)
WHERE token_hash IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at_team_invitations ON public.team_invitations;
CREATE TRIGGER set_updated_at_team_invitations
BEFORE UPDATE ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger para hash de token
CREATE OR REPLACE FUNCTION public.team_invitations_hash_token()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.token IS NOT NULL THEN
    NEW.token_hash = encode(extensions.digest(NEW.token, 'sha256'), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_invitations_hash_token_trg ON public.team_invitations;
CREATE TRIGGER team_invitations_hash_token_trg
BEFORE INSERT OR UPDATE OF token ON public.team_invitations
FOR EACH ROW EXECUTE FUNCTION public.team_invitations_hash_token();

-- =============================================================================
-- SECURITY DEFINER HELPERS (idempotente)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.profiles WHERE id = _user_id), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.has_tenant_role(_user_id UUID, _tenant_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND status = 'active'
      AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.has_any_tenant_role(_user_id UUID, _tenant_id UUID, _roles public.app_role[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND status = 'active'
      AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tenant_member(_user_id UUID, _tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND status = 'active'
  );
$$;

-- =============================================================================
-- RLS POLICIES — Enable + Policies (idempotente)
-- =============================================================================
ALTER TABLE public.profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unit_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professionals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_invitations    ENABLE ROW LEVEL SECURITY;

-- ---------- profiles ----------
DROP POLICY IF EXISTS "profiles: ver próprio perfil" ON public.profiles;
CREATE POLICY "profiles: ver próprio perfil"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles: atualizar próprio perfil" ON public.profiles;
CREATE POLICY "profiles: atualizar próprio perfil"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.is_super_admin(auth.uid()))
WITH CHECK (id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles: insert próprio perfil" ON public.profiles;
CREATE POLICY "profiles: insert próprio perfil"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid());

-- ---------- tenants ----------
DROP POLICY IF EXISTS "tenants: membros podem ler" ON public.tenants;
CREATE POLICY "tenants: membros podem ler"
ON public.tenants FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), id) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tenants: usuário autenticado pode criar" ON public.tenants;
CREATE POLICY "tenants: usuário autenticado pode criar"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "tenants: owner/manager podem atualizar" ON public.tenants;
CREATE POLICY "tenants: owner/manager podem atualizar"
ON public.tenants FOR UPDATE TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "tenants: super admin pode deletar" ON public.tenants;
CREATE POLICY "tenants: super admin pode deletar"
ON public.tenants FOR DELETE TO authenticated
USING (public.is_super_admin(auth.uid()));

-- ---------- units ----------
DROP POLICY IF EXISTS "units: membros leem" ON public.units;
CREATE POLICY "units: membros leem"
ON public.units FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "units: owner/manager gerenciam" ON public.units;
CREATE POLICY "units: owner/manager gerenciam"
ON public.units FOR ALL TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

-- ---------- tenant_memberships ----------
DROP POLICY IF EXISTS "memberships: usuário vê as próprias" ON public.tenant_memberships;
CREATE POLICY "memberships: usuário vê as próprias"
ON public.tenant_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "memberships: owner/manager veem equipe" ON public.tenant_memberships;
CREATE POLICY "memberships: owner/manager veem equipe"
ON public.tenant_memberships FOR SELECT TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
);

DROP POLICY IF EXISTS "memberships: criar membership" ON public.tenant_memberships;
CREATE POLICY "memberships: criar membership"
ON public.tenant_memberships FOR INSERT TO authenticated
WITH CHECK (
  (user_id = auth.uid() AND role = 'owner')
  OR public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "memberships: owner/manager atualizam" ON public.tenant_memberships;
CREATE POLICY "memberships: owner/manager atualizam"
ON public.tenant_memberships FOR UPDATE TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "memberships: owner/manager removem" ON public.tenant_memberships;
CREATE POLICY "memberships: owner/manager removem"
ON public.tenant_memberships FOR DELETE TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

-- ---------- permissions / role_permissions ----------
DROP POLICY IF EXISTS "permissions: leitura para autenticados" ON public.permissions;
CREATE POLICY "permissions: leitura para autenticados"
ON public.permissions FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS "role_permissions: leitura para autenticados" ON public.role_permissions;
CREATE POLICY "role_permissions: leitura para autenticados"
ON public.role_permissions FOR SELECT TO authenticated USING (TRUE);

-- ---------- tenant_settings ----------
DROP POLICY IF EXISTS "tenant_settings: membros leem" ON public.tenant_settings;
CREATE POLICY "tenant_settings: membros leem"
ON public.tenant_settings FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "tenant_settings: owner/manager gerenciam" ON public.tenant_settings;
CREATE POLICY "tenant_settings: owner/manager gerenciam"
ON public.tenant_settings FOR ALL TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

-- ---------- unit_settings ----------
DROP POLICY IF EXISTS "unit_settings: membros leem" ON public.unit_settings;
CREATE POLICY "unit_settings: membros leem"
ON public.unit_settings FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "unit_settings: owner/manager gerenciam" ON public.unit_settings;
CREATE POLICY "unit_settings: owner/manager gerenciam"
ON public.unit_settings FOR ALL TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

-- ---------- professionals ----------
DROP POLICY IF EXISTS "professionals: membros leem" ON public.professionals;
CREATE POLICY "professionals: membros leem"
ON public.professionals FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "professionals: owner/manager gerenciam" ON public.professionals;
CREATE POLICY "professionals: owner/manager gerenciam"
ON public.professionals FOR ALL TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

-- ---------- audit_logs ----------
DROP POLICY IF EXISTS "audit_logs: owner/manager leem" ON public.audit_logs;
CREATE POLICY "audit_logs: owner/manager leem"
ON public.audit_logs FOR SELECT TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "audit_logs: membros podem registrar" ON public.audit_logs;
CREATE POLICY "audit_logs: membros podem registrar"
ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (
  public.is_tenant_member(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);

-- ---------- team_invitations ----------
DROP POLICY IF EXISTS "team_invitations: gestor gerencia" ON public.team_invitations;
CREATE POLICY "team_invitations: gestor gerencia"
ON public.team_invitations FOR ALL TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "team_invitations: convidado lê próprio" ON public.team_invitations;
CREATE POLICY "team_invitations: convidado lê próprio"
ON public.team_invitations FOR SELECT TO authenticated
USING (LOWER(email) = LOWER(auth.jwt() ->> 'email'));

-- =============================================================================
-- FUNÇÕES DE CONVITE (idempotente — CREATE OR REPLACE)
-- =============================================================================

-- accept_team_invitation
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token TEXT)
RETURNS public.tenant_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_email TEXT := LOWER(COALESCE(auth.jwt() ->> 'email', ''));
  v_hash TEXT := encode(extensions.digest(_token, 'sha256'), 'hex');
  v_invite public.team_invitations;
  v_existing public.tenant_memberships;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_invite
    FROM public.team_invitations
   WHERE token_hash = v_hash;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF v_invite.status = 'accepted' THEN
    RAISE EXCEPTION 'Convite já foi aceito' USING ERRCODE = '23505';
  END IF;

  IF v_invite.status = 'expired' OR v_invite.status = 'revoked' OR v_invite.expires_at <= NOW() THEN
    UPDATE public.team_invitations
       SET status = 'expired', updated_at = NOW()
     WHERE id = v_invite.id;
    RAISE EXCEPTION 'Convite expirado ou revogado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_existing
    FROM public.tenant_memberships
   WHERE tenant_id = v_invite.tenant_id
     AND user_id = v_user;

  IF FOUND THEN
    RAISE EXCEPTION 'Usuário já é membro deste tenant' USING ERRCODE = '23505';
  END IF;

  UPDATE public.team_invitations
     SET status = 'accepted',
         accepted_by = v_user,
         accepted_at = NOW(),
         updated_at = NOW()
   WHERE id = v_invite.id;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status, invited_email, invited_at, accepted_at)
  VALUES (v_invite.tenant_id, v_user, v_invite.role, 'active', v_invite.email, v_invite.created_at, NOW())
  RETURNING * INTO v_existing;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
      v_invite.tenant_id, v_user, 'team.invitation_accepted', 'team_invitation', v_invite.id,
      jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_existing;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_team_invitation(TEXT) TO authenticated;

-- revoke_team_invitation
CREATE OR REPLACE FUNCTION public.revoke_team_invitation(_invitation_id UUID)
RETURNS public.team_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_invite public.team_invitations;
  v_updated public.team_invitations;
BEGIN
  SELECT * INTO v_invite FROM public.team_invitations WHERE id = _invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    public.has_any_tenant_role(v_user, v_invite.tenant_id, ARRAY['owner','manager']::public.app_role[])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = '42501';
  END IF;

  UPDATE public.team_invitations
     SET status = 'revoked',
         revoked_at = NOW(),
         updated_at = NOW()
   WHERE id = _invitation_id
   RETURNING * INTO v_updated;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
      v_invite.tenant_id, v_user, 'team.invitation_revoked', 'team_invitation', v_invite.id,
      jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_updated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_team_invitation(UUID) TO authenticated;

-- list_pending_invitations_for_current_user
CREATE OR REPLACE FUNCTION public.list_pending_invitations_for_current_user()
RETURNS SETOF public.team_invitations
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.*
    FROM public.team_invitations i
   WHERE i.status = 'pending'
     AND LOWER(i.email) = LOWER(auth.jwt() ->> 'email')
     AND i.expires_at > NOW();
$$;

GRANT EXECUTE ON FUNCTION public.list_pending_invitations_for_current_user() TO authenticated;

-- lookup_team_invitation
CREATE OR REPLACE FUNCTION public.lookup_team_invitation(_token TEXT)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  email TEXT,
  role public.app_role,
  status public.team_invitation_status,
  expires_at TIMESTAMPTZ,
  message TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.id, i.tenant_id, i.email, i.role, i.status, i.expires_at, i.message
    FROM public.team_invitations i
   WHERE i.token_hash = encode(extensions.digest(_token, 'sha256'), 'hex')
     AND i.status = 'pending'
     AND i.expires_at > NOW();
$$;

GRANT EXECUTE ON FUNCTION public.lookup_team_invitation(TEXT) TO authenticated;

-- =============================================================================
-- create_team_invitation (FIX — sem ambiguous id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.create_team_invitation(
  _tenant_id UUID,
  _email TEXT,
  _role public.app_role,
  _message TEXT DEFAULT NULL,
  _expires_in_days INT DEFAULT 14
)
RETURNS TABLE (
  id UUID,
  token TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_token TEXT;
  v_invite public.team_invitations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_any_tenant_role(v_user, _tenant_id, ARRAY['owner'::public.app_role, 'manager'::public.app_role])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para convidar nesta loja' USING ERRCODE = '42501';
  END IF;

  IF _role IN ('super_admin'::public.app_role, 'client'::public.app_role) THEN
    RAISE EXCEPTION 'Papel inválido para convite' USING ERRCODE = '22023';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.team_invitations (
    tenant_id, email, role, invited_by, message, expires_at, token
  ) VALUES (
    _tenant_id, LOWER(_email), _role, v_user, _message,
    NOW() + make_interval(days => GREATEST(_expires_in_days, 1)),
    v_token
  )
  RETURNING * INTO v_invite;

  UPDATE public.team_invitations
     SET token = NULL
   WHERE public.team_invitations.id = v_invite.id;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, v_user, 'team.invitation_created', 'team_invitation', v_invite.id,
            jsonb_build_object('email', LOWER(_email), 'role', _role));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  id := v_invite.id;
  token := v_token;
  expires_at := v_invite.expires_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_invitation(UUID, TEXT, public.app_role, TEXT, INT) TO authenticated;

-- =============================================================================
-- admin_provision_team_invitation (FIX — sem ambiguous id)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_provision_team_invitation(
  _tenant_id UUID,
  _email TEXT,
  _role public.app_role,
  _message TEXT DEFAULT NULL,
  _expires_in_days INT DEFAULT 14
)
RETURNS TABLE (
  id UUID,
  token TEXT,
  email TEXT,
  role public.app_role,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := LOWER(TRIM(_email));
  v_invite public.team_invitations;
  v_existing public.team_invitations;
  v_tenant public.tenants;
  v_token TEXT;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode provisionar usuários' USING ERRCODE = '42501';
  END IF;

  IF v_email IS NULL OR v_email !~ '^.+@.+\..+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING ERRCODE = '22023';
  END IF;

  IF _role IN ('super_admin'::public.app_role, 'client'::public.app_role) THEN
    RAISE EXCEPTION 'Papel inválido para convite de equipe' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE public.tenants.id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING ERRCODE = 'P0002';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  SELECT * INTO v_existing
    FROM public.team_invitations
   WHERE public.team_invitations.tenant_id = _tenant_id
     AND LOWER(public.team_invitations.email) = v_email
     AND public.team_invitations.status = 'pending'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.team_invitations
       SET role = _role,
           message = COALESCE(_message, public.team_invitations.message),
           expires_at = NOW() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
           token = v_token,
           updated_at = NOW()
     WHERE public.team_invitations.id = v_existing.id
     RETURNING * INTO v_invite;
  ELSE
    INSERT INTO public.team_invitations (
      tenant_id, email, role, invited_by, message, expires_at, token
    ) VALUES (
      _tenant_id, v_email, _role, auth.uid(), _message,
      NOW() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
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

GRANT EXECUTE ON FUNCTION public.admin_provision_team_invitation(UUID, TEXT, public.app_role, TEXT, INT) TO authenticated;

-- =============================================================================
-- admin_list_team_invitations (idempotente)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.admin_list_team_invitations(_tenant_id UUID DEFAULT NULL)
RETURNS TABLE(
  id UUID,
  tenant_id UUID,
  email TEXT,
  role public.app_role,
  status public.team_invitation_status,
  invited_by UUID,
  message TEXT,
  expires_at TIMESTAMPTZ,
  accepted_by UUID,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  tenant_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT i.id, i.tenant_id, i.email, i.role, i.status, i.invited_by,
           i.message, i.expires_at, i.accepted_by, i.accepted_at, i.revoked_at,
           i.created_at, i.updated_at, t.name AS tenant_name
    FROM public.team_invitations i
    LEFT JOIN public.tenants t ON t.id = i.tenant_id
    WHERE (_tenant_id IS NULL OR i.tenant_id = _tenant_id)
    ORDER BY i.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_team_invitations(UUID) TO authenticated;

-- =============================================================================
-- BACKFILL: popula token_hash para registros existentes
-- =============================================================================
UPDATE public.team_invitations
   SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL
   AND token IS NOT NULL;

-- =============================================================================
-- FINAL: validação básica
-- =============================================================================
SELECT 'Schema aplicado com sucesso!' AS status;
