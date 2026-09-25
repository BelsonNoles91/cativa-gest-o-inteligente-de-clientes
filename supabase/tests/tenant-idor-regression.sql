-- ============================================================================
-- Regressão de isolamento multi-tenant / IDOR
--
-- Valida acesso por IDs conhecidos em clients e appointments:
--   1. owner do tenant correto consegue ler e alterar seus registros;
--   2. owner de outro tenant não consegue ler nem alterar esses mesmos IDs;
--   3. owner de outro tenant não consegue inserir registros apontando para o
--      tenant alvo.
--
-- Uso:
--   psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 \
--     -f supabase/tests/tenant-idor-regression.sql
-- ============================================================================

DO $test$
DECLARE
  t_a    uuid := '00000000-0000-4100-8100-00000000a001';
  t_b    uuid := '00000000-0000-4100-8100-00000000b001';
  u_a    uuid := '00000000-0000-4100-8100-0000000000a1';
  u_b    uuid := '00000000-0000-4100-8100-0000000000b1';
  unit_a uuid := '00000000-0000-4100-8100-00000000a101';
  pro_a  uuid := '00000000-0000-4100-8100-00000000a201';
  cli_a  uuid := '00000000-0000-4100-8100-00000000a301';
  apt_a  uuid := '00000000-0000-4100-8100-00000000a401';
  v      bigint;
  n_rows int;
  flag   boolean;
  failures int := 0;
