-- ============================================================================
-- Testes de regressão de RLS
--
-- Cobre:
--   1. system_incidents   -> leitura apenas para usuários autenticados
--   2. team_invitations   -> token/token_hash inacessíveis fora do service_role
--   3. tenant_memberships -> owner/manager veem a equipe, professional só a
--      própria linha, super_admin vê tudo, outro tenant não vê nada
--
-- Tudo roda em um único bloco (uma transação) com fixtures dedicadas que são
-- removidas ao final, inclusive em caso de falha.
--
-- Uso:
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls-regression.sql
--   npm run test:rls
--
-- Requer um papel com acesso ao schema auth (postgres/supabase_admin).
-- ============================================================================

DO $test$
DECLARE
  -- fixtures (UUIDs fixos, prefixo rls-test)
  t_a    uuid := '00000000-0000-4000-8000-00000000a001';
  t_b    uuid := '00000000-0000-4000-8000-00000000b001';
  u_own  uuid := '00000000-0000-4000-8000-0000000000a1';
  u_mng  uuid := '00000000-0000-4000-8000-0000000000a2';
  u_pro  uuid := '00000000-0000-4000-8000-0000000000a3';
  u_ownb uuid := '00000000-0000-4000-8000-0000000000b1';
  u_sup  uuid := '00000000-0000-4000-8000-0000000000f1';
  inc    uuid := '00000000-0000-4000-8000-00000000c001';
  inv    uuid := '00000000-0000-4000-8000-00000000d001';
  v      bigint;
  flag   boolean;
  n_rows int;
  failures int := 0;
