-- Confirmation and client-portal tenant integrity/RLS regression matrix.
-- Synthetic rows are isolated in a transaction and always rolled back.

BEGIN;

DO $test$
DECLARE
  tenant_a uuid := '00000000-0000-4800-8000-00000000c001';
  tenant_b uuid := '00000000-0000-4800-8000-00000000c002';
  owner_a uuid := '00000000-0000-4800-8000-000000000c01';
  manager_a uuid := '00000000-0000-4800-8000-000000000c02';
  frontdesk_a uuid := '00000000-0000-4800-8000-000000000c03';
  professional_a uuid := '00000000-0000-4800-8000-000000000c04';
  client_user_a uuid := '00000000-0000-4800-8000-000000000c05';
  owner_b uuid := '00000000-0000-4800-8000-000000000c06';
  client_user_b uuid := '00000000-0000-4800-8000-000000000c07';
  unit_a uuid := '00000000-0000-4800-8000-00000000c101';
  unit_b uuid := '00000000-0000-4800-8000-00000000c102';
  client_a uuid := '00000000-0000-4800-8000-00000000c201';
  client_b uuid := '00000000-0000-4800-8000-00000000c202';
  professional_record_a uuid := '00000000-0000-4800-8000-00000000c301';
  professional_record_b uuid := '00000000-0000-4800-8000-00000000c302';
  service_a uuid := '00000000-0000-4800-8000-00000000c401';
  service_b uuid := '00000000-0000-4800-8000-00000000c402';
  appointment_a uuid := '00000000-0000-4800-8000-00000000c501';
  appointment_b uuid := '00000000-0000-4800-8000-00000000c502';
  rule_a uuid := '00000000-0000-4800-8000-00000000c601';
  rule_b uuid := '00000000-0000-4800-8000-00000000c602';
  template_a uuid := '00000000-0000-4800-8000-00000000c701';
  template_b uuid := '00000000-0000-4800-8000-00000000c702';
  queue_a uuid := '00000000-0000-4800-8000-00000000c801';
  queue_b uuid := '00000000-0000-4800-8000-00000000c802';
  actor record;
  inserted_id uuid;
  actual_actor uuid;
  visible_rows bigint;
  denied boolean;
