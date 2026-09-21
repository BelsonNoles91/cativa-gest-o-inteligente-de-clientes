-- ============================================================================
-- Testes de regressão de RLS
--
-- Cobre:
--   1. system_incidents  -> leitura apenas para usuários autenticados
--   2. team_invitations  -> token/token_hash inacessíveis fora do service_role
--   3. tenant_memberships-> owner/manager veem a equipe, professional só a
--      própria linha, super_admin vê tudo, outro tenant não vê nada
--
-- Executa dentro de uma transação e faz ROLLBACK: nada é persistido.
-- Uso: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls-regression.sql
-- ============================================================================

\set ON_ERROR_STOP on
\timing off

BEGIN;

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE rls_fixture (key text primary key, id uuid) ON COMMIT DROP;

INSERT INTO rls_fixture (key, id) VALUES
  ('tenant_a', gen_random_uuid()),
  ('tenant_b', gen_random_uuid()),
  ('owner_a', gen_random_uuid()),
  ('manager_a', gen_random_uuid()),
  ('professional_a', gen_random_uuid()),
  ('owner_b', gen_random_uuid()),
  ('super', gen_random_uuid()),
  ('incident', gen_random_uuid()),
  ('invitation', gen_random_uuid());

CREATE OR REPLACE FUNCTION pg_temp.fid(_key text) RETURNS uuid
LANGUAGE sql STABLE AS $$ SELECT id FROM rls_fixture WHERE key = _key $$;

CREATE OR REPLACE FUNCTION pg_temp.assert(_cond boolean, _msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF _cond IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FALHOU: %', _msg;
  END IF;
  RAISE NOTICE 'ok   %', _msg;
END $$;

-- Usuários de auth
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
SELECT f.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       f.key || '+rlstest@example.test', '', now(), now(), now()
FROM rls_fixture f
WHERE f.key IN ('owner_a', 'manager_a', 'professional_a', 'owner_b', 'super');

INSERT INTO public.profiles (id, full_name, is_super_admin)
SELECT f.id, f.key, f.key = 'super'
FROM rls_fixture f
WHERE f.key IN ('owner_a', 'manager_a', 'professional_a', 'owner_b', 'super')
ON CONFLICT (id) DO UPDATE SET is_super_admin = EXCLUDED.is_super_admin;

INSERT INTO public.tenants (id, name, slug, segment, created_by)
VALUES
  (pg_temp.fid('tenant_a'), 'Tenant A RLS', 'tenant-a-rls-test', 'salao', pg_temp.fid('owner_a')),
  (pg_temp.fid('tenant_b'), 'Tenant B RLS', 'tenant-b-rls-test', 'salao', pg_temp.fid('owner_b'));

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
VALUES
  (pg_temp.fid('tenant_a'), pg_temp.fid('owner_a'), 'owner', 'active'),
  (pg_temp.fid('tenant_a'), pg_temp.fid('manager_a'), 'manager', 'active'),
  (pg_temp.fid('tenant_a'), pg_temp.fid('professional_a'), 'professional', 'active'),
  (pg_temp.fid('tenant_b'), pg_temp.fid('owner_b'), 'owner', 'active');

INSERT INTO public.system_incidents (id, title, description, status, severity)
VALUES (pg_temp.fid('incident'), 'Incidente de teste RLS', 'fixture', 'investigating', 'minor');

INSERT INTO public.team_invitations (id, tenant_id, email, role, token, token_hash, invited_by, status, expires_at)
VALUES (pg_temp.fid('invitation'), pg_temp.fid('tenant_a'), 'convidado+rlstest@example.test', 'manager',
        'token-secreto-teste', encode(digest('token-secreto-teste', 'sha256'), 'hex'),
        pg_temp.fid('owner_a'), 'pending', now() + interval '7 days');

-- ---------------------------------------------------------------------------
-- Helper: executa um SELECT como determinado papel/uid
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.count_as(_role text, _uid uuid, _sql text)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE
  v_count bigint;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', _role);
  IF _uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', NULL, true);
  ELSE
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _uid, 'role', _role)::text, true);
  END IF;
  EXECUTE _sql INTO v_count;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE;
END $$;

-- ===========================================================================
-- 1. system_incidents
-- ===========================================================================
DO $$
DECLARE
  v_anon bigint;
  v_auth bigint;
BEGIN
  v_anon := pg_temp.count_as('anon', NULL,
    'SELECT count(*) FROM public.system_incidents');
  PERFORM pg_temp.assert(v_anon = 0,
    'system_incidents: anônimo não lê nenhum incidente');

  v_auth := pg_temp.count_as('authenticated', pg_temp.fid('professional_a'),
    format('SELECT count(*) FROM public.system_incidents WHERE id = %L', pg_temp.fid('incident')));
  PERFORM pg_temp.assert(v_auth = 1,
    'system_incidents: usuário autenticado lê incidentes');
END $$;

DO $$
DECLARE
  v_ok boolean := false;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.fid('professional_a'), 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE public.system_incidents SET title = 'hack' WHERE id = pg_temp.fid('incident');
    v_ok := NOT FOUND;
  EXCEPTION WHEN insufficient_privilege THEN
    v_ok := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  PERFORM pg_temp.assert(v_ok,
    'system_incidents: usuário comum não altera incidentes (apenas super_admin)');
