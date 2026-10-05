-- Atomic tenant onboarding: authenticated owner binding, least privilege,
-- collision-safe slug allocation, required child rows, and full rollback.
BEGIN;

CREATE OR REPLACE FUNCTION public._qa_fail_atomic_tenant_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = NEW.tenant_id
      AND name = 'Cativa Atomic Rollback Regression'
  ) THEN
    RAISE EXCEPTION 'qa_atomic_onboarding_injected_failure';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER _qa_fail_atomic_tenant_onboarding
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public._qa_fail_atomic_tenant_onboarding();

DO $test$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_slug text := 'cativa-onboarding-' || left(replace(gen_random_uuid()::text, '-', ''), 12);
  v_tenant_id uuid;
  v_tenant_id_2 uuid;
  v_unit_id uuid;
  v_unit_id_2 uuid;
  v_slug_1 text;
  v_slug_2 text;
  v_failed boolean := false;
  v_invalid_payload_rejected boolean := false;
  v_error text;
  v_count integer;
BEGIN
  IF NOT has_function_privilege(
       'authenticated',
       'public.create_tenant_with_owner(text,text,public.tenant_segment,text,text,text,text,text,text,text,text,jsonb,jsonb)',
       'EXECUTE'
     ) OR has_function_privilege(
       'anon',
       'public.create_tenant_with_owner(text,text,public.tenant_segment,text,text,text,text,text,text,text,text,jsonb,jsonb)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'RPC precisa ser executável por authenticated e indisponível para anon.';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES (
    v_user_id, '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'atomic-onboarding-' || replace(v_user_id::text, '-', '') || '@example.test',
    '', now(), now(), now()
  );

  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_id, 'role', 'authenticated')::text,
    true
  );

  -- has_function_privilege above verifies anon cannot execute the RPC. Do not
  -- make that denied call under the local reserved role: some Supabase Postgres
  -- images crash in supautils instead of returning SQLSTATE 42501.

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT tenant_id, unit_id, slug
  INTO v_tenant_id, v_unit_id, v_slug_1
  FROM public.create_tenant_with_owner(
    'Cativa Atomic Primary', v_slug, 'salao', 'Matriz QA',
    'America/Belem', 'BRL', '5591999999999', '#111111', '#222222', '#333333', '5591888888888',
    '[{"name":"Profissional QA"}]'::jsonb,
    '[{"name":"Serviço QA","price":"125.50"}]'::jsonb
  );

  IF v_slug_1 <> v_slug THEN
    RAISE EXCEPTION 'RPC alterou o slug disponível: esperado %, retornou %.', v_slug, v_slug_1;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE id = v_tenant_id AND created_by = v_user_id AND slug = v_slug_1
  ) OR NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = v_tenant_id AND user_id = v_user_id AND role = 'owner' AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Tenant não foi vinculado ao usuário autenticado como owner ativo.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.units
    WHERE id = v_unit_id AND tenant_id = v_tenant_id AND is_default
  ) OR NOT EXISTS (
    SELECT 1 FROM public.tenant_settings
    WHERE tenant_id = v_tenant_id AND default_unit_id = v_unit_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.unit_settings
    WHERE unit_id = v_unit_id AND tenant_id = v_tenant_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.audit_logs
    WHERE tenant_id = v_tenant_id AND actor_id = v_user_id
      AND action = 'tenant.created' AND entity_id = v_tenant_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.tenant_subscriptions
    WHERE tenant_id = v_tenant_id
      AND (status = 'active' OR (status = 'trialing' AND trial_ends_at > now()))
  ) OR NOT EXISTS (
    SELECT 1 FROM public.professionals
    WHERE tenant_id = v_tenant_id AND unit_id = v_unit_id
      AND display_name = 'Profissional QA' AND is_active
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.services service
    JOIN public.service_prices price
      ON price.service_id = service.id AND price.tenant_id = service.tenant_id
    WHERE service.tenant_id = v_tenant_id AND service.name = 'Serviço QA'
      AND service.duration_minutes = 30 AND service.is_active
      AND price.amount_cents = 12550 AND price.currency = 'BRL' AND price.is_default
  ) THEN
    RAISE EXCEPTION 'Provisionamento não criou unidade, configurações, auditoria, trial e catálogo inicial de forma completa.';
  END IF;

  SELECT tenant_id, unit_id, slug
  INTO v_tenant_id_2, v_unit_id_2, v_slug_2
  FROM public.create_tenant_with_owner(
    'Cativa Atomic Duplicate', v_slug, 'salao', 'Matriz QA'
  );
  IF v_slug_2 <> v_slug || '-2' THEN
    RAISE EXCEPTION 'Colisão de slug não foi resolvida deterministicamente; retornou %.', v_slug_2;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = v_tenant_id_2 AND user_id = v_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'A segunda criação não manteve o usuário autenticado como owner.';
  END IF;

  BEGIN
    PERFORM public.create_tenant_with_owner(
      p_name => 'Cativa Atomic Invalid Price',
      p_slug => v_slug || '-invalid-price',
      p_segment => 'salao',
      p_unit_name => 'Matriz QA',
      p_initial_services => '[{"name":"Preço inválido","price":"not-a-price"}]'::jsonb
    );
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_invalid_payload_rejected := true;
  END;
  IF NOT v_invalid_payload_rejected THEN
    RAISE EXCEPTION 'RPC aceitou um preço inválido no catálogo inicial.';
  END IF;
  SELECT count(*) INTO v_count FROM public.tenants WHERE slug = v_slug || '-invalid-price';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Preço inválido deixou tenant parcialmente criado.';
  END IF;

  BEGIN
    PERFORM public.create_tenant_with_owner(
      'Cativa Atomic Rollback Regression', v_slug || '-rollback', 'salao', 'Matriz QA'
    );
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    v_failed := true;
  END;
  IF NOT v_failed OR v_error <> 'qa_atomic_onboarding_injected_failure' THEN
    RAISE EXCEPTION 'Falha injetada na criação não foi propagada como esperado: %.', v_error;
  END IF;

  SELECT count(*) INTO v_count FROM public.tenants WHERE slug = v_slug || '-rollback';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Rollback incompleto: falha deixou % tenant(s) órfão(s).', v_count;
  END IF;
  SELECT count(*) INTO v_count
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE t.slug = v_slug || '-rollback';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Rollback incompleto: falha deixou membership(s).';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.tenant_subscriptions subscription
  JOIN public.tenants tenant ON tenant.id = subscription.tenant_id
  WHERE tenant.slug = v_slug || '-rollback';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'Rollback incompleto: falha deixou assinatura(s) órfã(s).';
  END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'Atomic tenant onboarding: grants, owner binding, child rows, audit, slug collision and rollback passed.';
END;
$test$;

DROP TRIGGER _qa_fail_atomic_tenant_onboarding ON public.audit_logs;
DROP FUNCTION public._qa_fail_atomic_tenant_onboarding();
ROLLBACK;
