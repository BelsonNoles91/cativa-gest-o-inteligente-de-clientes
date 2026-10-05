-- Regression matrix for availability, blocking, resources and waitlist scopes.
-- Uses synthetic fixtures and rolls back the entire transaction.

BEGIN;

DO $test$
DECLARE
  tenant_a uuid := '00000000-0000-4500-8500-00000000a101';
  tenant_b uuid := '00000000-0000-4500-8500-00000000b101';
  owner_a uuid := '00000000-0000-4500-8500-000000000a11';
  manager_a uuid := '00000000-0000-4500-8500-000000000a12';
  frontdesk_a uuid := '00000000-0000-4500-8500-000000000a13';
  professional_a uuid := '00000000-0000-4500-8500-000000000a14';
  owner_b uuid := '00000000-0000-4500-8500-000000000b11';
  unit_a uuid := '00000000-0000-4500-8500-00000000a201';
  unit_b uuid := '00000000-0000-4500-8500-00000000b201';
  professional_record_a uuid := '00000000-0000-4500-8500-00000000a301';
  professional_record_b uuid := '00000000-0000-4500-8500-00000000b301';
  client_a uuid := '00000000-0000-4500-8500-00000000a401';
  client_b uuid := '00000000-0000-4500-8500-00000000b401';
  service_a uuid := '00000000-0000-4500-8500-00000000a501';
  service_b uuid := '00000000-0000-4500-8500-00000000b501';
  resource_a uuid := '00000000-0000-4500-8500-00000000a601';
  resource_b uuid := '00000000-0000-4500-8500-00000000b601';
  hours_a uuid := '00000000-0000-4500-8500-00000000a701';
  availability_a uuid := '00000000-0000-4500-8500-00000000a801';
  time_off_a uuid := '00000000-0000-4500-8500-00000000a901';
  recurring_a uuid := '00000000-0000-4500-8500-00000000aa01';
  appointment_a uuid := '00000000-0000-4500-8500-00000000ab01';
  appointment_b uuid := '00000000-0000-4500-8500-00000000bb01';
  waitlist_a uuid := '00000000-0000-4500-8500-00000000ac01';
  actor record;
  created_id uuid;
  affected_rows bigint;
  visible_rows bigint;
  denied boolean;
