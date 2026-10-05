-- Runtime RLS matrix for CRM media metadata.
-- Exercises SELECT/INSERT/UPDATE/DELETE and tenant reassignment for staff,
-- a non-member portal-like user and another tenant's owner. Entirely rolled back.

BEGIN;

DO $test$
DECLARE
  tenant_a uuid := '00000000-0000-4200-8200-00000000a101';
  tenant_b uuid := '00000000-0000-4200-8200-00000000b101';
  owner_a uuid := '00000000-0000-4200-8200-000000000a11';
  manager_a uuid := '00000000-0000-4200-8200-000000000a12';
  frontdesk_a uuid := '00000000-0000-4200-8200-000000000a13';
  professional_a uuid := '00000000-0000-4200-8200-000000000a14';
  nonmember_client uuid := '00000000-0000-4200-8200-000000000a15';
  owner_b uuid := '00000000-0000-4200-8200-000000000b11';
  crm_client_a uuid := '00000000-0000-4200-8200-00000000c101';
  actor record;
  resource record;
  allowed boolean;
  denied boolean;
  visible_rows bigint;
  affected_rows bigint;
  actual_tenant uuid;
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+crm-media-rls@example.test', '', now(), now(), now()),
    (manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager+crm-media-rls@example.test', '', now(), now(), now()),
    (frontdesk_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frontdesk+crm-media-rls@example.test', '', now(), now(), now()),
    (professional_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'professional+crm-media-rls@example.test', '', now(), now(), now()),
    (nonmember_client, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client+crm-media-rls@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b+crm-media-rls@example.test', '', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES
    (owner_a, 'CRM Media RLS Owner', false),
    (manager_a, 'CRM Media RLS Manager', false),
    (frontdesk_a, 'CRM Media RLS Frontdesk', false),
    (professional_a, 'CRM Media RLS Professional', false),
    (nonmember_client, 'CRM Media RLS Nonmember', false),
    (owner_b, 'CRM Media RLS Owner B', false)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_super_admin = false;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'CRM Media RLS A', 'crm-media-rls-a', 'salao', owner_a),
    (tenant_b, 'CRM Media RLS B', 'crm-media-rls-b', 'salao', owner_b);

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES
    (tenant_a, owner_a, 'owner', 'active'),
    (tenant_a, manager_a, 'manager', 'active'),
    (tenant_a, frontdesk_a, 'frontdesk', 'active'),
    (tenant_a, professional_a, 'professional', 'active'),
    (tenant_b, owner_b, 'owner', 'active');

  INSERT INTO public.clients (id, tenant_id, full_name, email, origin)
  VALUES (crm_client_a, tenant_a, 'Cliente CRM Media RLS', 'client+crm-media-data@example.test', 'qa-crm-media-rls');

  -- Seed one target row per actor/table so DELETE and UPDATE assertions are
  -- independent and repeatable. Owner B's seed deliberately belongs to A.
  FOR actor IN
    SELECT * FROM (VALUES
      (owner_a, 'owner', true, '00000000-0000-4200-8200-00000000d101'::uuid, '00000000-0000-4200-8200-00000000d201'::uuid),
      (manager_a, 'manager', true, '00000000-0000-4200-8200-00000000d102'::uuid, '00000000-0000-4200-8200-00000000d202'::uuid),
      (frontdesk_a, 'frontdesk', true, '00000000-0000-4200-8200-00000000d103'::uuid, '00000000-0000-4200-8200-00000000d203'::uuid),
      (professional_a, 'professional', true, '00000000-0000-4200-8200-00000000d104'::uuid, '00000000-0000-4200-8200-00000000d204'::uuid),
      (nonmember_client, 'nonmember-client', false, '00000000-0000-4200-8200-00000000d105'::uuid, '00000000-0000-4200-8200-00000000d205'::uuid),
      (owner_b, 'owner-b', false, '00000000-0000-4200-8200-00000000d106'::uuid, '00000000-0000-4200-8200-00000000d206'::uuid)
    ) AS roles(user_id, role_name, may_manage, file_id, photo_id)
  LOOP
    INSERT INTO public.client_files (
      id, tenant_id, client_id, uploaded_by, storage_path, file_name, description
    ) VALUES (
      actor.file_id, tenant_a, crm_client_a, actor.user_id,
      tenant_a::text || '/' || crm_client_a::text || '/' || actor.role_name || '.txt',
      actor.role_name || '.txt', 'fixture'
    );

    INSERT INTO public.client_photos (
      id, tenant_id, client_id, uploaded_by, storage_path, caption
    ) VALUES (
      actor.photo_id, tenant_a, crm_client_a, actor.user_id,
      tenant_a::text || '/' || crm_client_a::text || '/' || actor.role_name || '.png',
      'fixture'
    );
  END LOOP;

  FOR resource IN
    SELECT * FROM (VALUES
      ('client_files'::text, 'file_id'::text, 'file_name'::text, 'description'::text),
      ('client_photos'::text, 'photo_id'::text, 'photo_name'::text, 'caption'::text)
    ) AS resources(table_name, id_column, inserted_name, text_column)
  LOOP
    FOR actor IN
      SELECT * FROM (VALUES
        (owner_a, 'owner', true, '00000000-0000-4200-8200-00000000d101'::uuid, '00000000-0000-4200-8200-00000000d201'::uuid),
        (manager_a, 'manager', true, '00000000-0000-4200-8200-00000000d102'::uuid, '00000000-0000-4200-8200-00000000d202'::uuid),
        (frontdesk_a, 'frontdesk', true, '00000000-0000-4200-8200-00000000d103'::uuid, '00000000-0000-4200-8200-00000000d203'::uuid),
        (professional_a, 'professional', true, '00000000-0000-4200-8200-00000000d104'::uuid, '00000000-0000-4200-8200-00000000d204'::uuid),
        (nonmember_client, 'nonmember-client', false, '00000000-0000-4200-8200-00000000d105'::uuid, '00000000-0000-4200-8200-00000000d205'::uuid),
        (owner_b, 'owner-b', false, '00000000-0000-4200-8200-00000000d106'::uuid, '00000000-0000-4200-8200-00000000d206'::uuid)
      ) AS roles(user_id, role_name, may_manage, file_id, photo_id)
    LOOP
      EXECUTE 'SET LOCAL ROLE authenticated';
      PERFORM set_config('request.jwt.claim.sub', actor.user_id::text, true);
      PERFORM set_config('request.jwt.claims', json_build_object(
        'sub', actor.user_id, 'role', 'authenticated'
      )::text, true);

      EXECUTE format(
        'SELECT count(*) FROM public.%I WHERE id = %L',
        resource.table_name,
        CASE WHEN resource.id_column = 'file_id' THEN actor.file_id ELSE actor.photo_id END
      ) INTO visible_rows;
      IF visible_rows <> (CASE WHEN actor.may_manage THEN 1 ELSE 0 END) THEN
        RAISE EXCEPTION 'SELECT inesperado em % para papel %: viu % linha(s).', resource.table_name, actor.role_name, visible_rows;
      END IF;

      allowed := false;
      BEGIN
        IF resource.table_name = 'client_files' THEN
          EXECUTE format(
            'INSERT INTO public.client_files (tenant_id, client_id, uploaded_by, storage_path, file_name, description) VALUES (%L, %L, %L, %L, %L, %L)',
            tenant_a, crm_client_a, actor.user_id,
            tenant_a::text || '/' || crm_client_a::text || '/matrix-' || actor.role_name || '.txt',
            'matrix-' || actor.role_name || '.txt', 'insert test'
          );
        ELSE
          EXECUTE format(
            'INSERT INTO public.client_photos (tenant_id, client_id, uploaded_by, storage_path, caption) VALUES (%L, %L, %L, %L, %L)',
            tenant_a, crm_client_a, actor.user_id,
            tenant_a::text || '/' || crm_client_a::text || '/matrix-' || actor.role_name || '.png',
            'insert test'
          );
        END IF;
        allowed := true;
      EXCEPTION WHEN insufficient_privilege THEN
        allowed := false;
      END;
      IF allowed IS DISTINCT FROM actor.may_manage THEN
        RAISE EXCEPTION 'INSERT inesperado em % para papel %.', resource.table_name, actor.role_name;
      END IF;

      EXECUTE format(
        'UPDATE public.%I SET %I = %L WHERE id = %L',
        resource.table_name,
        resource.text_column,
        'updated by ' || actor.role_name,
        CASE WHEN resource.id_column = 'file_id' THEN actor.file_id ELSE actor.photo_id END
      );
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> (CASE WHEN actor.may_manage THEN 1 ELSE 0 END) THEN
        RAISE EXCEPTION 'UPDATE inesperado em % para papel %: alterou % linha(s).', resource.table_name, actor.role_name, affected_rows;
      END IF;

      denied := false;
      BEGIN
        EXECUTE format(
          'UPDATE public.%I SET tenant_id = %L WHERE id = %L',
          resource.table_name,
          tenant_b,
          CASE WHEN resource.id_column = 'file_id' THEN actor.file_id ELSE actor.photo_id END
        );
        GET DIAGNOSTICS affected_rows = ROW_COUNT;
        denied := (affected_rows = 0);
      EXCEPTION WHEN insufficient_privilege OR check_violation THEN
        denied := true;
      END;
      IF NOT denied THEN
        RAISE EXCEPTION 'Papel % moveu registro de % para outro tenant.', actor.role_name, resource.table_name;
      END IF;

      EXECUTE format(
        'DELETE FROM public.%I WHERE id = %L',
        resource.table_name,
        CASE WHEN resource.id_column = 'file_id' THEN actor.file_id ELSE actor.photo_id END
      );
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> (CASE WHEN actor.may_manage THEN 1 ELSE 0 END) THEN
        RAISE EXCEPTION 'DELETE inesperado em % para papel %: removeu % linha(s).', resource.table_name, actor.role_name, affected_rows;
      END IF;

      RESET ROLE;
      PERFORM set_config('request.jwt.claim.sub', '', true);
      PERFORM set_config('request.jwt.claims', NULL, true);
      RAISE NOTICE 'ok  CRM media RLS: % x CRUD x %', resource.table_name, actor.role_name;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Matriz CRM media concluída: 2 tabelas x 6 perfis x SELECT/INSERT/UPDATE/DELETE + tenant reassignment.';
END
$test$;

ROLLBACK;