END $$;

-- ===========================================================================
-- 2. team_invitations — token/token_hash
-- ===========================================================================
DO $$
BEGIN
  PERFORM pg_temp.assert(
    NOT has_column_privilege('authenticated', 'public.team_invitations', 'token', 'SELECT'),
    'team_invitations: authenticated não tem SELECT na coluna token');
  PERFORM pg_temp.assert(
    NOT has_column_privilege('authenticated', 'public.team_invitations', 'token_hash', 'SELECT'),
    'team_invitations: authenticated não tem SELECT na coluna token_hash');
  PERFORM pg_temp.assert(
    NOT has_column_privilege('anon', 'public.team_invitations', 'token', 'SELECT'),
    'team_invitations: anon não tem SELECT na coluna token');
  PERFORM pg_temp.assert(
    has_column_privilege('service_role', 'public.team_invitations', 'token', 'SELECT'),
    'team_invitations: service_role mantém acesso a token');
  PERFORM pg_temp.assert(
    has_column_privilege('authenticated', 'public.team_invitations', 'email', 'SELECT'),
    'team_invitations: authenticated ainda lê colunas não sensíveis (email)');
END $$;

DO $$
DECLARE
  v_blocked boolean := false;
BEGIN
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.fid('owner_a'), 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM token FROM public.team_invitations WHERE id = pg_temp.fid('invitation');
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  PERFORM pg_temp.assert(v_blocked,
    'team_invitations: owner autenticado recebe erro ao tentar ler token');
END $$;

DO $$
DECLARE
  v_owner bigint;
  v_other bigint;
BEGIN
  v_owner := pg_temp.count_as('authenticated', pg_temp.fid('owner_a'),
    format('SELECT count(*) FROM public.team_invitations WHERE id = %L', pg_temp.fid('invitation')));
  PERFORM pg_temp.assert(v_owner = 1,
    'team_invitations: owner do tenant lê o convite (sem colunas sensíveis)');

  v_other := pg_temp.count_as('authenticated', pg_temp.fid('owner_b'),
    format('SELECT count(*) FROM public.team_invitations WHERE id = %L', pg_temp.fid('invitation')));
  PERFORM pg_temp.assert(v_other = 0,
    'team_invitations: owner de outro tenant não lê o convite');
END $$;

-- ===========================================================================
-- 3. tenant_memberships — gap owner/manager e super_admin
-- ===========================================================================
DO $$
DECLARE
  v bigint;
  v_tenant_a uuid := pg_temp.fid('tenant_a');
BEGIN
  v := pg_temp.count_as('authenticated', pg_temp.fid('owner_a'),
    format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', v_tenant_a));
  PERFORM pg_temp.assert(v = 3, 'memberships: owner vê toda a equipe do próprio tenant');

  v := pg_temp.count_as('authenticated', pg_temp.fid('manager_a'),
    format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', v_tenant_a));
  PERFORM pg_temp.assert(v = 3, 'memberships: manager vê toda a equipe do próprio tenant');

  v := pg_temp.count_as('authenticated', pg_temp.fid('professional_a'),
    format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', v_tenant_a));
  PERFORM pg_temp.assert(v = 1, 'memberships: professional vê apenas a própria linha');

  v := pg_temp.count_as('authenticated', pg_temp.fid('owner_b'),
    format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', v_tenant_a));
  PERFORM pg_temp.assert(v = 0, 'memberships: owner de outro tenant não vê a equipe alheia');

  v := pg_temp.count_as('authenticated', pg_temp.fid('super'),
    format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', v_tenant_a));
  PERFORM pg_temp.assert(v = 3, 'memberships: super_admin vê a equipe de qualquer tenant');

  v := pg_temp.count_as('anon', NULL,
    format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', v_tenant_a));
  PERFORM pg_temp.assert(v = 0, 'memberships: anônimo não vê nenhuma membership');
END $$;

DO $$
DECLARE
  v_blocked boolean := false;
  v_allowed boolean := false;
BEGIN
  -- professional não pode promover a si mesmo
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.fid('professional_a'), 'role', 'authenticated')::text, true);
  BEGIN
    UPDATE public.tenant_memberships SET role = 'owner'
    WHERE tenant_id = pg_temp.fid('tenant_a') AND user_id = pg_temp.fid('professional_a');
    v_blocked := NOT FOUND;
  EXCEPTION WHEN insufficient_privilege THEN
    v_blocked := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  PERFORM pg_temp.assert(v_blocked, 'memberships: professional não consegue se promover a owner');

  -- manager pode atualizar membros do próprio tenant
  SET LOCAL ROLE authenticated;
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', pg_temp.fid('manager_a'), 'role', 'authenticated')::text, true);
  UPDATE public.tenant_memberships SET status = 'suspended'
  WHERE tenant_id = pg_temp.fid('tenant_a') AND user_id = pg_temp.fid('professional_a');
  v_allowed := FOUND;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  PERFORM pg_temp.assert(v_allowed, 'memberships: manager atualiza membros do próprio tenant');
END $$;

\echo 'Todos os testes de regressão de RLS passaram.'

ROLLBACK;