BEGIN
  IF has_function_privilege('anon', 'public.enforce_confirmation_portal_tenant_scope()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_confirmation_portal_tenant_scope()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.enforce_confirmation_portal_tenant_scope()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A função de integridade do portal pode ser chamada diretamente.';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+confirmation-scope@example.test', '', now(), now(), now()),
    (manager_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'manager+confirmation-scope@example.test', '', now(), now(), now()),
    (frontdesk_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frontdesk+confirmation-scope@example.test', '', now(), now(), now()),
    (professional_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'professional+confirmation-scope@example.test', '', now(), now(), now()),
    (client_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-a+confirmation-scope@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b+confirmation-scope@example.test', '', now(), now(), now()),
    (client_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'client-b+confirmation-scope@example.test', '', now(), now(), now());

  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES
    (owner_a, 'Confirmation Owner A', false),
    (manager_a, 'Confirmation Manager A', false),
    (frontdesk_a, 'Confirmation Frontdesk A', false),
    (professional_a, 'Confirmation Professional A', false),
    (client_user_a, 'Confirmation Client A', false),
    (owner_b, 'Confirmation Owner B', false),
    (client_user_b, 'Confirmation Client B', false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_super_admin = false;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'Confirmation Scope A', 'confirmation-scope-a', 'salao', owner_a),
    (tenant_b, 'Confirmation Scope B', 'confirmation-scope-b', 'salao', owner_b);
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES
    (tenant_a, owner_a, 'owner', 'active'),
    (tenant_a, manager_a, 'manager', 'active'),
    (tenant_a, frontdesk_a, 'frontdesk', 'active'),
    (tenant_a, professional_a, 'professional', 'active'),
    (tenant_b, owner_b, 'owner', 'active');

  INSERT INTO public.units (id, tenant_id, name, is_default)
  VALUES (unit_a, tenant_a, 'Confirmation Unit A', true), (unit_b, tenant_b, 'Confirmation Unit B', true);
  INSERT INTO public.clients (id, tenant_id, full_name, email, origin)
  VALUES
    (client_a, tenant_a, 'Confirmation Client A', 'client-a+confirmation-scope@example.test', 'qa-confirmation-scope'),
    (client_b, tenant_b, 'Confirmation Client B', 'client-b+confirmation-scope@example.test', 'qa-confirmation-scope');
  INSERT INTO public.professionals (id, tenant_id, unit_id, display_name)
  VALUES
    (professional_record_a, tenant_a, unit_a, 'Confirmation Professional A'),
    (professional_record_b, tenant_b, unit_b, 'Confirmation Professional B');
  INSERT INTO public.services (id, tenant_id, name, duration_minutes)
  VALUES (service_a, tenant_a, 'Confirmation Service A', 30), (service_b, tenant_b, 'Confirmation Service B', 30);
  INSERT INTO public.unit_business_hours (tenant_id, unit_id, weekday, opens_at, closes_at)
  VALUES (tenant_a, unit_a, 0, '00:00', '23:59'), (tenant_b, unit_b, 0, '00:00', '23:59');
  INSERT INTO public.appointments (
    id, tenant_id, unit_id, client_id, professional_id, starts_at, ends_at,
    duration_minutes, status, source
  ) VALUES
    (appointment_a, tenant_a, unit_a, client_a, professional_record_a, '2099-02-01 13:00:00+00', '2099-02-01 13:30:00+00', 30, 'confirmed', 'frontdesk'),
    (appointment_b, tenant_b, unit_b, client_b, professional_record_b, '2099-02-01 15:00:00+00', '2099-02-01 15:30:00+00', 30, 'confirmed', 'frontdesk');
  INSERT INTO public.confirmation_rules (id, tenant_id, unit_id, name, stage)
  VALUES
    (rule_a, tenant_a, unit_a, 'Confirmation Rule A', 'tomorrow'),
    (rule_b, tenant_b, unit_b, 'Confirmation Rule B', 'tomorrow');
  INSERT INTO public.message_templates (id, tenant_id, unit_id, service_id, stage, name, body)
  VALUES
    (template_a, tenant_a, unit_a, service_a, 'confirmation', 'Confirmation Template A', 'Olá {{client_name}}'),
    (template_b, tenant_b, unit_b, service_b, 'confirmation', 'Confirmation Template B', 'Olá {{client_name}}');
  INSERT INTO public.confirmation_queue (
    id, tenant_id, appointment_id, client_id, rule_id, stage, appointment_starts_at
  ) VALUES
    (queue_a, tenant_a, appointment_a, client_a, rule_a, 'tomorrow', '2099-02-01 13:00:00+00'),
    (queue_b, tenant_b, appointment_b, client_b, rule_b, 'tomorrow', '2099-02-01 15:00:00+00');
  INSERT INTO public.client_users (tenant_id, client_id, user_id, status)
  VALUES (tenant_a, client_a, client_user_a, 'active'), (tenant_b, client_b, client_user_b, 'active');
  INSERT INTO public.channel_preferences (tenant_id, client_id, preferred_channel)
  VALUES (tenant_a, client_a, 'whatsapp'), (tenant_b, client_b, 'email');

  -- Service-role writes bypass RLS but must never create cross-tenant links.
  EXECUTE 'SET LOCAL ROLE service_role';
  denied := false;
  BEGIN
    INSERT INTO public.message_templates (tenant_id, unit_id, stage, name, body)
    VALUES (tenant_a, unit_b, 'confirmation', 'invalid unit', 'x');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Modelo aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.message_templates (tenant_id, service_id, stage, name, body)
    VALUES (tenant_a, service_b, 'confirmation', 'invalid service', 'x');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Modelo aceitou serviço de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.confirmation_rules (tenant_id, unit_id, name, stage)
    VALUES (tenant_a, unit_b, 'invalid rule', 'tomorrow');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Regra aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.confirmation_queue (tenant_id, appointment_id, client_id, stage, appointment_starts_at)
    VALUES (tenant_a, appointment_b, client_a, 'tomorrow', '2099-02-01 15:00:00+00');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Fila aceitou agendamento ou cliente incompatível.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.confirmation_queue (tenant_id, appointment_id, client_id, rule_id, stage, appointment_starts_at)
    VALUES (tenant_a, appointment_a, client_a, rule_b, 'tomorrow', '2099-02-01 13:00:00+00');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Fila aceitou regra de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.contact_attempts (tenant_id, client_id, appointment_id, channel)
    VALUES (tenant_a, client_b, appointment_b, 'whatsapp');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Tentativa aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.contact_attempts (tenant_id, client_id, queue_id, appointment_id, channel)
    VALUES (tenant_a, client_a, queue_a, appointment_b, 'whatsapp');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Tentativa aceitou fila/agendamento incompatíveis.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.contact_attempts (tenant_id, client_id, template_id, channel)
    VALUES (tenant_a, client_a, template_b, 'whatsapp');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Tentativa aceitou modelo de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.call_logs (tenant_id, client_id, appointment_id, outcome)
    VALUES (tenant_a, client_b, appointment_b, 'answered');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Ligação aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.call_logs (tenant_id, client_id, queue_id, outcome)
    VALUES (tenant_a, client_a, queue_b, 'answered');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Ligação aceitou fila de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.channel_preferences (tenant_id, client_id, preferred_channel)
    VALUES (tenant_a, client_b, 'sms');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Preferência de canal aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.client_users (tenant_id, client_id, user_id)
    VALUES (tenant_a, client_b, client_user_a);
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Vínculo de portal aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.client_reviews (tenant_id, client_id, appointment_id, professional_id, rating)
    VALUES (tenant_a, client_a, appointment_b, professional_record_a, 5);
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Avaliação aceitou agendamento de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.client_reviews (tenant_id, client_id, appointment_id, professional_id, rating)
    VALUES (tenant_a, client_a, appointment_a, professional_record_b, 5);
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Avaliação aceitou profissional incompatível.'; END IF;

  INSERT INTO public.client_reviews (tenant_id, client_id, appointment_id, professional_id, rating, comment)
  VALUES (tenant_a, client_a, appointment_a, professional_record_a, 5, 'seed review');
  denied := false;
  BEGIN
    UPDATE public.client_reviews SET tenant_id = tenant_b WHERE appointment_id = appointment_a;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Avaliação existente foi transferida para outro tenant.'; END IF;
  RESET ROLE;

  -- Operational staff can see only tenant A rows and record their own actor id.
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
    PERFORM set_config('request.jwt.claims', json_build_object('sub', actor.user_id, 'role', 'authenticated')::text, true);

    SELECT count(*) INTO visible_rows FROM public.confirmation_queue WHERE id = queue_a;
    IF visible_rows <> 1 THEN RAISE EXCEPTION '% não leu a fila do próprio tenant.', actor.role_name; END IF;
    SELECT count(*) INTO visible_rows FROM public.confirmation_queue WHERE id = queue_b;
    IF visible_rows <> 0 THEN RAISE EXCEPTION '% leu fila do tenant B.', actor.role_name; END IF;
    SELECT count(*) INTO visible_rows FROM public.client_users WHERE user_id = client_user_b;
    IF visible_rows <> 0 THEN RAISE EXCEPTION '% leu associação de portal do tenant B.', actor.role_name; END IF;

    INSERT INTO public.contact_attempts (
      tenant_id, queue_id, appointment_id, client_id, template_id, channel, attempted_by, message_preview
    ) VALUES (tenant_a, queue_a, appointment_a, client_a, template_a, 'whatsapp', owner_b, actor.role_name)
    RETURNING id INTO inserted_id;
    SELECT attempted_by INTO actual_actor FROM public.contact_attempts WHERE id = inserted_id;
    IF actual_actor IS DISTINCT FROM actor.user_id THEN
      RAISE EXCEPTION 'Autoria da tentativa não foi vinculada ao usuário logado (%).', actor.role_name;
    END IF;

    INSERT INTO public.call_logs (tenant_id, client_id, appointment_id, queue_id, outcome, called_by, notes)
    VALUES (tenant_a, client_a, appointment_a, queue_a, 'answered', owner_b, actor.role_name)
    RETURNING id INTO inserted_id;
    SELECT called_by INTO actual_actor FROM public.call_logs WHERE id = inserted_id;
    IF actual_actor IS DISTINCT FROM actor.user_id THEN
      RAISE EXCEPTION 'Autoria da ligação não foi vinculada ao usuário logado (%).', actor.role_name;
    END IF;

    UPDATE public.confirmation_queue SET status = 'in_progress' WHERE id = queue_a;
    GET DIAGNOSTICS visible_rows = ROW_COUNT;
    IF visible_rows <> 1 THEN RAISE EXCEPTION '% não atualizou a própria fila.', actor.role_name; END IF;

    IF actor.can_configure THEN
      INSERT INTO public.confirmation_rules (tenant_id, unit_id, name, stage)
      VALUES (tenant_a, unit_a, 'Allowed rule ' || actor.role_name, 'today');
      INSERT INTO public.message_templates (tenant_id, unit_id, service_id, stage, name, body)
      VALUES (tenant_a, unit_a, service_a, 'reminder', 'Allowed template ' || actor.role_name, 'Olá');
    ELSE
      denied := false;
      BEGIN
        INSERT INTO public.confirmation_rules (tenant_id, unit_id, name, stage)
        VALUES (tenant_a, unit_a, 'Forbidden rule ' || actor.role_name, 'today');
      EXCEPTION WHEN insufficient_privilege THEN denied := true;
      END;
      IF NOT denied THEN RAISE EXCEPTION '% configurou regra sem papel owner/manager.', actor.role_name; END IF;

      denied := false;
      BEGIN
        INSERT INTO public.message_templates (tenant_id, unit_id, stage, name, body)
        VALUES (tenant_a, unit_a, 'reminder', 'Forbidden template ' || actor.role_name, 'x');
      EXCEPTION WHEN insufficient_privilege THEN denied := true;
      END;
      IF NOT denied THEN RAISE EXCEPTION '% configurou modelo sem papel owner/manager.', actor.role_name; END IF;
    END IF;

    RESET ROLE;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', NULL, true);
  END LOOP;

  -- A portal user can edit only their own channel preferences and review their
  -- own appointment. The trigger prevents changing review identity afterward.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', client_user_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object(
    'sub', client_user_a, 'role', 'authenticated', 'email', 'client-a+confirmation-scope@example.test'
  )::text, true);
  SELECT count(*) INTO visible_rows FROM public.channel_preferences WHERE tenant_id = tenant_a AND client_id = client_a;
  IF visible_rows <> 1 THEN RAISE EXCEPTION 'Cliente não leu a própria preferência de canal.'; END IF;
  SELECT count(*) INTO visible_rows FROM public.channel_preferences WHERE tenant_id = tenant_b;
  IF visible_rows <> 0 THEN RAISE EXCEPTION 'Cliente leu preferência de outro tenant.'; END IF;
  UPDATE public.channel_preferences SET do_not_disturb = true WHERE tenant_id = tenant_a AND client_id = client_a;
  GET DIAGNOSTICS visible_rows = ROW_COUNT;
  IF visible_rows <> 1 THEN RAISE EXCEPTION 'Cliente não atualizou a própria preferência.'; END IF;
  SELECT id INTO STRICT inserted_id FROM public.client_reviews WHERE appointment_id = appointment_a;
  UPDATE public.client_reviews SET comment = 'review updated' WHERE id = inserted_id;
  GET DIAGNOSTICS visible_rows = ROW_COUNT;
  IF visible_rows <> 1 THEN RAISE EXCEPTION 'Cliente não atualizou sua avaliação válida.'; END IF;
  denied := false;
  BEGIN
    UPDATE public.client_reviews SET appointment_id = appointment_b WHERE id = inserted_id;
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Cliente transferiu sua avaliação para agendamento diferente.'; END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  RAISE NOTICE 'Confirmação/portal: referências cross-tenant, autoria, RLS por papel e operações legítimas passaram.';
END
$test$;

ROLLBACK;
