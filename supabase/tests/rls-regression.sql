-- ============================================================================
-- Testes de regressão de RLS
--
-- Cobre:
--   1. system_incidents   -> leitura apenas para usuários autenticados
--   2. team_invitations   -> anon sem acesso direto; token/token_hash
--      inacessíveis fora do service_role; convidado lê o próprio convite via
--      e-mail assinado no JWT sem depender de SELECT em auth.users
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
  u_inv  uuid := '00000000-0000-4000-8000-0000000000a4';
  u_ownb uuid := '00000000-0000-4000-8000-0000000000b1';
  u_sup  uuid := '00000000-0000-4000-8000-0000000000f1';
  inc    uuid := '00000000-0000-4000-8000-00000000c001';
  inv    uuid := '00000000-0000-4000-8000-00000000d001';
  v_created_inv uuid;
  v_manager_inv uuid;
  v_admin_inv uuid;
  v_uuid uuid;
  v_token text;
  v_text text;
  v      bigint;
  flag   boolean;
  system_flags jsonb;
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
    DELETE FROM public.team_invitations
     WHERE id = inv
        OR email IN (
          'owner-created+rlstest@example.test',
          'manager-created+rlstest@example.test',
          'admin-created+rlstest@example.test'
        );
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.tenants WHERE id IN (t_a, t_b);
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM auth.users WHERE id IN (u_own, u_mng, u_pro, u_inv, u_ownb, u_sup);
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  SELECT x.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         x.label || '+rlstest@example.test', '', now(), now(), now()
  FROM (VALUES (u_own,'owner-a'), (u_mng,'manager-a'), (u_pro,'professional-a'),
               (u_inv,'convidado'), (u_ownb,'owner-b'), (u_sup,'super')) AS x(id, label);

  -- Os triggers de proteção impedem criar um super admin por INSERT direto
  -- (comportamento desejado). Para a fixture, desabilitamos temporariamente.
  ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_super_admin_changes_trg;
  ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_self_super_admin;

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (u_own,'Owner A',false), (u_mng,'Manager A',false), (u_pro,'Pro A',false),
         (u_inv,'Convidado',false), (u_ownb,'Owner B',false), (u_sup,'Super',true)
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
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  EXECUTE 'SELECT count(*) FROM public.system_incidents' INTO v;
  EXECUTE 'SELECT public.get_public_system_flags()' INTO system_flags;
  RESET ROLE;
  IF v <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: anônimo leu % incidente(s)', v;
  ELSE RAISE NOTICE 'ok  system_incidents: anônimo não lê incidentes'; END IF;

  IF (SELECT count(*) FROM jsonb_object_keys(system_flags)) <> 3
     OR jsonb_typeof(system_flags->'enable_signups') <> 'boolean'
     OR jsonb_typeof(system_flags->'maintenance_mode') <> 'boolean'
     OR jsonb_typeof(system_flags->'show_cativa_index') <> 'boolean' THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: RPC pública não retornou exatamente as três flags booleanas permitidas';
  ELSE
    RAISE NOTICE 'ok  system flags: anônimo lê apenas três controles públicos tipados';
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_pro::text, true);
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
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: autenticado não conseguiu ler o incidente';
  ELSE RAISE NOTICE 'ok  system_incidents: autenticado lê incidentes'; END IF;
  IF NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: usuário comum alterou um incidente';
  ELSE RAISE NOTICE 'ok  system_incidents: usuário comum não altera incidentes'; END IF;

  -- =========================================================================
  -- 2. team_invitations — privilégios, token / token_hash e isolamento
  -- =========================================================================
  IF has_table_privilege('anon', 'public.team_invitations', 'SELECT')
     OR has_table_privilege('anon', 'public.team_invitations', 'INSERT')
     OR has_table_privilege('anon', 'public.team_invitations', 'UPDATE')
     OR has_table_privilege('anon', 'public.team_invitations', 'DELETE') THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: anon mantém privilégio direto em team_invitations';
  ELSE RAISE NOTICE 'ok  team_invitations: anon sem privilégios diretos de leitura/escrita'; END IF;

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

  IF has_table_privilege('authenticated', 'public.team_invitations', 'INSERT')
     OR has_table_privilege('authenticated', 'public.team_invitations', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.team_invitations', 'DELETE') THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: authenticated mantém escrita direta em team_invitations';
  ELSE RAISE NOTICE 'ok  team_invitations: authenticated sem INSERT/UPDATE/DELETE direto'; END IF;

  IF has_function_privilege('anon', 'public.accept_team_invitation(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.lookup_team_invitation(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.list_pending_invitations_for_current_user()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.revoke_team_invitation(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.create_team_invitation(uuid,text,public.app_role,text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_provision_team_invitation(uuid,text,public.app_role,text,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_list_team_invitations(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.team_invitations_hash_token()', 'EXECUTE') THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: anon ainda consegue executar RPC/helper de convites';
  ELSE RAISE NOTICE 'ok  team_invitations: anon sem EXECUTE em RPCs/helpers'; END IF;

  IF has_function_privilege('authenticated', 'public.team_invitations_hash_token()', 'EXECUTE') THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: authenticated consegue chamar helper interno de hash';
  ELSE RAISE NOTICE 'ok  team_invitations: helper de hash restrito ao backend'; END IF;

  SELECT pg_get_function_result('public.lookup_team_invitation(text)'::regprocedure)
    INTO v_text;
  IF lower(v_text) LIKE '%token%' THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: lookup_team_invitation expõe token em seu contrato: %', v_text;
  ELSE RAISE NOTICE 'ok  team_invitations: lookup não expõe token/token_hash'; END IF;

  SELECT pg_get_function_result('public.list_pending_invitations_for_current_user()'::regprocedure)
    INTO v_text;
  IF lower(v_text) LIKE '%token%' THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: list_pending expõe token em seu contrato: %', v_text;
  ELSE RAISE NOTICE 'ok  team_invitations: list_pending não expõe token/token_hash'; END IF;

  SELECT pg_get_function_result('public.admin_list_team_invitations(uuid)'::regprocedure)
    INTO v_text;
  IF lower(v_text) LIKE '%token%' THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: admin_list expõe token em seu contrato: %', v_text;
  ELSE RAISE NOTICE 'ok  team_invitations: admin_list não expõe token/token_hash'; END IF;

  SELECT pg_get_function_result('public.revoke_team_invitation(uuid)'::regprocedure)
    INTO v_text;
  IF lower(v_text) <> 'uuid' THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: revoke_team_invitation retorna %, esperado uuid', v_text;
  ELSE RAISE NOTICE 'ok  team_invitations: revoke retorna somente UUID'; END IF;

  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    EXECUTE format('SELECT count(*) FROM public.team_invitations WHERE id = %L', inv) INTO v;
    flag := false;
  EXCEPTION WHEN insufficient_privilege THEN flag := true;
  END;
  RESET ROLE;
  IF NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: anon conseguiu consultar team_invitations em runtime';
  ELSE RAISE NOTICE 'ok  team_invitations: consulta anônima é negada em runtime'; END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_own::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_own, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE format('SELECT count(token) FROM public.team_invitations WHERE id = %L', inv) INTO v;
    flag := false;
  EXCEPTION WHEN insufficient_privilege THEN flag := true;
  END;
  EXECUTE format('SELECT count(*) FROM public.team_invitations WHERE id = %L', inv) INTO v;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  IF NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner autenticado conseguiu ler a coluna token';
  ELSE RAISE NOTICE 'ok  team_invitations: leitura do token é negada em runtime'; END IF;
  IF v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner do tenant não enxerga o convite';
  ELSE RAISE NOTICE 'ok  team_invitations: owner do tenant lê o convite'; END IF;

  -- Convidado autenticado ainda não pertence ao tenant. A policy de SELECT usa
  -- o e-mail assinado no JWT, enquanto as RPCs sensíveis confirmam o e-mail em
  -- auth.users.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_inv::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object(
      'sub', u_inv,
      'role', 'authenticated',
      'email', 'convidado+rlstest@example.test'
    )::text, true);
  EXECUTE format('SELECT count(*) FROM public.team_invitations WHERE id = %L', inv) INTO v;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: convidado autenticado não conseguiu ler o próprio convite via JWT';
  ELSE RAISE NOTICE 'ok  team_invitations: convidado lê o próprio convite via JWT sem auth.users'; END IF;

  -- A listagem segura usa o e-mail verificado em auth.users e retorna apenas o
  -- convite do destinatário atual.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_inv::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_inv, 'role', 'authenticated', 'email', 'convidado+rlstest@example.test')::text, true);
  EXECUTE 'SELECT count(*) FROM public.list_pending_invitations_for_current_user()' INTO v;
  EXECUTE format('SELECT count(*) FROM public.lookup_team_invitation(%L)', inv::text) INTO n_rows;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: list_pending retornou % convite(s), esperado 1', v;
  ELSE RAISE NOTICE 'ok  team_invitations: list_pending retorna apenas convite do e-mail autenticado'; END IF;
  IF n_rows <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: destinatário não conseguiu lookup por UUID';
  ELSE RAISE NOTICE 'ok  team_invitations: UUID funciona como handle do próprio destinatário'; END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_ownb::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_ownb, 'role', 'authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.team_invitations WHERE id = %L', inv) INTO v;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner de outro tenant enxergou o convite';
  ELSE RAISE NOTICE 'ok  team_invitations: convite não vaza para outro tenant'; END IF;

  -- UUID de convite não pode ser usado por uma conta com e-mail divergente.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_ownb::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_ownb, 'role', 'authenticated', 'email', 'owner-b+rlstest@example.test')::text, true);
  EXECUTE format('SELECT count(*) FROM public.lookup_team_invitation(%L)', inv::text) INTO v;
  BEGIN
    EXECUTE format('SELECT (public.accept_team_invitation(%L)).id', inv::text) INTO v_uuid;
    flag := false;
  EXCEPTION WHEN OTHERS THEN
    flag := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 0 OR NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: usuário de e-mail divergente fez lookup/accept por UUID';
  ELSE RAISE NOTICE 'ok  team_invitations: UUID não atravessa identidade/e-mail'; END IF;

  -- O destinatário correto consegue aceitar pelo UUID; em seguida a fixture é
  -- restaurada para não alterar os testes de memberships abaixo.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_inv::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_inv, 'role', 'authenticated', 'email', 'convidado+rlstest@example.test')::text, true);
  EXECUTE format('SELECT (public.accept_team_invitation(%L)).id', inv::text) INTO v_uuid;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT count(*) INTO v
    FROM public.tenant_memberships
   WHERE tenant_id = t_a AND user_id = u_inv AND status = 'active';
  IF v_uuid IS NULL OR v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: destinatário correto não aceitou convite por UUID';
  ELSE RAISE NOTICE 'ok  team_invitations: destinatário aceita convite por UUID'; END IF;
  DELETE FROM public.tenant_memberships WHERE tenant_id = t_a AND user_id = u_inv;
  UPDATE public.team_invitations
     SET status = 'pending', accepted_by = NULL, accepted_at = NULL, updated_at = now()
   WHERE id = inv;

  -- create_team_invitation entrega o token plaintext apenas na resposta e o
  -- remove imediatamente da linha persistida.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_own::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_own, 'role', 'authenticated')::text, true);
  EXECUTE format(
    'SELECT id, token FROM public.create_team_invitation(%L::uuid, %L, %L::public.app_role, NULL, 14)',
    t_a, 'owner-created+rlstest@example.test', 'frontdesk'
  ) INTO v_created_inv, v_token;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT (token IS NULL AND token_hash IS NOT NULL) INTO flag
    FROM public.team_invitations WHERE id = v_created_inv;
  IF v_created_inv IS NULL OR coalesce(v_token, '') = '' OR NOT coalesce(flag, false) THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: create_team_invitation não preservou semântica de token único';
  ELSE RAISE NOTICE 'ok  team_invitations: create retorna token uma vez e não o persiste'; END IF;

  -- Outro tenant não revoga o convite; o owner do tenant correto revoga e a
  -- RPC retorna somente o UUID.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_ownb::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_ownb, 'role', 'authenticated')::text, true);
  BEGIN
    EXECUTE format('SELECT public.revoke_team_invitation(%L::uuid)', v_created_inv) INTO v_uuid;
    flag := false;
  EXCEPTION WHEN OTHERS THEN flag := true;
  END;
  RESET ROLE;
  IF NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner de outro tenant revogou convite alheio';
  ELSE RAISE NOTICE 'ok  team_invitations: revoke respeita isolamento entre tenants'; END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_own::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_own, 'role', 'authenticated')::text, true);
  EXECUTE format('SELECT public.revoke_team_invitation(%L::uuid)', v_created_inv) INTO v_uuid;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v_uuid IS DISTINCT FROM v_created_inv THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: revoke não retornou o UUID esperado';
  ELSE RAISE NOTICE 'ok  team_invitations: owner revoga convite do próprio tenant'; END IF;

  -- Manager opera no próprio tenant e não pode criar convite em outro tenant.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_mng::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_mng, 'role', 'authenticated')::text, true);
  EXECUTE format(
    'SELECT id FROM public.create_team_invitation(%L::uuid, %L, %L::public.app_role, NULL, 14)',
    t_a, 'manager-created+rlstest@example.test', 'frontdesk'
  ) INTO v_manager_inv;
  BEGIN
    EXECUTE format(
      'SELECT id FROM public.create_team_invitation(%L::uuid, %L, %L::public.app_role, NULL, 14)',
      t_b, 'manager-cross-tenant+rlstest@example.test', 'frontdesk'
    ) INTO v_uuid;
    flag := false;
  EXCEPTION WHEN OTHERS THEN flag := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF v_manager_inv IS NULL OR NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: autorização de manager para convites está incorreta';
  ELSE RAISE NOTICE 'ok  team_invitations: manager opera apenas no próprio tenant'; END IF;

  -- Super admin mantém provisionamento/listagem e o token plaintext também é
  -- efêmero nesse fluxo administrativo.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_sup::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_sup, 'role', 'authenticated')::text, true);
  EXECUTE format(
    'SELECT id, token FROM public.admin_provision_team_invitation(%L::uuid, %L, %L::public.app_role, NULL, 14)',
    t_b, 'admin-created+rlstest@example.test', 'frontdesk'
  ) INTO v_admin_inv, v_token;
  EXECUTE format('SELECT count(*) FROM public.admin_list_team_invitations(%L::uuid) WHERE id = %L::uuid', t_b, v_admin_inv)
    INTO v;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT (token IS NULL AND token_hash IS NOT NULL) INTO flag
    FROM public.team_invitations WHERE id = v_admin_inv;
  IF v_admin_inv IS NULL OR coalesce(v_token, '') = '' OR v <> 1 OR NOT coalesce(flag, false) THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: fluxo administrativo de convites perdeu segurança/funcionalidade';
  ELSE RAISE NOTICE 'ok  team_invitations: super_admin provisiona/lista sem persistir plaintext token'; END IF;

  DELETE FROM public.team_invitations
   WHERE id IN (v_created_inv, v_manager_inv, v_admin_inv);

  -- =========================================================================
  -- 3. tenant_memberships — gap owner/manager e super_admin
  -- =========================================================================
  -- owner
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_own::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_own, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 3 THEN failures := failures + 1; RAISE WARNING 'FALHOU: owner viu % de 3 memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: owner vê toda a equipe'; END IF;

  -- manager
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_mng::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_mng, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 3 THEN failures := failures + 1; RAISE WARNING 'FALHOU: manager viu % de 3 memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: manager vê toda a equipe'; END IF;

  -- professional
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_pro::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_pro, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 1 THEN failures := failures + 1; RAISE WARNING 'FALHOU: professional viu % memberships (esperado 1)', v;
  ELSE RAISE NOTICE 'ok  memberships: professional vê apenas a própria linha'; END IF;

  -- outro tenant
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_ownb::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_ownb, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 0 THEN failures := failures + 1; RAISE WARNING 'FALHOU: owner de outro tenant viu % memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: equipe não vaza entre tenants'; END IF;

  -- super admin
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_sup::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_sup, 'role','authenticated')::text, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', NULL, true);
  IF v <> 3 THEN failures := failures + 1; RAISE WARNING 'FALHOU: super_admin viu % de 3 memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: super_admin vê a equipe de qualquer tenant'; END IF;

  -- anônimo
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  EXECUTE format('SELECT count(*) FROM public.tenant_memberships WHERE tenant_id = %L', t_a) INTO v;
  RESET ROLE;
  IF v <> 0 THEN failures := failures + 1; RAISE WARNING 'FALHOU: anônimo viu % memberships', v;
  ELSE RAISE NOTICE 'ok  memberships: anônimo não vê memberships'; END IF;

  -- professional não se promove
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_pro::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_pro, 'role','authenticated')::text, true);
  BEGIN
    EXECUTE format('UPDATE public.tenant_memberships SET role = ''owner'' WHERE tenant_id = %L AND user_id = %L', t_a, u_pro);
    GET DIAGNOSTICS n_rows = ROW_COUNT;
    flag := (n_rows = 0);
  EXCEPTION WHEN insufficient_privilege THEN flag := true;
  END;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', NULL, true);
  IF NOT flag THEN failures := failures + 1; RAISE WARNING 'FALHOU: professional se promoveu a owner';
  ELSE RAISE NOTICE 'ok  memberships: professional não se promove'; END IF;

  -- manager atualiza membro do próprio tenant
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_mng::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_mng, 'role','authenticated')::text, true);
  EXECUTE format('UPDATE public.tenant_memberships SET status = ''suspended'' WHERE tenant_id = %L AND user_id = %L', t_a, u_pro);
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  flag := (n_rows > 0);
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', NULL, true);
  IF NOT flag THEN failures := failures + 1; RAISE WARNING 'FALHOU: manager não conseguiu atualizar membro do próprio tenant';
  ELSE RAISE NOTICE 'ok  memberships: manager atualiza membros do próprio tenant'; END IF;

  -- =========================================================================
  -- 4. profiles — autoelevação a super admin
  -- Os triggers revertem o valor silenciosamente (o UPDATE afeta 1 linha),
  -- por isso a asserção compara o valor antes/depois, não o ROW_COUNT.
  -- =========================================================================
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_own::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_own, 'role','authenticated')::text, true);
  BEGIN
    EXECUTE format('UPDATE public.profiles SET is_super_admin = true WHERE id = %L', u_own);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RESET ROLE; PERFORM set_config('request.jwt.claim.sub', '', true); PERFORM set_config('request.jwt.claims', NULL, true);
  SELECT COALESCE(is_super_admin, false) INTO flag FROM public.profiles WHERE id = u_own;
  IF flag THEN failures := failures + 1; RAISE WARNING 'FALHOU: owner se promoveu a super admin';
  ELSE RAISE NOTICE 'ok  profiles: owner não se promove a super admin'; END IF;

  -- =========================================================================
  -- 5. policies de leitura com escopo de papel autenticado
  -- =========================================================================
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('plan_features', 'tenant_subscriptions')
      AND cmd IN ('SELECT', 'ALL')
      AND 'public'::name = ANY(roles)
  ) THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: policy de leitura de plan_features/tenant_subscriptions ainda está concedida a PUBLIC';
  ELSE
    RAISE NOTICE 'ok  read policies: plan_features/tenant_subscriptions não concedem policy a PUBLIC';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'plan_features'
      AND policyname = 'Qualquer autenticado lê features de planos'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
  ) OR NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_subscriptions'
      AND policyname = 'Qualquer membro lê assinatura do tenant'
      AND cmd = 'SELECT'
      AND roles = ARRAY['authenticated']::name[]
  ) THEN
    failures := failures + 1;
    RAISE WARNING 'FALHOU: acesso de leitura autenticado foi removido durante o hardening';
  ELSE
    RAISE NOTICE 'ok  read policies: acesso authenticated preservado nas duas tabelas';
  END IF;

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
    DELETE FROM public.team_invitations
     WHERE id = inv
        OR email IN (
          'owner-created+rlstest@example.test',
          'manager-created+rlstest@example.test',
          'manager-cross-tenant+rlstest@example.test',
          'admin-created+rlstest@example.test'
        );
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'aviso: sem privilégio para limpar convites de teste';
  END;
  BEGIN
    DELETE FROM public.tenants WHERE id IN (t_a, t_b);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'aviso: sem privilégio para limpar tenants de teste';
  END;
  BEGIN
    DELETE FROM auth.users WHERE id IN (u_own, u_mng, u_pro, u_inv, u_ownb, u_sup);
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'aviso: sem privilégio para limpar auth.users de teste';
  END;

  IF failures > 0 THEN
    RAISE EXCEPTION 'Testes de regressão de RLS: % falha(s)', failures;
  END IF;
  RAISE NOTICE 'Todos os testes de regressão de RLS passaram.';

EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_super_admin_changes_trg;
    ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_self_super_admin;
    DELETE FROM public.system_incidents WHERE id = inc;
    DELETE FROM public.team_invitations
     WHERE id = inv
        OR email IN (
          'owner-created+rlstest@example.test',
          'manager-created+rlstest@example.test',
          'manager-cross-tenant+rlstest@example.test',
          'admin-created+rlstest@example.test'
        );
    DELETE FROM public.tenants WHERE id IN (t_a, t_b);
    DELETE FROM auth.users WHERE id IN (u_own, u_mng, u_pro, u_inv, u_ownb, u_sup);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END
$test$;
