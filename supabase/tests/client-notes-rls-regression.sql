-- Regression for author-specific client_notes policies and immutable scope.
-- All fixtures are synthetic and the entire test is rolled back.

BEGIN;

DO $test$
DECLARE
  tenant_a uuid := '00000000-0000-4300-8300-00000000a101';
  tenant_b uuid := '00000000-0000-4300-8300-00000000b101';
  owner_a uuid := '00000000-0000-4300-8300-000000000a11';
  professional_a uuid := '00000000-0000-4300-8300-000000000a12';
  manager_a uuid := '00000000-0000-4300-8300-000000000a13';
  frontdesk_a uuid := '00000000-0000-4300-8300-000000000a14';
  owner_b uuid := '00000000-0000-4300-8300-000000000b11';
  client_a uuid := '00000000-0000-4300-8300-00000000c101';
  client_b uuid := '00000000-0000-4300-8300-00000000c102';
  note_professional uuid := '00000000-0000-4300-8300-00000000d101';
  note_owner uuid := '00000000-0000-4300-8300-00000000d102';
  note_frontdesk uuid := '00000000-0000-4300-8300-00000000d103';
  actor record;
  affected_rows bigint;
  visible_rows bigint;
  denied boolean;
  actual_tenant uuid;
  actual_client uuid;
  actual_body text;
