-- Tenant-scoped references in team, billing and unit administration.
-- All fixtures are synthetic and rolled back at the end.

BEGIN;

DO $test$
DECLARE
  run_suffix text := replace(gen_random_uuid()::text, '-', '');
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  unit_a uuid := gen_random_uuid();
  unit_b uuid := gen_random_uuid();
  professional_a uuid := gen_random_uuid();
  professional_b uuid := gen_random_uuid();
  invitation_a uuid := gen_random_uuid();
  invitation_b uuid := gen_random_uuid();
  plan_id uuid;
  subscription_a uuid;
  subscription_b uuid;
  denied boolean;
BEGIN
  IF has_function_privilege('anon', 'public.enforce_admin_unit_tenant_scope()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_admin_unit_tenant_scope()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.enforce_admin_unit_tenant_scope()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A função de integridade administrativa pode ser chamada diretamente.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id IN (owner_a, owner_b))
     OR EXISTS (SELECT 1 FROM public.tenants WHERE id IN (tenant_a, tenant_b))
     OR EXISTS (SELECT 1 FROM public.professionals WHERE id IN (professional_a, professional_b))
     OR EXISTS (SELECT 1 FROM public.team_invitations WHERE id IN (invitation_a, invitation_b)) THEN
    RAISE EXCEPTION 'Fixture ID duplicada: regressão interrompida antes de tocar em dados existentes.';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+admin-unit-scope-' || run_suffix || '@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b+admin-unit-scope-' || run_suffix || '@example.test', '', now(), now(), now());
  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (owner_a, 'Admin Unit Owner A', false), (owner_b, 'Admin Unit Owner B', false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_super_admin = false;
  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'Admin Unit Scope A', 'admin-unit-scope-a-' || substring(run_suffix, 1, 12), 'salao', owner_a),
    (tenant_b, 'Admin Unit Scope B', 'admin-unit-scope-b-' || substring(run_suffix, 1, 12), 'salao', owner_b);
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (tenant_a, owner_a, 'owner', 'active'), (tenant_b, owner_b, 'owner', 'active');
  INSERT INTO public.units (id, tenant_id, name, is_default)
  VALUES (unit_a, tenant_a, 'Admin Unit A', true), (unit_b, tenant_b, 'Admin Unit B', true);
  INSERT INTO public.professionals (id, tenant_id, unit_id, display_name)
  VALUES
    (professional_a, tenant_a, unit_a, 'Admin Professional A'),
    (professional_b, tenant_b, unit_b, 'Admin Professional B');

  SELECT id INTO STRICT plan_id FROM public.plans WHERE code = 'free';
  INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status)
  VALUES (tenant_a, plan_id, 'active'), (tenant_b, plan_id, 'active');
  SELECT id INTO STRICT subscription_a FROM public.tenant_subscriptions WHERE tenant_id = tenant_a;
  SELECT id INTO STRICT subscription_b FROM public.tenant_subscriptions WHERE tenant_id = tenant_b;

  INSERT INTO public.tenant_settings (tenant_id, default_unit_id)
  VALUES (tenant_a, unit_a), (tenant_b, unit_b);
  INSERT INTO public.unit_settings (unit_id, tenant_id)
  VALUES (unit_a, tenant_a), (unit_b, tenant_b);
  INSERT INTO public.subscription_events (tenant_id, subscription_id, event_type)
  VALUES (tenant_a, subscription_a, 'created'), (tenant_b, subscription_b, 'created');
  INSERT INTO public.team_invitations (id, tenant_id, email, role, token, token_hash, invited_by, status, expires_at, professional_id)
  VALUES
    (invitation_a, tenant_a, 'professional-a+admin-unit-scope-' || run_suffix || '@example.test', 'professional', 'scope-token-a-' || run_suffix, md5('scope-token-a-' || run_suffix), owner_a, 'pending', now() + interval '7 days', professional_a),
    (invitation_b, tenant_b, 'professional-b+admin-unit-scope-' || run_suffix || '@example.test', 'professional', 'scope-token-b-' || run_suffix, md5('scope-token-b-' || run_suffix), owner_b, 'pending', now() + interval '7 days', professional_b);

  EXECUTE 'SET LOCAL ROLE service_role';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  denied := false;
  BEGIN
    INSERT INTO public.professionals (tenant_id, unit_id, display_name) VALUES (tenant_a, unit_b, 'Invalid cross-tenant professional');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Profissional aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.subscription_events (tenant_id, subscription_id, event_type) VALUES (tenant_a, subscription_b, 'note');
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Evento de assinatura aceitou subscription de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.team_invitations (tenant_id, email, role, token, token_hash, invited_by, status, expires_at, professional_id)
    VALUES (tenant_a, 'invalid+admin-unit-scope-' || run_suffix || '@example.test', 'professional', 'scope-token-invalid-' || run_suffix, md5('scope-token-invalid-' || run_suffix), owner_a, 'pending', now() + interval '7 days', professional_b);
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Convite aceitou profissional de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.tenant_settings (tenant_id, default_unit_id) VALUES (tenant_a, unit_b);
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Configuração aceitou unidade padrão de outro tenant.'; END IF;

  denied := false;
  BEGIN
    INSERT INTO public.unit_settings (unit_id, tenant_id) VALUES (unit_b, tenant_a);
  EXCEPTION WHEN check_violation THEN denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'Configuração de unidade aceitou tenant divergente.'; END IF;

  denied := false;
  BEGIN UPDATE public.professionals SET unit_id = unit_b WHERE id = professional_a;
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Atualização moveu profissional para unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN UPDATE public.subscription_events SET tenant_id = tenant_b WHERE tenant_id = tenant_a;
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Evento existente foi transferido para outro tenant.'; END IF;

  denied := false;
  BEGIN UPDATE public.team_invitations SET tenant_id = tenant_b WHERE id = invitation_a;
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Convite existente foi transferido para outro tenant.'; END IF;

  denied := false;
  BEGIN UPDATE public.tenant_settings SET tenant_id = tenant_b WHERE tenant_id = tenant_a;
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Configuração do tenant foi transferida para outro tenant.'; END IF;

  denied := false;
  BEGIN UPDATE public.unit_settings SET tenant_id = tenant_b WHERE unit_id = unit_a;
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Configuração da unidade foi transferida para outro tenant.'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'Administração/unidades: cinco relações cross-tenant e cinco reatribuições foram bloqueadas; referências legítimas passaram.';
END
$test$;

ROLLBACK;