BEGIN
  -- Limpeza defensiva de eventual execução interrompida.
  DELETE FROM public.tenants WHERE id IN (t_a, t_b);
  DELETE FROM auth.users WHERE id IN (u_a, u_b);

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES
    (u_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-a+idor@example.test', '', now(), now(), now()),
    (u_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'owner-b+idor@example.test', '', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (u_a, 'Owner A IDOR', false), (u_b, 'Owner B IDOR', false)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_super_admin = false;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (t_a, 'Tenant A IDOR', 'tenant-a-idor-test', 'salao', u_a),
    (t_b, 'Tenant B IDOR', 'tenant-b-idor-test', 'salao', u_b);

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES
    (t_a, u_a, 'owner', 'active'),
    (t_b, u_b, 'owner', 'active');

  INSERT INTO public.units (id, tenant_id, name, is_default)
  VALUES (unit_a, t_a, 'Unidade A IDOR', true);

  INSERT INTO public.unit_business_hours (
    tenant_id, unit_id, weekday, opens_at, closes_at, is_closed
  ) VALUES (
    t_a, unit_a, 4, '00:00', '23:59', false
  );

  INSERT INTO public.professionals (id, tenant_id, unit_id, display_name)
  VALUES (pro_a, t_a, unit_a, 'Profissional A IDOR');

  INSERT INTO public.clients (id, tenant_id, full_name, email, origin)
  VALUES (cli_a, t_a, 'Cliente A IDOR', 'cliente-a+idor@example.test', 'qa-idor');

  INSERT INTO public.appointments (
    id, tenant_id, unit_id, client_id, professional_id,
    starts_at, ends_at, duration_minutes, status, source, notes
  ) VALUES (
    apt_a, t_a, unit_a, cli_a, pro_a,
    '2099-01-15 13:00:00+00', '2099-01-15 14:00:00+00', 60,
    'confirmed', 'frontdesk', 'IDOR original'
  );

  -- Controle positivo: owner A lê os próprios registros.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_a::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_a, 'role', 'authenticated', 'email', 'owner-a+idor@example.test')::text,
    true);
  EXECUTE format('SELECT count(*) FROM public.clients WHERE id = %L', cli_a) INTO v;
  IF v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner A não leu o próprio cliente';
  ELSE RAISE NOTICE 'ok  IDOR clients: owner do tenant lê o próprio cliente'; END IF;

  EXECUTE format('SELECT count(*) FROM public.appointments WHERE id = %L', apt_a) INTO v;
  IF v <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner A não leu o próprio agendamento';
  ELSE RAISE NOTICE 'ok  IDOR appointments: owner do tenant lê o próprio agendamento'; END IF;

  EXECUTE format('UPDATE public.clients SET notes = ''same-tenant-ok'' WHERE id = %L', cli_a);
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  IF n_rows <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner A não alterou o próprio cliente';
  ELSE RAISE NOTICE 'ok  IDOR clients: owner do tenant altera o próprio cliente'; END IF;

  EXECUTE format('UPDATE public.appointments SET notes = ''same-tenant-ok'' WHERE id = %L', apt_a);
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  IF n_rows <> 1 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner A não alterou o próprio agendamento';
  ELSE RAISE NOTICE 'ok  IDOR appointments: owner do tenant altera o próprio agendamento'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- Ataque IDOR: owner B conhece os UUIDs do tenant A.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', u_b::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u_b, 'role', 'authenticated', 'email', 'owner-b+idor@example.test')::text,
    true);

  EXECUTE format('SELECT count(*) FROM public.clients WHERE id = %L', cli_a) INTO v;
  IF v <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner B leu cliente do tenant A por UUID';
  ELSE RAISE NOTICE 'ok  IDOR clients: leitura cruzada por UUID bloqueada'; END IF;

  EXECUTE format('SELECT count(*) FROM public.appointments WHERE id = %L', apt_a) INTO v;
  IF v <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner B leu agendamento do tenant A por UUID';
  ELSE RAISE NOTICE 'ok  IDOR appointments: leitura cruzada por UUID bloqueada'; END IF;

  EXECUTE format('UPDATE public.clients SET notes = ''cross-tenant-hack'' WHERE id = %L', cli_a);
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  IF n_rows <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner B alterou cliente do tenant A por UUID';
  ELSE RAISE NOTICE 'ok  IDOR clients: alteração cruzada por UUID bloqueada'; END IF;

  EXECUTE format('UPDATE public.appointments SET notes = ''cross-tenant-hack'' WHERE id = %L', apt_a);
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  IF n_rows <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner B alterou agendamento do tenant A por UUID';
  ELSE RAISE NOTICE 'ok  IDOR appointments: alteração cruzada por UUID bloqueada'; END IF;

  BEGIN
    EXECUTE format(
      'INSERT INTO public.clients (tenant_id, full_name) VALUES (%L, ''IDOR cross insert'')',
      t_a
    );
    flag := false;
  EXCEPTION WHEN insufficient_privilege THEN flag := true;
  END;
  IF NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner B inseriu cliente no tenant A';
  ELSE RAISE NOTICE 'ok  IDOR clients: inserção cruzada bloqueada por RLS'; END IF;

  BEGIN
    EXECUTE format(
      'INSERT INTO public.appointments (tenant_id, unit_id, client_id, professional_id, starts_at, ends_at, duration_minutes, status, source) VALUES (%L, %L, %L, %L, ''2099-01-15 15:00:00+00'', ''2099-01-15 16:00:00+00'', 60, ''canceled'', ''frontdesk'')',
      t_a, unit_a, cli_a, pro_a
    );
    flag := false;
  EXCEPTION
    WHEN insufficient_privilege OR SQLSTATE 'P0005' OR SQLSTATE 'P0006' THEN
      flag := true;
  END;
  IF NOT flag THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: owner B inseriu agendamento no tenant A';
  ELSE RAISE NOTICE 'ok  IDOR appointments: inserção cruzada bloqueada por integridade/RLS'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  SELECT count(*) INTO v
  FROM public.appointments
  WHERE tenant_id = t_a
    AND starts_at = '2099-01-15 15:00:00+00'::timestamptz;
  IF v <> 0 THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: tentativa de inserção cruzada deixou % agendamento(s)', v;
  ELSE RAISE NOTICE 'ok  IDOR appointments: nenhuma linha foi criada pela tentativa cruzada'; END IF;

  -- Confirma que as tentativas cruzadas não modificaram os registros.
  SELECT (notes = 'same-tenant-ok') INTO flag FROM public.clients WHERE id = cli_a;
  IF NOT COALESCE(flag, false) THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: conteúdo do cliente foi alterado após tentativa IDOR';
  ELSE RAISE NOTICE 'ok  IDOR clients: conteúdo permaneceu íntegro'; END IF;

  SELECT (notes = 'same-tenant-ok') INTO flag FROM public.appointments WHERE id = apt_a;
  IF NOT COALESCE(flag, false) THEN failures := failures + 1;
    RAISE WARNING 'FALHOU: conteúdo do agendamento foi alterado após tentativa IDOR';
  ELSE RAISE NOTICE 'ok  IDOR appointments: conteúdo permaneceu íntegro'; END IF;

  DELETE FROM public.tenants WHERE id IN (t_a, t_b);
  DELETE FROM auth.users WHERE id IN (u_a, u_b);

  IF failures > 0 THEN
    RAISE EXCEPTION 'Testes de isolamento multi-tenant/IDOR: % falha(s)', failures;
  END IF;
  RAISE NOTICE 'Todos os testes de isolamento multi-tenant/IDOR passaram.';

EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  BEGIN
    DELETE FROM public.tenants WHERE id IN (t_a, t_b);
    DELETE FROM auth.users WHERE id IN (u_a, u_b);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  RAISE;
END
$test$;
