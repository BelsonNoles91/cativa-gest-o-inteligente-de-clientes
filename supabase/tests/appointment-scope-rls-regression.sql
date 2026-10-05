-- Regression matrix for appointment, line-item, event and audit tenant scope.
-- Uses synthetic fixtures and rolls back the entire transaction.

BEGIN;

DO $test$
DECLARE
  tenant_a uuid := '00000000-0000-4400-8400-00000000a101';
  tenant_b uuid := '00000000-0000-4400-8400-00000000b101';
  owner_a uuid := '00000000-0000-4400-8400-000000000a11';
  manager_a uuid := '00000000-0000-4400-8400-000000000a12';
  frontdesk_a uuid := '00000000-0000-4400-8400-000000000a13';
  professional_a uuid := '00000000-0000-4400-8400-000000000a14';
  owner_b uuid := '00000000-0000-4400-8400-000000000b11';
  unit_a uuid := '00000000-0000-4400-8400-00000000a201';
  unit_b uuid := '00000000-0000-4400-8400-00000000b201';
  professional_record_a uuid := '00000000-0000-4400-8400-00000000a301';
  professional_record_b uuid := '00000000-0000-4400-8400-00000000b301';
  client_a uuid := '00000000-0000-4400-8400-00000000a401';
  client_a_other uuid := '00000000-0000-4400-8400-00000000a402';
  client_b uuid := '00000000-0000-4400-8400-00000000b401';
  service_a uuid := '00000000-0000-4400-8400-00000000a501';
  service_a_other uuid := '00000000-0000-4400-8400-00000000a502';
  service_b uuid := '00000000-0000-4400-8400-00000000b501';
  resource_a uuid := '00000000-0000-4400-8400-00000000a601';
  resource_b uuid := '00000000-0000-4400-8400-00000000b601';
  policy_a uuid := '00000000-0000-4400-8400-00000000a701';
  policy_b uuid := '00000000-0000-4400-8400-00000000b701';
  package_a uuid := '00000000-0000-4400-8400-00000000a711';
  package_b uuid := '00000000-0000-4400-8400-00000000b711';
  package_balance_a uuid := '00000000-0000-4400-8400-00000000a712';
  package_balance_b uuid := '00000000-0000-4400-8400-00000000b712';
  package_balance_other_client uuid := '00000000-0000-4400-8400-00000000a713';
  package_balance_other_service uuid := '00000000-0000-4400-8400-00000000a714';
  membership_a uuid := '00000000-0000-4400-8400-00000000a721';
  membership_b uuid := '00000000-0000-4400-8400-00000000b721';
  subscription_a uuid := '00000000-0000-4400-8400-00000000a722';
  subscription_b uuid := '00000000-0000-4400-8400-00000000b722';
  membership_balance_a uuid := '00000000-0000-4400-8400-00000000a723';
  membership_balance_b uuid := '00000000-0000-4400-8400-00000000b723';
  membership_balance_other_service uuid := '00000000-0000-4400-8400-00000000a724';
  appointment_a uuid := '00000000-0000-4400-8400-00000000a801';
  appointment_b uuid := '00000000-0000-4400-8400-00000000b801';
  item_to_lock uuid;
  inserted_item uuid;
  actor record;
  affected_rows bigint;
  visible_rows bigint;
  denied boolean;
  actual_actor uuid;