BEGIN
  IF has_function_privilege('anon', 'public.enforce_client_note_scope()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_client_note_scope()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Trigger helper de escopo de notas ficou chamável diretamente por anon/authenticated.';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+client-notes-rls@example.test', '', now(), now(), now()),
    (professional_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'professional+client-notes-rls@example.test', '', now(), now(), now()),
    (manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager+client-notes-rls@example.test', '', now(), now(), now()),
    (frontdesk_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frontdesk+client-notes-rls@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b+client-notes-rls@example.test', '', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES
    (owner_a, 'Client Notes RLS Owner A', false),
    (professional_a, 'Client Notes RLS Professional A', false),
    (manager_a, 'Client Notes RLS Manager A', false),
    (frontdesk_a, 'Client Notes RLS Frontdesk A', false),
    (owner_b, 'Client Notes RLS Owner B', false)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_super_admin = false;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'Client Notes RLS A', 'client-notes-rls-a', 'salao', owner_a),
    (tenant_b, 'Client Notes RLS B', 'client-notes-rls-b', 'salao', owner_b);

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES
    (tenant_a, owner_a, 'owner', 'active'),
    (tenant_a, professional_a, 'professional', 'active'),
    (tenant_a, manager_a, 'manager', 'active'),
    (tenant_a, frontdesk_a, 'frontdesk', 'active'),
    (tenant_b, owner_b, 'owner', 'active');

  INSERT INTO public.clients (id, tenant_id, full_name, email, origin)
  VALUES
    (client_a, tenant_a, 'Cliente A Client Notes RLS', 'client-a+notes@example.test', 'qa-client-notes-rls'),
    (client_b, tenant_b, 'Cliente B Client Notes RLS', 'client-b+notes@example.test', 'qa-client-notes-rls');

  INSERT INTO public.client_notes (id, tenant_id, client_id, author_id, body)
  VALUES
    (note_professional, tenant_a, client_a, professional_a, 'nota original do profissional'),
    (note_owner, tenant_a, client_a, owner_a, 'nota original do owner'),
    (note_frontdesk, tenant_a, client_a, frontdesk_a, 'nota original do frontdesk');

  -- Positive controls: author edits own note; owner/manager may edit another
  -- author's note in the same tenant.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', professional_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', professional_a, 'role', 'authenticated'
  )::text, true);
  UPDATE public.client_notes SET body = 'nota editada pelo autor' WHERE id = note_professional;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'O autor profissional deveria poder editar sua própria nota no tenant ativo.';
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', owner_a, 'role', 'authenticated'
  )::text, true);
  UPDATE public.client_notes SET body = 'nota revisada pelo owner' WHERE id = note_professional;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Owner deveria poder editar notas do próprio tenant.';
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', manager_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', manager_a, 'role', 'authenticated'
  )::text, true);
  UPDATE public.client_notes SET body = 'nota revisada pelo manager' WHERE id = note_professional;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Manager deveria poder editar notas de outros autores no próprio tenant.';
  END IF;

  -- All four staff roles may create notes, but an owner from another tenant
  -- cannot insert a row by supplying tenant A in the payload.
  FOR actor IN SELECT * FROM (VALUES (owner_a), (manager_a), (frontdesk_a), (professional_a)) AS staff(user_id)
  LOOP
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', actor.user_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', actor.user_id, 'role', 'authenticated'
    )::text, true);
    INSERT INTO public.client_notes (tenant_id, client_id, author_id, body)
    VALUES (tenant_a, client_a, actor.user_id, 'nota inserida pela matriz');
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', NULL, true);
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION 'Papel % deveria poder inserir nota no tenant ativo.', actor.user_id;
    END IF;
  END LOOP;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', owner_b, 'role', 'authenticated'
  )::text, true);
  denied := false;
  BEGIN
    INSERT INTO public.client_notes (tenant_id, client_id, author_id, body)
    VALUES (tenant_a, client_a, owner_b, 'tentativa de insert cross-tenant');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    denied := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF NOT denied THEN
    RAISE EXCEPTION 'Owner B inseriu nota no tenant A.';
  END IF;

  -- Frontdesk may edit/delete its own note, but cannot modify another author's
  -- note. A manager retains edit/delete capability inside the tenant.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', frontdesk_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', frontdesk_a, 'role', 'authenticated'
  )::text, true);
  UPDATE public.client_notes SET body = 'tentativa de edição alheia' WHERE id = note_professional;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'Frontdesk alterou nota de outro autor sem ser gestor.';
  END IF;
  UPDATE public.client_notes SET body = 'nota do frontdesk editada' WHERE id = note_frontdesk;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Frontdesk não conseguiu editar a própria nota.';
  END IF;
  DELETE FROM public.client_notes WHERE id = note_owner;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'Frontdesk removeu nota de outro autor.';
  END IF;
  DELETE FROM public.client_notes WHERE id = note_frontdesk;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Frontdesk não conseguiu remover a própria nota.';
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', manager_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', manager_a, 'role', 'authenticated'
  )::text, true);
  DELETE FROM public.client_notes WHERE id = note_owner;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF affected_rows <> 1 THEN
    RAISE EXCEPTION 'Manager não conseguiu remover nota de outro autor no próprio tenant.';
  END IF;

  -- A user from tenant B must neither read nor edit a known UUID from A.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', owner_b, 'role', 'authenticated'
  )::text, true);
  SELECT count(*) INTO visible_rows FROM public.client_notes WHERE id = note_professional;
  UPDATE public.client_notes SET body = 'tentativa cross-tenant' WHERE id = note_professional;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF visible_rows <> 0 OR affected_rows <> 0 THEN
    RAISE EXCEPTION 'Owner B leu ou alterou nota do tenant A por UUID.';
  END IF;

  -- Author cannot point a note at a client in another tenant, with or without
  -- changing tenant_id in the same request.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', professional_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', professional_a, 'role', 'authenticated'
  )::text, true);
  denied := false;
  BEGIN
    UPDATE public.client_notes SET client_id = client_b WHERE id = note_professional;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    denied := (affected_rows = 0);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Falha de segurança: autor vinculou nota do tenant A a cliente do tenant B.';
  END IF;

  denied := false;
  BEGIN
    UPDATE public.client_notes
       SET tenant_id = tenant_b, client_id = client_b
     WHERE id = note_professional;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    denied := (affected_rows = 0);
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    denied := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF NOT denied THEN
    RAISE EXCEPTION 'Falha de segurança: autor moveu nota e cliente entre tenants.';
  END IF;

  SELECT tenant_id, client_id, body
    INTO actual_tenant, actual_client, actual_body
    FROM public.client_notes WHERE id = note_professional;
  IF actual_tenant <> tenant_a OR actual_client <> client_a OR actual_body <> 'nota revisada pelo manager' THEN
    RAISE EXCEPTION 'Nota foi alterada por tentativa de reatribuição cross-tenant.';
  END IF;

  -- An actor whose membership was revoked must not retain write access merely
  -- because author_id still matches auth.uid().
  DELETE FROM public.tenant_memberships
   WHERE tenant_id = tenant_a AND user_id = professional_a;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', professional_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', professional_a, 'role', 'authenticated'
  )::text, true);
  UPDATE public.client_notes SET body = 'tentativa após revogação' WHERE id = note_professional;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  DELETE FROM public.client_notes WHERE id = note_professional;
  GET DIAGNOSTICS visible_rows = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF affected_rows <> 0 OR visible_rows <> 0 THEN
    RAISE EXCEPTION 'Autor sem membership ativo ainda alterou ou removeu nota.';
  END IF;

  RAISE NOTICE 'Client notes RLS passou: owner/manager/frontdesk/professional, autoria, isolamento A/B, scope imutável e membership revogado.';
END
$test$;

ROLLBACK;
