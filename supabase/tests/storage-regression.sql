-- Storage policies, tenant usage privacy and server-side plan quota checks.
-- All fixtures and objects are transactional and are discarded by ROLLBACK.

BEGIN;

DO $test$
DECLARE
  tenant_a uuid := '00000000-0000-4100-8100-00000000f001';
  tenant_b uuid := '00000000-0000-4100-8100-00000000f002';
  owner_a uuid := '00000000-0000-4100-8100-000000000f01';
  manager_a uuid := '00000000-0000-4100-8100-000000000f02';
  frontdesk_a uuid := '00000000-0000-4100-8100-000000000f03';
  professional_a uuid := '00000000-0000-4100-8100-000000000f04';
  client_a uuid := '00000000-0000-4100-8100-000000000f05';
  owner_b uuid := '00000000-0000-4100-8100-000000000f06';
  actor record;
  object_path text;
  quota_path text := '00000000-0000-4100-8100-00000000f001/storage-regression/quota.bin';
  allowed boolean;
  denied boolean;
  visible_rows bigint;
  used_bytes bigint;
  plan_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'client-media'
      AND 'application/pdf' = ANY(allowed_mime_types)
      AND 'text/plain' = ANY(allowed_mime_types)
      AND 'image/webp' = ANY(allowed_mime_types)
      AND NOT ('text/html' = ANY(allowed_mime_types))
      AND NOT ('image/svg+xml' = ANY(allowed_mime_types))
  ) THEN
    RAISE EXCEPTION 'Bucket client-media não aplica allowlist MIME segura.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'tenant-logos'
      AND allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
      AND file_size_limit = 2097152
  ) THEN
    RAISE EXCEPTION 'Bucket tenant-logos não limita tipo e tamanho de arquivo.';
  END IF;

  SELECT id INTO STRICT plan_id FROM public.plans WHERE code = 'free';

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+storage-regression@example.test', '', now(), now(), now()),
    (manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager+storage-regression@example.test', '', now(), now(), now()),
    (frontdesk_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frontdesk+storage-regression@example.test', '', now(), now(), now()),
    (professional_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'professional+storage-regression@example.test', '', now(), now(), now()),
    (client_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client+storage-regression@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b+storage-regression@example.test', '', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES
    (owner_a, 'Storage Owner A', false),
    (manager_a, 'Storage Manager A', false),
    (frontdesk_a, 'Storage Frontdesk A', false),
    (professional_a, 'Storage Professional A', false),
    (client_a, 'Storage Client A', false),
    (owner_b, 'Storage Owner B', false)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_super_admin = false;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'Storage Regression A', 'storage-regression-a', 'salao', owner_a),
    (tenant_b, 'Storage Regression B', 'storage-regression-b', 'salao', owner_b);

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES
    (tenant_a, owner_a, 'owner', 'active'),
    (tenant_a, manager_a, 'manager', 'active'),
    (tenant_a, frontdesk_a, 'frontdesk', 'active'),
    (tenant_a, professional_a, 'professional', 'active'),
    (tenant_b, owner_b, 'owner', 'active');

  INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status, override_limits)
  VALUES
    (tenant_a, plan_id, 'active', '{"max_storage_mb":1}'::jsonb),
    (tenant_b, plan_id, 'active', '{"max_storage_mb":1}'::jsonb);

  -- Each staff role may upload to its own tenant. A portal client has no CRM
  -- Storage membership, and an owner from tenant B cannot write into A.
  FOR actor IN
    SELECT * FROM (VALUES
      (owner_a, 'owner', tenant_a, true),
      (manager_a, 'manager', tenant_a, true),
      (frontdesk_a, 'frontdesk', tenant_a, true),
      (professional_a, 'professional', tenant_a, true),
      (client_a, 'client', tenant_a, false),
      (owner_b, 'owner-b', tenant_b, true)
    ) AS roles(user_id, role_name, tenant_id, may_upload)
  LOOP
    object_path := actor.tenant_id::text || '/storage-regression/' || actor.role_name || '.txt';
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', actor.user_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', actor.user_id, 'role', 'authenticated'
    )::text, true);

    BEGIN
      INSERT INTO storage.objects (bucket_id, name, owner, owner_id, metadata)
      VALUES ('client-media', object_path, actor.user_id, actor.user_id::text,
        '{"size":0,"mimetype":"text/plain"}'::jsonb);
      allowed := true;
    EXCEPTION WHEN insufficient_privilege THEN
      allowed := false;
    END;

    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', NULL, true);

    IF allowed IS DISTINCT FROM actor.may_upload THEN
      RAISE EXCEPTION 'Storage INSERT inesperado para papel % (tenant %).', actor.role_name, actor.tenant_id;
    END IF;
    RAISE NOTICE 'ok  Storage INSERT: papel % no tenant %', actor.role_name, actor.tenant_id;
  END LOOP;

  -- The quota allows exactly 1 MiB, even after smaller staff objects exist.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', owner_a, 'role', 'authenticated'
  )::text, true);

  INSERT INTO storage.objects (bucket_id, name, owner, owner_id, metadata)
  VALUES ('client-media', quota_path, owner_a, owner_a::text,
    '{"size":1048576,"mimetype":"application/octet-stream"}'::jsonb);

  UPDATE storage.objects
     SET metadata = '{"size":1048576,"mimetype":"application/octet-stream"}'::jsonb
   WHERE bucket_id = 'client-media' AND name = quota_path;
  GET DIAGNOSTICS visible_rows = ROW_COUNT;
  IF visible_rows <> 1 THEN
    RAISE EXCEPTION 'A sobrescrita que permanece exatamente no limite deveria ser aceita.';
  END IF;

  denied := false;
  BEGIN
    UPDATE storage.objects
       SET metadata = '{"size":1048577,"mimetype":"application/octet-stream"}'::jsonb
     WHERE bucket_id = 'client-media' AND name = quota_path;
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Falha de segurança: UPDATE aumentou o objeto além da cota do plano.';
  END IF;

  denied := false;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id, metadata)
    VALUES ('client-media', tenant_a::text || '/storage-regression/over-limit.bin', owner_a,
      owner_a::text, '{"size":1,"mimetype":"application/octet-stream"}'::jsonb);
  EXCEPTION WHEN SQLSTATE 'P0001' THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Falha de segurança: INSERT excedeu a cota do plano.';
  END IF;

  EXECUTE 'SELECT public.tenant_storage_bytes_used($1)' INTO used_bytes USING tenant_a;
  IF used_bytes <> 1048576 THEN
    RAISE EXCEPTION 'RPC de uso retornou % bytes; esperado 1048576.', used_bytes;
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'ok  Storage quota: limite exato aceito; UPDATE e INSERT acima do limite bloqueados';

  -- Anonymous execution and authenticated cross-tenant reads of the usage RPC
  -- must be denied; a member can read only its own tenant's aggregate.
  IF has_function_privilege('anon', 'public.tenant_storage_bytes_used(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Falha de segurança: anon conserva EXECUTE na RPC de uso de Storage.';
  END IF;
  RAISE NOTICE 'ok  Storage RPC ACL: anon sem EXECUTE';

  -- Do not invoke an EXECUTE-revoked RPC as the reserved anon role in the
  -- local Supabase image. Some supautils builds crash PostgreSQL (SIGSEGV)
  -- instead of returning SQLSTATE 42501; the effective ACL assertion above
  -- verifies the same grant boundary without taking down the test database.
  RAISE NOTICE 'ok  Storage RPC ACL: anon sem EXECUTE (runtime denial deferred to QA HTTP checks)';

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', owner_b, 'role', 'authenticated'
  )::text, true);
  denied := false;
  BEGIN
    EXECUTE 'SELECT public.tenant_storage_bytes_used($1)' INTO used_bytes USING tenant_a;
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Falha de segurança: tenant B consultou uso de Storage do tenant A.';
  END IF;
  RAISE NOTICE 'ok  Storage RPC runtime: tenant B isolado';

  object_path := tenant_a::text || '/storage-regression/cross-tenant.txt';
  denied := false;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, owner_id, metadata)
    VALUES ('client-media', object_path, owner_b, owner_b::text,
      '{"size":0,"mimetype":"text/plain"}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Falha de segurança: tenant B criou objeto no caminho do tenant A.';
  END IF;
  RAISE NOTICE 'ok  Storage RLS: INSERT cross-tenant bloqueado';
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  RAISE NOTICE 'Todos os testes de Storage passaram: papéis, tenant isolation, RPC privada e cotas.';
END
$test$;

ROLLBACK;