BEGIN
  -- =========================================================================
  -- Limpeza defensiva + fixtures
  -- =========================================================================
  BEGIN
    DELETE FROM public.system_incidents WHERE id = inc;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.tenants WHERE id IN (t_a, t_b);
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM auth.users WHERE id IN (u_own, u_mng, u_pro, u_ownb, u_sup);
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  SELECT x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         x.label || '+rlstest@example.test', '', now(), now(), now()
  FROM (VALUES (u_own,'owner-a'), (u_mng,'manager-a'), (u_pro,'professional-a'),
               (u_ownb,'owner-b'), (u_sup,'super')) AS x(id, label);

  -- Os triggers de proteção impedem criar um super admin por INSERT direto
  -- (comportamento desejado). Para a fixture, desabilitamos temporariamente.
  ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_super_admin_changes_trg;
  ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_self_super_admin;

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (u_own,'Owner A',false), (u_mng,'Manager A',false), (u_pro,'Pro A',false),
         (u_ownb,'Owner B',false), (u_sup,'Super',true)
  ON CONFLICT (id) DO UPDATE SET is_super_admin = EXCLUDED.is_super_admin;

  ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_super_admin_changes_trg;
  ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_self_super_admin;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES (t_a, 'Tenant A RLS', 'tenant-a-rls-test', 'salao', u_own),
         (t_b, 'Tenant B RLS', 'tenant-b-rls-test', 'salao', u_ownb);

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (t_a, u_own, 'owner', 'active'),
         (t_a, u_mng, 'manager', 'active'),
         (t_a, u_pro, 'professional', 'active'),
         (t_b, u_ownb, 'owner', 'active');

  INSERT INTO public.system_incidents (id, title, description, status, severity)
  VALUES (inc, 'Incidente de teste RLS', 'fixture', 'investigating', 'low');

  INSERT INTO public.team_invitations (id, tenant_id, email, role, token, token_hash,
                                       invited_by, status, expires_at)
  VALUES (inv, t_a, 'convidado+rlstest@example.test', 'manager',
          'token-secreto-teste', md5('token-secreto-teste'), u_own, 'pending',
          now() + interval '7 days');

  -- =========================================================================
  -- 1. system_incidents
  -- =========================================================================
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', NULL, true);
  EXECUTE 'SELECT count(*) FROM public.system_incidents' INTO v;
  RESET ROLE;
  IF v <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: anônimo leu % incidente(s)', v;
  ELSE RAISE NOTICE 'ok  system_incidents: anônimo não lê incidentes'; END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_pro, 'role', 'authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.system_incidents WHERE id = %L', inc) INTO v;
  BEGIN
    EXECUTE format('UPDATE public.system_incidents SET title = ''hack'' WHERE id = %L', inc);
    GET DIAGNOSTICS n_rows = ROW_COUNT;
    flag := (n_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN flag := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: autenticado não conseguiu ler o incidente';
  ELSE RAISE NOTICE 'ok  system_incidents: autenticado lê incidentes'; END IF;
  IF NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: usuário comum alterou um incidente';
  ELSE RAISE NOTICE 'ok  system_incidents: usuário comum não altera incidentes'; END IF;

  -- =========================================================================
  -- 2. team_invitations — token / token_hash
  -- =========================================================================
  IF has_column_privilege('authenticated', 'public.team_invitations', 'token', 'SELECT')
     OR has_column_privilege('authenticated', 'public.team_invitations', 'token_hash', 'SELECT')
     OR has_column_privilege('anon', 'public.team_invitations', 'token', 'SELECT')
     OR has_column_privilege('anon', 'public.team_invitations', 'token_hash', 'SELECT') THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: token/token_hash acessível a anon ou authenticated';
  ELSE RAISE NOTICE 'ok  team_invitations: token/token_hash sem GRANT para anon/authenticated'; END IF;

  IF NOT has_column_privilege('service_role', 'public.team_invitations', 'token', 'SELECT')
     OR NOT has_column_privilege('service_role', 'public.team_invitations', 'token_hash', 'SELECT') THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: service_role perdeu acesso a token/token_hash';
  ELSE RAISE NOTICE 'ok  team_invitations: service_role mantém acesso ao token'; END IF;

  IF NOT has_column_privilege('authenticated', 'public.team_invitations', 'email', 'SELECT') THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: authenticated perdeu acesso às colunas não sensíveis';
  ELSE RAISE NOTICE 'ok  team_invitations: colunas não sensíveis continuam legíveis'; END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_own, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE format('SELECT count(token) FROM public.team_invitations WHERE id = %L', inv) INTO v;
    flag := false;
  EXCEPTION WHEN insufficient_privilege THEN flag := true;
  END;
  EXECUTE format('SELECT count(*) FROM public.team_invitations WHERE id = %L', inv) INTO v;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner autenticado conseguiu ler a coluna token';
  ELSE RAISE NOTICE 'ok  team_invitations: leitura do token é negada em runtime'; END IF;
  IF v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner do tenant não enxerga o convite';
  ELSE RAISE NOTICE 'ok  team_invitations: owner do tenant lê o convite'; END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_ownb, 'role', 'authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.team_invitations WHERE id = %L', inv) INTO v;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner de outro tenant enxergou o convite';
  ELSE RAISE NOTICE 'ok  team_invitations: convite não vaza para outro tenant'; END IF;

  -- =========================================================================
  -- 3. tenant_memberships — gap owner/manager e super_admin
  -- =========================================================================
  -- owner
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_own, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 3 THEN failures := failures + 1; RAISE WARNING 'FALHOU: owner viu % de 3 memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: owner vê toda a equipe'; END IF;

  -- manager
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_mng, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 3 THEN failures := failures + 1; RAISE WARNING 'FALHOU: manager viu % de 3 memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: manager vê toda a equipe'; END IF;

  -- professional
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_pro, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 1 THEN failures := failures + 1; RAISE WARNING 'FALHOU: professional viu % memberships (esperado 1)', v;
  ELSE RAISE NOTICE 'ok  memberships: professional vê apenas a própria linha'; END IF;

  -- outro tenant
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_ownb, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 0 THEN failures := failures + 1; RAISE WARNING 'FALHOU: owner de outro tenant viu % memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: equipe não vaza entre tenants'; END IF;

  -- super admin
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_sup, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 3 THEN failures := failures + 1; RAISE WARNING 'FALHOU: super_admin viu % de 3 memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: super_admin vê a equipe de qualquer tenant'; END IF;

  -- anônimo
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', NULL, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE;
  IF v <> 0 THEN failures := failures + 1; RAISE WARNING 'FALHOU: anônimo viu % memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: anônimo não vê memberships'; END IF;

  -- professional não se promove
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_pro, 'role','authenticated')::text, true);
  BEGIN
    EXECUTE format('UPDATE public.tenant_memberships SET role = ''owner'' WHERE tenant_id = %L AND user_id = %L', t_a, u_pro);
    GET DIAGNOSTICS n_rows = ROW_COUNT;
    flag := (n_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN flag := true;
  END;
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  IF NOT flag THEN failures := failures + 1; RAISE WARNING 'FALHOU: professional se promoveu a owner';
  ELSE RAISE NOTICE 'ok  memberships: professional não se promove'; END IF;

  -- manager atualiza membro do próprio tenant
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_mng, 'role','authenticated')::text, true);
  EXECUTE format('UPDATE public.tenant_memberships SET status = ''suspended'' WHERE tenant_id = %L AND user_id = %L', t_a, u_pro);
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  flag := (n_rows > 0);
  RESET ROLE; PERFORM set_config('request.jwt.claims', NULL, true);
  IF NOT flag THEN failures := failures + 1; RAISE WARNING 'FALHOU: manager não conseguiu atualizar membro do próprio tenant';
  ELSE RAISE NOTICE 'ok  memberships: manager atualiza membros do próprio tenant'; END IF;

  -- =========================================================================
  -- Limpeza (best-effort: o papel de execução pode não ter DELETE em todas
  -- as tabelas; isso não invalida os testes de RLS acima)
  -- =========================================================================
  BEGIN
    DELETE FROM public.system_incidents WHERE id = inc;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'aviso: sem privilégio para limpar system_incidents (%);', inc;
  END;
  BEGIN
    DELETE FROM public.tenants WHERE id IN (t_a, t_b);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'aviso: sem privilégio para limpar tenants de teste';
  END;
  BEGIN
    DELETE FROM auth.users WHERE id IN (u_own, u_mng, u_pro, u_ownb, u_sup);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'aviso: sem privilégio para limpar auth.users de teste';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'Testes de regressão de RLS: % falha(s)', failures;
  END IF;
  RAISE NOTICE 'Todos os testes de regressão de RLS passaram.';

EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_super_admin_changes_trg;
    ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_self_super_admin;
    DELETE FROM public.system_incidents WHERE id = inc;
    DELETE FROM public.tenants WHERE id IN (t_a, t_b);
    DELETE FROM auth.users WHERE id IN (u_own, u_mng, u_pro, u_ownb, u_sup);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END
$test$;