BEGIN
  IF has_function_privilege('anon', 'public.enforce_scheduling_reference_scope()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_scheduling_reference_scope()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A função de integridade de disponibilidade pode ser chamada diretamente.';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+scheduling-scope@example.test', '', now(), now(), now()),
    (manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager+scheduling-scope@example.test', '', now(), now(), now()),
    (frontdesk_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frontdesk+scheduling-scope@example.test', '', now(), now(), now()),
    (professional_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'professional+scheduling-scope@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b+scheduling-scope@example.test', '', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES
    (owner_a, 'Scheduling Scope Owner A', false),
    (manager_a, 'Scheduling Scope Manager A', false),
    (frontdesk_a, 'Scheduling Scope Frontdesk A', false),
    (professional_a, 'Scheduling Scope Professional A', false),
    (owner_b, 'Scheduling Scope Owner B', false)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_super_admin = false;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'Scheduling Scope A', 'scheduling-scope-a', 'salao', owner_a),
    (tenant_b, 'Scheduling Scope B', 'scheduling-scope-b', 'salao', owner_b);

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES
    (tenant_a, owner_a, 'owner', 'active'),
    (tenant_a, manager_a, 'manager', 'active'),
    (tenant_a, frontdesk_a, 'frontdesk', 'active'),
    (tenant_a, professional_a, 'professional', 'active'),
    (tenant_b, owner_b, 'owner', 'active');

  INSERT INTO public.units (id, tenant_id, name, is_default)
  VALUES
    (unit_a, tenant_a, 'Scheduling Scope Unit A', true),
    (unit_b, tenant_b, 'Scheduling Scope Unit B', true);

  INSERT INTO public.clients (id, tenant_id, full_name, email, origin)
  VALUES
    (client_a, tenant_a, 'Scheduling Scope Client A', 'client-a+scheduling-scope@example.test', 'qa-scheduling-scope'),
    (client_b, tenant_b, 'Scheduling Scope Client B', 'client-b+scheduling-scope@example.test', 'qa-scheduling-scope');

  INSERT INTO public.professionals (id, tenant_id, unit_id, display_name)
  VALUES
    (professional_record_a, tenant_a, unit_a, 'Scheduling Scope Professional A'),
    (professional_record_b, tenant_b, unit_b, 'Scheduling Scope Professional B');

  INSERT INTO public.services (id, tenant_id, name, duration_minutes)
  VALUES
    (service_a, tenant_a, 'Scheduling Scope Service A', 30),
    (service_b, tenant_b, 'Scheduling Scope Service B', 30);

  INSERT INTO public.resources (id, tenant_id, unit_id, name)
  VALUES
    (resource_a, tenant_a, unit_a, 'Scheduling Scope Resource A'),
    (resource_b, tenant_b, unit_b, 'Scheduling Scope Resource B');

  INSERT INTO public.unit_business_hours (
    id, tenant_id, unit_id, weekday, opens_at, closes_at, is_closed
  ) VALUES
    (hours_a, tenant_a, unit_a, 4, '00:00', '23:59', false),
    (gen_random_uuid(), tenant_b, unit_b, 4, '00:00', '23:59', false);

  INSERT INTO public.professional_availability (
    id, tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
  ) VALUES (availability_a, tenant_a, professional_record_a, unit_a, 4, '08:00', '18:00');

  INSERT INTO public.time_off_blocks (
    id, tenant_id, scope, professional_id, unit_id, starts_at, ends_at, created_by
  ) VALUES (time_off_a, tenant_a, 'professional', professional_record_a, unit_a,
    '2099-01-15 20:00:00+00', '2099-01-15 21:00:00+00', owner_a);

  INSERT INTO public.recurring_blocks (
    id, tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
  ) VALUES (recurring_a, tenant_a, professional_record_a, unit_a, 4, '12:00', '12:30');

  INSERT INTO public.appointments (
    id, tenant_id, unit_id, client_id, professional_id, resource_id,
    starts_at, ends_at, duration_minutes, status, source
  ) VALUES
    (appointment_a, tenant_a, unit_a, client_a, professional_record_a, resource_a,
     '2099-01-15 13:00:00+00', '2099-01-15 13:30:00+00', 30, 'confirmed', 'frontdesk'),
    (appointment_b, tenant_b, unit_b, client_b, professional_record_b, resource_b,
     '2099-01-15 15:00:00+00', '2099-01-15 15:30:00+00', 30, 'confirmed', 'frontdesk');

  INSERT INTO public.waitlist_entries (
    id, tenant_id, client_id, service_id, preferred_professional_id,
    preferred_unit_id, scheduled_appointment_id, status, created_by
  ) VALUES (waitlist_a, tenant_a, client_a, service_a, professional_record_a,
    unit_a, appointment_a, 'scheduled', owner_a);

  -- Role matrix: owner/manager configure schedules; all four staff roles
  -- manage time-off and the waitlist within their own active tenant.
  FOR actor IN
    SELECT * FROM (VALUES
      (owner_a, 'owner'::text, true),
      (manager_a, 'manager'::text, true),
      (frontdesk_a, 'frontdesk'::text, false),
      (professional_a, 'professional'::text, false)
    ) AS staff(user_id, role_name, can_configure)
  LOOP
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', actor.user_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', actor.user_id, 'role', 'authenticated'
    )::text, true);

    SELECT count(*) INTO visible_rows FROM public.resources WHERE id = resource_a;
    IF visible_rows <> 1 THEN
      RAISE EXCEPTION 'O papel % deveria ler recursos do próprio tenant.', actor.role_name;
    END IF;

    IF actor.can_configure THEN
      INSERT INTO public.resources (tenant_id, unit_id, name)
      VALUES (tenant_a, unit_a, 'Temporary resource ' || actor.role_name)
      RETURNING id INTO created_id;
      UPDATE public.resources SET name = 'Updated resource ' || actor.role_name WHERE id = created_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN RAISE EXCEPTION '% não atualizou recurso do tenant.', actor.role_name; END IF;
      DELETE FROM public.resources WHERE id = created_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN RAISE EXCEPTION '% não removeu recurso do tenant.', actor.role_name; END IF;

      INSERT INTO public.unit_business_hours (tenant_id, unit_id, weekday, opens_at, closes_at)
      VALUES (tenant_a, unit_a, 5, '08:00', '17:00') RETURNING id INTO created_id;
      UPDATE public.unit_business_hours SET opens_at = '09:00' WHERE id = created_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN RAISE EXCEPTION '% não atualizou horário da unidade.', actor.role_name; END IF;
      DELETE FROM public.unit_business_hours WHERE id = created_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN RAISE EXCEPTION '% não removeu horário da unidade.', actor.role_name; END IF;

      INSERT INTO public.professional_availability (
        tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
      ) VALUES (tenant_a, professional_record_a, unit_a, 5, '08:00', '17:00') RETURNING id INTO created_id;
      UPDATE public.professional_availability SET starts_at = '09:00' WHERE id = created_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN RAISE EXCEPTION '% não atualizou disponibilidade.', actor.role_name; END IF;
      DELETE FROM public.professional_availability WHERE id = created_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN RAISE EXCEPTION '% não removeu disponibilidade.', actor.role_name; END IF;

      INSERT INTO public.recurring_blocks (
        tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
      ) VALUES (tenant_a, professional_record_a, unit_a, 5, '12:00', '12:30') RETURNING id INTO created_id;
      UPDATE public.recurring_blocks SET starts_at = '12:15' WHERE id = created_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN RAISE EXCEPTION '% não atualizou bloqueio recorrente.', actor.role_name; END IF;
      DELETE FROM public.recurring_blocks WHERE id = created_id;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 1 THEN RAISE EXCEPTION '% não removeu bloqueio recorrente.', actor.role_name; END IF;
    ELSE
      denied := false;
      BEGIN
        INSERT INTO public.resources (tenant_id, unit_id, name)
        VALUES (tenant_a, unit_a, 'Forbidden resource ' || actor.role_name);
      EXCEPTION WHEN insufficient_privilege THEN denied := true;
      END;
      IF NOT denied THEN RAISE EXCEPTION '% criou recurso sem privilégio de gestão.', actor.role_name; END IF;
      UPDATE public.resources SET name = 'forbidden' WHERE id = resource_a;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 0 THEN RAISE EXCEPTION '% atualizou recurso sem privilégio.', actor.role_name; END IF;
      DELETE FROM public.resources WHERE id = resource_a;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 0 THEN RAISE EXCEPTION '% removeu recurso sem privilégio.', actor.role_name; END IF;

      denied := false;
      BEGIN
        INSERT INTO public.unit_business_hours (tenant_id, unit_id, weekday, opens_at, closes_at)
        VALUES (tenant_a, unit_a, 5, '08:00', '17:00');
      EXCEPTION WHEN insufficient_privilege THEN denied := true;
      END;
      IF NOT denied THEN RAISE EXCEPTION '% configurou horário sem privilégio.', actor.role_name; END IF;
      UPDATE public.unit_business_hours SET opens_at = '07:00' WHERE id = hours_a;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 0 THEN RAISE EXCEPTION '% atualizou horário sem privilégio.', actor.role_name; END IF;
      DELETE FROM public.unit_business_hours WHERE id = hours_a;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 0 THEN RAISE EXCEPTION '% removeu horário sem privilégio.', actor.role_name; END IF;

      denied := false;
      BEGIN
        INSERT INTO public.professional_availability (
          tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
        ) VALUES (tenant_a, professional_record_a, unit_a, 5, '08:00', '17:00');
      EXCEPTION WHEN insufficient_privilege THEN denied := true;
      END;
      IF NOT denied THEN RAISE EXCEPTION '% configurou disponibilidade sem privilégio.', actor.role_name; END IF;
      UPDATE public.professional_availability SET starts_at = '07:00' WHERE id = availability_a;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 0 THEN RAISE EXCEPTION '% atualizou disponibilidade sem privilégio.', actor.role_name; END IF;
      DELETE FROM public.professional_availability WHERE id = availability_a;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 0 THEN RAISE EXCEPTION '% removeu disponibilidade sem privilégio.', actor.role_name; END IF;

      denied := false;
      BEGIN
        INSERT INTO public.recurring_blocks (
          tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
        ) VALUES (tenant_a, professional_record_a, unit_a, 5, '12:00', '12:30');
      EXCEPTION WHEN insufficient_privilege THEN denied := true;
      END;
      IF NOT denied THEN RAISE EXCEPTION '% criou bloqueio recorrente sem privilégio.', actor.role_name; END IF;
      UPDATE public.recurring_blocks SET starts_at = '11:30' WHERE id = recurring_a;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 0 THEN RAISE EXCEPTION '% atualizou bloqueio recorrente sem privilégio.', actor.role_name; END IF;
      DELETE FROM public.recurring_blocks WHERE id = recurring_a;
      GET DIAGNOSTICS affected_rows = ROW_COUNT;
      IF affected_rows <> 0 THEN RAISE EXCEPTION '% removeu bloqueio recorrente sem privilégio.', actor.role_name; END IF;
    END IF;

    INSERT INTO public.time_off_blocks (
      tenant_id, scope, professional_id, unit_id, starts_at, ends_at, created_by
    ) VALUES (tenant_a, 'professional', professional_record_a, unit_a,
      '2099-01-16 20:00:00+00', '2099-01-16 21:00:00+00', owner_b)
    RETURNING id INTO created_id;
    IF (SELECT created_by FROM public.time_off_blocks WHERE id = created_id) IS DISTINCT FROM actor.user_id THEN
      RAISE EXCEPTION 'O papel % conseguiu falsificar created_by no bloqueio.', actor.role_name;
    END IF;
    UPDATE public.time_off_blocks SET reason = 'updated by ' || actor.role_name WHERE id = created_id;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN RAISE EXCEPTION '% não atualizou bloqueio do próprio tenant.', actor.role_name; END IF;
    DELETE FROM public.time_off_blocks WHERE id = created_id;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN RAISE EXCEPTION '% não removeu bloqueio do próprio tenant.', actor.role_name; END IF;

    INSERT INTO public.waitlist_entries (
      tenant_id, client_id, service_id, preferred_professional_id,
      preferred_unit_id, status, created_by
    ) VALUES (tenant_a, client_a, service_a, professional_record_a,
      unit_a, 'open', owner_b)
    RETURNING id INTO created_id;
    IF (SELECT created_by FROM public.waitlist_entries WHERE id = created_id) IS DISTINCT FROM actor.user_id THEN
      RAISE EXCEPTION 'O papel % conseguiu falsificar created_by na fila.', actor.role_name;
    END IF;
    UPDATE public.waitlist_entries SET notes = 'updated by ' || actor.role_name WHERE id = created_id;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN RAISE EXCEPTION '% não atualizou item da fila do próprio tenant.', actor.role_name; END IF;
    DELETE FROM public.waitlist_entries WHERE id = created_id;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN RAISE EXCEPTION '% não removeu item da fila do próprio tenant.', actor.role_name; END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', NULL, true);
  END LOOP;

  -- Cross-tenant references are rejected even though tenant_id itself is valid.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);

  denied := false;
  BEGIN
    INSERT INTO public.resources (tenant_id, unit_id, name) VALUES (tenant_a, unit_b, 'foreign unit');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Recurso aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.unit_business_hours (tenant_id, unit_id, weekday, opens_at, closes_at)
    VALUES (tenant_a, unit_b, 5, '08:00', '17:00');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Horário aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.professional_availability (
      tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
    ) VALUES (tenant_a, professional_record_b, unit_a, 5, '08:00', '17:00');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Disponibilidade aceitou profissional de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.professional_availability (
      tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
    ) VALUES (tenant_a, professional_record_a, unit_b, 5, '08:00', '17:00');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Disponibilidade aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.time_off_blocks (
      tenant_id, scope, professional_id, starts_at, ends_at
    ) VALUES (tenant_a, 'professional', professional_record_b,
      '2099-01-16 20:00:00+00', '2099-01-16 21:00:00+00');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Bloqueio aceitou profissional de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.time_off_blocks (
      tenant_id, scope, unit_id, starts_at, ends_at
    ) VALUES (tenant_a, 'unit', unit_b, '2099-01-16 20:00:00+00', '2099-01-16 21:00:00+00');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Bloqueio de unidade aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.recurring_blocks (
      tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
    ) VALUES (tenant_a, professional_record_b, unit_a, 5, '12:00', '12:30');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Bloqueio recorrente aceitou profissional de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.recurring_blocks (
      tenant_id, professional_id, unit_id, weekday, starts_at, ends_at
    ) VALUES (tenant_a, professional_record_a, unit_b, 5, '12:00', '12:30');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Bloqueio recorrente aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.waitlist_entries (tenant_id, client_id, status)
    VALUES (tenant_a, client_b, 'open');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Fila aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.waitlist_entries (tenant_id, client_id, service_id, status)
    VALUES (tenant_a, client_a, service_b, 'open');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Fila aceitou serviço de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.waitlist_entries (tenant_id, client_id, preferred_professional_id, status)
    VALUES (tenant_a, client_a, professional_record_b, 'open');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Fila aceitou profissional de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.waitlist_entries (tenant_id, client_id, preferred_unit_id, status)
    VALUES (tenant_a, client_a, unit_b, 'open');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Fila aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.waitlist_entries (
      tenant_id, client_id, scheduled_appointment_id, status
    ) VALUES (tenant_a, client_a, appointment_b, 'scheduled');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Fila aceitou agendamento de outro tenant/cliente.'; END IF;

  -- Cross-tenant tenant_id payload is still blocked by RLS for a nonmember,
  -- even when all referenced records are valid in the target tenant.
  RESET ROLE;
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', frontdesk_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', frontdesk_a, 'role', 'authenticated')::text, true);
  denied := false;
  BEGIN
    INSERT INTO public.waitlist_entries (tenant_id, client_id, service_id, status)
    VALUES (tenant_b, client_b, service_b, 'open');
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Frontdesk A gravou fila diretamente no tenant B.'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- A dual-tenant manager passes RLS on both sides, but cannot move schedule
  -- configuration or waitlist data from tenant A to tenant B.
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (tenant_b, owner_a, 'manager', 'active');
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);

  denied := false;
  BEGIN
    UPDATE public.resources SET tenant_id = tenant_b WHERE id = resource_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Membro dos dois tenants transferiu recurso apenas alterando tenant_id.'; END IF;

  denied := false;
  BEGIN
    UPDATE public.waitlist_entries SET tenant_id = tenant_b WHERE id = waitlist_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Membro dos dois tenants transferiu fila apenas alterando tenant_id.'; END IF;

  denied := false;
  BEGIN
    UPDATE public.waitlist_entries SET scheduled_appointment_id = appointment_b WHERE id = waitlist_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Fila foi atualizada para agendamento de outro tenant/cliente.'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- Even service_role bypassing RLS remains subject to the reference guard.
  EXECUTE 'SET LOCAL ROLE service_role';
  denied := false;
  BEGIN
    INSERT INTO public.waitlist_entries (tenant_id, client_id, status)
    VALUES (tenant_a, client_b, 'open');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'service_role gravou fila com cliente de outro tenant.'; END IF;
  RESET ROLE;

  RAISE NOTICE 'Scheduling scope passou: CRUD por papel, configuração, bloqueios, fila, autoria e referências A/B.';
END
$test$;

ROLLBACK;