BEGIN
  IF has_function_privilege('anon', 'public.check_appointment_tenant_integrity()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.check_appointment_tenant_integrity()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.enforce_appointment_item_scope()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_appointment_item_scope()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.enforce_appointment_event_scope()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_appointment_event_scope()', 'EXECUTE') THEN
    RAISE EXCEPTION 'Uma função de integridade da agenda pode ser chamada diretamente por anon/authenticated.';
  END IF;
  IF has_function_privilege('anon', 'public.prevent_tenant_scope_reassignment()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.prevent_tenant_scope_reassignment()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A proteção de tenant dos registros-base pode ser chamada diretamente.';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+agenda-scope@example.test', '', now(), now(), now()),
    (manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager+agenda-scope@example.test', '', now(), now(), now()),
    (frontdesk_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frontdesk+agenda-scope@example.test', '', now(), now(), now()),
    (professional_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'professional+agenda-scope@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b+agenda-scope@example.test', '', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES
    (owner_a, 'Agenda Scope Owner A', false),
    (manager_a, 'Agenda Scope Manager A', false),
    (frontdesk_a, 'Agenda Scope Frontdesk A', false),
    (professional_a, 'Agenda Scope Professional A', false),
    (owner_b, 'Agenda Scope Owner B', false)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    is_super_admin = false;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'Agenda Scope A', 'agenda-scope-a', 'salao', owner_a),
    (tenant_b, 'Agenda Scope B', 'agenda-scope-b', 'salao', owner_b);

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES
    (tenant_a, owner_a, 'owner', 'active'),
    (tenant_a, manager_a, 'manager', 'active'),
    (tenant_a, frontdesk_a, 'frontdesk', 'active'),
    (tenant_a, professional_a, 'professional', 'active'),
    (tenant_b, owner_b, 'owner', 'active');

  INSERT INTO public.units (id, tenant_id, name, is_default)
  VALUES
    (unit_a, tenant_a, 'Agenda Scope Unit A', true),
    (unit_b, tenant_b, 'Agenda Scope Unit B', true);

  INSERT INTO public.unit_business_hours (
    tenant_id, unit_id, weekday, opens_at, closes_at, is_closed
  ) VALUES
    (tenant_a, unit_a, 4, '00:00', '23:59', false),
    (tenant_b, unit_b, 4, '00:00', '23:59', false);

  INSERT INTO public.professionals (id, tenant_id, unit_id, display_name)
  VALUES
    (professional_record_a, tenant_a, unit_a, 'Agenda Scope Professional A'),
    (professional_record_b, tenant_b, unit_b, 'Agenda Scope Professional B');

  INSERT INTO public.clients (id, tenant_id, full_name, email, origin)
  VALUES
    (client_a, tenant_a, 'Agenda Scope Client A', 'client-a+agenda-scope@example.test', 'qa-agenda-scope'),
    (client_a_other, tenant_a, 'Agenda Scope Client A Other', 'client-a-other+agenda-scope@example.test', 'qa-agenda-scope'),
    (client_b, tenant_b, 'Agenda Scope Client B', 'client-b+agenda-scope@example.test', 'qa-agenda-scope');

  INSERT INTO public.services (id, tenant_id, name, duration_minutes)
  VALUES
    (service_a, tenant_a, 'Agenda Scope Service A', 30),
    (service_a_other, tenant_a, 'Agenda Scope Service A Other', 30),
    (service_b, tenant_b, 'Agenda Scope Service B', 30);

  INSERT INTO public.resources (id, tenant_id, unit_id, name)
  VALUES
    (resource_a, tenant_a, unit_a, 'Agenda Scope Resource A'),
    (resource_b, tenant_b, unit_b, 'Agenda Scope Resource B');

  INSERT INTO public.cancellation_policies (id, tenant_id, name)
  VALUES
    (policy_a, tenant_a, 'Agenda Scope Policy A'),
    (policy_b, tenant_b, 'Agenda Scope Policy B');

  INSERT INTO public.packages (id, tenant_id, name)
  VALUES
    (package_a, tenant_a, 'Agenda Scope Package A'),
    (package_b, tenant_b, 'Agenda Scope Package B');

  INSERT INTO public.client_package_balances (
    id, tenant_id, client_id, package_id, service_id, sessions_total
  ) VALUES
    (package_balance_a, tenant_a, client_a, package_a, service_a, 5),
    (package_balance_b, tenant_b, client_b, package_b, service_b, 5),
    (package_balance_other_client, tenant_a, client_a_other, package_a, service_a, 5),
    (package_balance_other_service, tenant_a, client_a, package_a, service_a_other, 5);

  INSERT INTO public.memberships (id, tenant_id, name)
  VALUES
    (membership_a, tenant_a, 'Agenda Scope Membership A'),
    (membership_b, tenant_b, 'Agenda Scope Membership B');

  INSERT INTO public.client_membership_subscriptions (
    id, tenant_id, client_id, membership_id
  ) VALUES
    (subscription_a, tenant_a, client_a, membership_a),
    (subscription_b, tenant_b, client_b, membership_b);

  INSERT INTO public.client_membership_balances (
    id, tenant_id, subscription_id, service_id, sessions_total
  ) VALUES
    (membership_balance_a, tenant_a, subscription_a, service_a, 5),
    (membership_balance_b, tenant_b, subscription_b, service_b, 5),
    (membership_balance_other_service, tenant_a, subscription_a, service_a_other, 5);

  INSERT INTO public.appointments (
    id, tenant_id, unit_id, client_id, professional_id, resource_id,
    cancellation_policy_id, starts_at, ends_at, duration_minutes,
    status, source, notes
  ) VALUES
    (appointment_a, tenant_a, unit_a, client_a, professional_record_a, resource_a,
     policy_a, '2099-01-15 13:00:00+00', '2099-01-15 13:30:00+00', 30,
     'confirmed', 'frontdesk', 'appointment A'),
    (appointment_b, tenant_b, unit_b, client_b, professional_record_b, resource_b,
     policy_b, '2099-01-15 15:00:00+00', '2099-01-15 15:30:00+00', 30,
     'confirmed', 'frontdesk', 'appointment B');

  -- The trigger-created history must always follow the appointment's tenant.
  SELECT count(*) INTO visible_rows
  FROM public.appointment_status_history
  WHERE appointment_id = appointment_a AND tenant_id = tenant_a;
  IF visible_rows <> 1 THEN
    RAISE EXCEPTION 'A criação do agendamento não registrou histórico no tenant correto.';
  END IF;

  -- Owner, manager, frontdesk and professional retain intended same-tenant work.
  FOR actor IN
    SELECT * FROM (VALUES
      (owner_a, 'owner'::text),
      (manager_a, 'manager'::text),
      (frontdesk_a, 'frontdesk'::text),
      (professional_a, 'professional'::text)
    ) AS staff(user_id, role_name)
  LOOP
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', actor.user_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object(
      'sub', actor.user_id, 'role', 'authenticated'
    )::text, true);

    SELECT count(*) INTO visible_rows FROM public.appointments WHERE id = appointment_a;
    IF visible_rows <> 1 THEN
      RAISE EXCEPTION 'O papel % deveria ler o agendamento do próprio tenant.', actor.role_name;
    END IF;

    UPDATE public.appointments SET notes = 'same-tenant-' || actor.role_name WHERE id = appointment_a;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN
      RAISE EXCEPTION 'O papel % deveria atualizar o agendamento do próprio tenant.', actor.role_name;
    END IF;

    INSERT INTO public.appointment_items (
      tenant_id, appointment_id, service_id, duration_minutes, price_cents
    ) VALUES (tenant_a, appointment_a, service_a, 30, 12000)
    RETURNING id INTO inserted_item;
    IF item_to_lock IS NULL THEN item_to_lock := inserted_item; END IF;
    INSERT INTO public.appointment_items (
      tenant_id, appointment_id, service_id, duration_minutes, package_balance_id
    ) VALUES (tenant_a, appointment_a, service_a, 30, package_balance_a);
    INSERT INTO public.appointment_items (
      tenant_id, appointment_id, service_id, duration_minutes, membership_balance_id
    ) VALUES (tenant_a, appointment_a, service_a, 30, membership_balance_a);
    INSERT INTO public.appointment_logs (tenant_id, appointment_id, actor_id, action)
    VALUES (tenant_a, appointment_a, owner_a, 'qa.same-tenant.' || actor.role_name);
    SELECT actor_id INTO actual_actor
    FROM public.appointment_logs
    WHERE tenant_id = tenant_a AND appointment_id = appointment_a
      AND action = 'qa.same-tenant.' || actor.role_name;
    IF actual_actor IS DISTINCT FROM actor.user_id THEN
      RAISE EXCEPTION 'O log do papel % aceitou autoria falsificada.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_status_history (
        tenant_id, appointment_id, from_status, to_status, actor_id, reason
      ) VALUES (tenant_a, appointment_a, 'pending', 'completed', owner_a, 'forged history');
    EXCEPTION WHEN insufficient_privilege THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % conseguiu forjar histórico de status diretamente.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_items (
        tenant_id, appointment_id, service_id, duration_minutes
      ) VALUES (tenant_a, appointment_b, service_a, 30);
    EXCEPTION WHEN check_violation THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % vinculou item do tenant A ao agendamento do tenant B.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_items (
        tenant_id, appointment_id, service_id, duration_minutes
      ) VALUES (tenant_a, appointment_a, service_b, 30);
    EXCEPTION WHEN check_violation THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % anexou serviço de outro tenant ao agendamento.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_items (
        tenant_id, appointment_id, service_id, duration_minutes, package_balance_id
      ) VALUES (tenant_a, appointment_a, service_a, 30, package_balance_b);
    EXCEPTION WHEN check_violation THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % vinculou saldo de pacote de outro tenant.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_items (
        tenant_id, appointment_id, service_id, duration_minutes, package_balance_id
      ) VALUES (tenant_a, appointment_a, service_a, 30, package_balance_other_client);
    EXCEPTION WHEN check_violation THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % aplicou pacote pertencente a outro cliente do mesmo tenant.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_items (
        tenant_id, appointment_id, service_id, duration_minutes, package_balance_id
      ) VALUES (tenant_a, appointment_a, service_a, 30, package_balance_other_service);
    EXCEPTION WHEN check_violation THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % aplicou pacote restrito a outro serviço.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_items (
        tenant_id, appointment_id, service_id, duration_minutes, membership_balance_id
      ) VALUES (tenant_a, appointment_a, service_a, 30, membership_balance_b);
    EXCEPTION WHEN check_violation THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % vinculou saldo de assinatura de outro tenant.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_items (
        tenant_id, appointment_id, service_id, duration_minutes, membership_balance_id
      ) VALUES (tenant_a, appointment_a, service_a, 30, membership_balance_other_service);
    EXCEPTION WHEN check_violation THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % aplicou saldo de assinatura de outro serviço.', actor.role_name;
    END IF;

    denied := false;
    BEGIN
      INSERT INTO public.appointment_logs (tenant_id, appointment_id, action)
      VALUES (tenant_a, appointment_b, 'qa.cross-tenant');
    EXCEPTION WHEN check_violation THEN
      denied := true;
    END;
    IF NOT denied THEN
      RAISE EXCEPTION 'O papel % registrou log no tenant errado para outro agendamento.', actor.role_name;
    END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', NULL, true);
  END LOOP;

  -- Tenant B cannot discover or mutate tenant A's appointment by UUID.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', owner_b, 'role', 'authenticated'
  )::text, true);
  SELECT count(*) INTO visible_rows FROM public.appointments WHERE id = appointment_a;
  IF visible_rows <> 0 THEN
    RAISE EXCEPTION 'Owner B leu agendamento do tenant A por UUID.';
  END IF;
  UPDATE public.appointments SET notes = 'cross-tenant-hack' WHERE id = appointment_a;
  GET DIAGNOSTICS affected_rows = ROW_COUNT;
  IF affected_rows <> 0 THEN
    RAISE EXCEPTION 'Owner B alterou agendamento do tenant A por UUID.';
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- The appointment guard also checks unit, resource and cancellation-policy scope.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', owner_a, 'role', 'authenticated'
  )::text, true);

  denied := false;
  BEGIN
    INSERT INTO public.appointments (
      tenant_id, unit_id, client_id, professional_id, starts_at, ends_at,
      duration_minutes, status, source
    ) VALUES (tenant_a, unit_b, client_a, professional_record_a,
      '2099-01-15 16:00:00+00', '2099-01-15 16:30:00+00', 30, 'confirmed', 'frontdesk');
  EXCEPTION WHEN SQLSTATE 'P0007' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Agendamento aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.appointments (
      tenant_id, unit_id, client_id, professional_id, resource_id,
      starts_at, ends_at, duration_minutes, status, source
    ) VALUES (tenant_a, unit_a, client_a, professional_record_a, resource_b,
      '2099-01-15 16:00:00+00', '2099-01-15 16:30:00+00', 30, 'confirmed', 'frontdesk');
  EXCEPTION WHEN SQLSTATE 'P0008' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Agendamento aceitou recurso de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.appointments (
      tenant_id, unit_id, client_id, professional_id, cancellation_policy_id,
      starts_at, ends_at, duration_minutes, status, source
    ) VALUES (tenant_a, unit_a, client_a, professional_record_a, policy_b,
      '2099-01-15 16:00:00+00', '2099-01-15 16:30:00+00', 30, 'confirmed', 'frontdesk');
  EXCEPTION WHEN SQLSTATE 'P0009' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Agendamento aceitou política de cancelamento de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.appointments (
      tenant_id, unit_id, client_id, professional_id, starts_at, ends_at,
      duration_minutes, status, source
    ) VALUES (tenant_a, unit_a, client_b, professional_record_a,
      '2099-01-15 16:00:00+00', '2099-01-15 16:30:00+00', 30, 'confirmed', 'frontdesk');
  EXCEPTION WHEN SQLSTATE 'P0005' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Agendamento aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.appointments (
      tenant_id, unit_id, client_id, professional_id, starts_at, ends_at,
      duration_minutes, status, source
    ) VALUES (tenant_a, unit_a, client_a, professional_record_b,
      '2099-01-15 16:00:00+00', '2099-01-15 16:30:00+00', 30, 'confirmed', 'frontdesk');
  EXCEPTION WHEN SQLSTATE 'P0006' THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Agendamento aceitou profissional de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.appointment_items (
      tenant_id, appointment_id, service_id, duration_minutes
    ) VALUES (tenant_b, appointment_b, service_b, 30);
  EXCEPTION WHEN insufficient_privilege THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Owner A gravou item diretamente no tenant B.'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  -- A person legitimately belonging to both tenants passes the RLS policy on
  -- both OLD and NEW rows. The database integrity trigger must still prevent
  -- moving an existing appointment by changing only tenant_id.
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (tenant_b, owner_a, 'manager', 'active');
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', owner_a, 'role', 'authenticated'
  )::text, true);
  denied := false;
  BEGIN
    UPDATE public.appointments SET tenant_id = tenant_b WHERE id = appointment_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Usuário membro dos dois tenants transferiu um agendamento alterando apenas tenant_id.';
  END IF;
  denied := false;
  BEGIN
    UPDATE public.units SET tenant_id = tenant_b WHERE id = unit_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Membro dos dois tenants transferiu uma unidade existente.'; END IF;

  denied := false;
  BEGIN
    UPDATE public.clients SET tenant_id = tenant_b WHERE id = client_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Membro dos dois tenants transferiu um cliente existente.'; END IF;

  denied := false;
  BEGIN
    UPDATE public.professionals SET tenant_id = tenant_b WHERE id = professional_record_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Membro dos dois tenants transferiu um profissional existente.'; END IF;

  denied := false;
  BEGIN
    UPDATE public.services SET tenant_id = tenant_b WHERE id = service_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Membro dos dois tenants transferiu um serviço existente.'; END IF;

  denied := false;
  BEGIN
    UPDATE public.cancellation_policies SET tenant_id = tenant_b WHERE id = policy_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Membro dos dois tenants transferiu uma política existente.'; END IF;

  denied := false;
  BEGIN
    UPDATE public.appointment_items
    SET appointment_id = appointment_b
    WHERE id = item_to_lock;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN
    RAISE EXCEPTION 'Usuário membro dos dois tenants moveu um item para outro agendamento.';
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF (SELECT tenant_id FROM public.appointments WHERE id = appointment_a) <> tenant_a THEN
    RAISE EXCEPTION 'Tentativa de transferência alterou o tenant do agendamento.';
  END IF;

  -- Service role bypasses RLS, so integrity triggers must still reject a forged
  -- cross-tenant audit/history association from a privileged integration path.
  EXECUTE 'SET LOCAL ROLE service_role';
  denied := false;
  BEGIN
    INSERT INTO public.appointment_status_history (
      tenant_id, appointment_id, from_status, to_status, reason
    ) VALUES (tenant_a, appointment_b, 'pending', 'completed', 'cross-tenant service test');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'service_role associou histórico ao tenant incorreto.'; END IF;
  RESET ROLE;

  RAISE NOTICE 'Agenda RLS/scope: perfis staff, IDOR, linhas de serviço, logs, histórico e referências cruzadas aprovados.';
END
$test$;

ROLLBACK;
