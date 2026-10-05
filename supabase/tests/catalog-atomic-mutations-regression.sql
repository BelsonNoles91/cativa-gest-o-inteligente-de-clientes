-- Catalog parent/child writes must either commit as a whole or leave no change.
-- All identities and rows are synthetic and rolled back at the end.

BEGIN;

INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES
  ('00000000-0000-4a00-8a00-202610040001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+catalog-atomic-a@example.test', '', now(), now(), now()),
  ('00000000-0000-4a00-8a00-202610040002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+catalog-atomic-b@example.test', '', now(), now(), now()),
  ('00000000-0000-4a00-8a00-202610040003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frontdesk+catalog-atomic@example.test', '', now(), now(), now());

INSERT INTO public.profiles (id, full_name, is_super_admin)
VALUES
  ('00000000-0000-4a00-8a00-202610040001', 'Catalog Atomic Owner A', false),
  ('00000000-0000-4a00-8a00-202610040002', 'Catalog Atomic Owner B', false),
  ('00000000-0000-4a00-8a00-202610040003', 'Catalog Atomic Frontdesk', false)
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_super_admin = false;

INSERT INTO public.tenants (id, name, slug, segment, created_by)
VALUES
  ('00000000-0000-4a00-8a00-202610041001', 'Catalog Atomic A', 'catalog-atomic-a', 'salao', '00000000-0000-4a00-8a00-202610040001'),
  ('00000000-0000-4a00-8a00-202610041002', 'Catalog Atomic B', 'catalog-atomic-b', 'salao', '00000000-0000-4a00-8a00-202610040002');

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
VALUES
  ('00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610040001', 'owner', 'active'),
  ('00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610040003', 'frontdesk', 'active'),
  ('00000000-0000-4a00-8a00-202610041002', '00000000-0000-4a00-8a00-202610040002', 'owner', 'active');

INSERT INTO public.units (id, tenant_id, name, is_default)
VALUES
  ('00000000-0000-4a00-8a00-202610041101', '00000000-0000-4a00-8a00-202610041001', 'Atomic Unit A', true),
  ('00000000-0000-4a00-8a00-202610041102', '00000000-0000-4a00-8a00-202610041002', 'Atomic Unit B', true);

INSERT INTO public.professionals (id, tenant_id, unit_id, display_name)
VALUES
  ('00000000-0000-4a00-8a00-202610041201', '00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610041101', 'Atomic Professional A'),
  ('00000000-0000-4a00-8a00-202610041202', '00000000-0000-4a00-8a00-202610041002', '00000000-0000-4a00-8a00-202610041102', 'Atomic Professional B');

INSERT INTO public.services (id, tenant_id, name, duration_minutes)
VALUES
  ('00000000-0000-4a00-8a00-202610041301', '00000000-0000-4a00-8a00-202610041001', 'Existing Atomic Service A', 30),
  ('00000000-0000-4a00-8a00-202610041302', '00000000-0000-4a00-8a00-202610041002', 'Existing Atomic Service B', 30);

INSERT INTO public.service_prices (tenant_id, service_id, currency, amount_cents, is_default)
VALUES ('00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610041301', 'BRL', 1000, true);

INSERT INTO public.service_unit_prices (tenant_id, service_id, unit_id, amount_cents)
VALUES ('00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610041301', '00000000-0000-4a00-8a00-202610041101', 777);

INSERT INTO public.service_professional_prices (tenant_id, service_id, professional_id, amount_cents)
VALUES ('00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610041301', '00000000-0000-4a00-8a00-202610041201', 888);

INSERT INTO public.packages (id, tenant_id, name, price_cents)
VALUES ('00000000-0000-4a00-8a00-202610041401', '00000000-0000-4a00-8a00-202610041001', 'Existing Atomic Package', 5000);
INSERT INTO public.package_items (tenant_id, package_id, service_id, sessions, position)
VALUES ('00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610041401', '00000000-0000-4a00-8a00-202610041301', 3, 0);

INSERT INTO public.memberships (id, tenant_id, name, price_cents)
VALUES ('00000000-0000-4a00-8a00-202610041501', '00000000-0000-4a00-8a00-202610041001', 'Existing Atomic Membership', 6000);
INSERT INTO public.membership_benefits (tenant_id, membership_id, service_id, sessions_per_cycle, discount_pct)
VALUES ('00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610041501', '00000000-0000-4a00-8a00-202610041301', 2, 10);

INSERT INTO public.protocols (id, tenant_id, name, total_sessions, total_price_cents)
VALUES ('00000000-0000-4a00-8a00-202610041601', '00000000-0000-4a00-8a00-202610041001', 'Existing Atomic Protocol', 1, 7000);
INSERT INTO public.protocol_sessions (tenant_id, protocol_id, service_id, step)
VALUES ('00000000-0000-4a00-8a00-202610041001', '00000000-0000-4a00-8a00-202610041601', '00000000-0000-4a00-8a00-202610041301', 1);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4a00-8a00-202610040001', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4a00-8a00-202610040001","role":"authenticated"}', true);

DO $test$
DECLARE
  tenant_a uuid := '00000000-0000-4a00-8a00-202610041001';
  tenant_b uuid := '00000000-0000-4a00-8a00-202610041002';
  owner_a uuid := '00000000-0000-4a00-8a00-202610040001';
  owner_b uuid := '00000000-0000-4a00-8a00-202610040002';
  frontdesk_a uuid := '00000000-0000-4a00-8a00-202610040003';
  unit_a uuid := '00000000-0000-4a00-8a00-202610041101';
  unit_b uuid := '00000000-0000-4a00-8a00-202610041102';
  professional_b uuid := '00000000-0000-4a00-8a00-202610041202';
  service_a uuid := '00000000-0000-4a00-8a00-202610041301';
  service_b uuid := '00000000-0000-4a00-8a00-202610041302';
  v_service_id uuid;
  v_package_id uuid;
  v_membership_id uuid;
  v_protocol_id uuid;
  result jsonb;
  v_error_state text;
  v_row_count bigint;
  v_price_cents integer;
  v_service_name text;
  v_function_signature text;
BEGIN
  FOREACH v_function_signature IN ARRAY ARRAY[
    'public.catalog_create_service_with_price(jsonb,integer,text)',
    'public.catalog_update_service_with_price(uuid,jsonb,integer,text)',
    'public.catalog_replace_service_unit_prices(uuid,uuid,jsonb)',
    'public.catalog_replace_service_professional_prices(uuid,uuid,jsonb)',
    'public.catalog_save_package_bundle(uuid,uuid,jsonb,jsonb)',
    'public.catalog_save_membership_bundle(uuid,uuid,jsonb,jsonb)',
    'public.catalog_save_protocol_bundle(uuid,uuid,jsonb,jsonb)'
  ] LOOP
    IF has_function_privilege('anon', v_function_signature, 'EXECUTE')
       OR NOT has_function_privilege('authenticated', v_function_signature, 'EXECUTE') THEN
      RAISE EXCEPTION 'Grants inadequados para %.', v_function_signature;
    END IF;
  END LOOP;

  -- A parent and its required base price are created as one transaction.
  result := public.catalog_create_service_with_price(
    jsonb_build_object('tenant_id', tenant_a, 'name', 'RPC Atomic Service', 'duration_minutes', 45),
    1250,
    'brl'
  );
  v_service_id := (result ->> 'id')::uuid;
  IF result ->> 'name' IS DISTINCT FROM 'RPC Atomic Service' THEN
    RAISE EXCEPTION 'A RPC não retornou o serviço criado.';
  END IF;
  SELECT count(*) INTO v_row_count FROM public.service_prices AS price WHERE price.service_id = v_service_id AND price.is_default;
  IF v_row_count <> 1 THEN RAISE EXCEPTION 'Serviço criado sem exatamente um preço-base.'; END IF;

  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_create_service_with_price(
      jsonb_build_object('tenant_id', tenant_a, 'name', 'Must Roll Back', 'duration_minutes', 30), -1, 'BRL'
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '22023' THEN RAISE EXCEPTION 'Preço negativo não foi recusado como esperado: %.', v_error_state; END IF;
  SELECT count(*) INTO v_row_count FROM public.services WHERE tenant_id = tenant_a AND name = 'Must Roll Back';
  IF v_row_count <> 0 THEN RAISE EXCEPTION 'Preço-base inválido deixou um serviço órfão.'; END IF;

  -- The parent UPDATE runs before the scalar price UPDATE detects duplicate defaults;
  -- the caught cardinality error must roll both parent and child writes back.
  INSERT INTO public.service_prices (tenant_id, service_id, currency, amount_cents, is_default)
  VALUES (tenant_a, '00000000-0000-4a00-8a00-202610041301', 'USD', 1500, true);
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_update_service_with_price(
      '00000000-0000-4a00-8a00-202610041301', '{"name":"Must Roll Back"}'::jsonb, 2200, 'BRL'
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM 'P0003' THEN RAISE EXCEPTION 'Preço-base duplicado não causou rollback de cardinalidade: %.', v_error_state; END IF;
  SELECT name INTO v_service_name FROM public.services WHERE id = '00000000-0000-4a00-8a00-202610041301';
  SELECT count(*) INTO v_row_count FROM public.service_prices WHERE service_id = '00000000-0000-4a00-8a00-202610041301' AND amount_cents IN (1000, 1500);
  IF v_service_name IS DISTINCT FROM 'Existing Atomic Service A' OR v_row_count <> 2 THEN
    RAISE EXCEPTION 'Falha no preço-base não reverteu serviço e preços.';
  END IF;
  DELETE FROM public.service_prices WHERE service_id = '00000000-0000-4a00-8a00-202610041301' AND currency = 'USD';
  result := public.catalog_update_service_with_price(
    '00000000-0000-4a00-8a00-202610041301', '{"name":"Updated Atomic Service"}'::jsonb, 2300, 'USD'
  );
  IF result ->> 'name' IS DISTINCT FROM 'Updated Atomic Service' THEN RAISE EXCEPTION 'Atualização válida do serviço falhou.'; END IF;
  SELECT amount_cents INTO v_price_cents FROM public.service_prices WHERE service_id = '00000000-0000-4a00-8a00-202610041301' AND is_default;
  IF v_price_cents <> 2300 THEN RAISE EXCEPTION 'Atualização válida do preço-base não persistiu.'; END IF;

  -- NULL is not an empty list: malformed input must not delete the existing overrides.
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_replace_service_unit_prices(tenant_a, '00000000-0000-4a00-8a00-202610041301', NULL);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '22023' THEN RAISE EXCEPTION 'Array nulo de preços unitários não foi recusado.'; END IF;
  SELECT amount_cents INTO v_price_cents FROM public.service_unit_prices
  WHERE service_id = '00000000-0000-4a00-8a00-202610041301' AND unit_id = unit_a;
  IF v_price_cents <> 777 THEN RAISE EXCEPTION 'Entrada nula apagou preço unitário anterior.'; END IF;

  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_replace_service_unit_prices(
      tenant_a, '00000000-0000-4a00-8a00-202610041301',
      jsonb_build_array(jsonb_build_object('unit_id', unit_b, 'amount_cents', 999))
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Preço com unidade de outro tenant não foi recusado: %.', v_error_state; END IF;
  SELECT amount_cents INTO v_price_cents FROM public.service_unit_prices
  WHERE service_id = '00000000-0000-4a00-8a00-202610041301' AND unit_id = unit_a;
  IF v_price_cents <> 777 THEN RAISE EXCEPTION 'Falha na unidade removeu o override válido anterior.'; END IF;
  PERFORM public.catalog_replace_service_unit_prices(
    tenant_a, '00000000-0000-4a00-8a00-202610041301', '[]'::jsonb
  );
  SELECT count(*) INTO v_row_count FROM public.service_unit_prices WHERE service_id = '00000000-0000-4a00-8a00-202610041301';
  IF v_row_count <> 0 THEN RAISE EXCEPTION 'Lista vazia válida não removeu os overrides.'; END IF;

  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_replace_service_professional_prices(
      tenant_a, '00000000-0000-4a00-8a00-202610041301',
      jsonb_build_array(jsonb_build_object('professional_id', professional_b, 'amount_cents', 999))
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Preço com profissional de outro tenant não foi recusado: %.', v_error_state; END IF;
  SELECT amount_cents INTO v_price_cents FROM public.service_professional_prices
  WHERE service_id = '00000000-0000-4a00-8a00-202610041301' AND professional_id = '00000000-0000-4a00-8a00-202610041201';
  IF v_price_cents <> 888 THEN RAISE EXCEPTION 'Falha no profissional removeu o override válido anterior.'; END IF;

  -- Package and child item rollback on both INSERT and UPDATE.
  result := public.catalog_save_package_bundle(
    NULL, tenant_a, '{"name":"Created Atomic Package","price_cents":3000}'::jsonb,
    jsonb_build_array(jsonb_build_object('service_id', v_service_id, 'sessions', 3))
  );
  v_package_id := (result ->> 'id')::uuid;
  SELECT count(*) INTO v_row_count FROM public.package_items AS item WHERE item.package_id = v_package_id;
  IF v_row_count <> 1 THEN RAISE EXCEPTION 'Criação válida de pacote não gravou o item.'; END IF;
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_save_package_bundle(
      NULL, tenant_a, '{"name":"Orphan Package","price_cents":3000}'::jsonb,
      jsonb_build_array(jsonb_build_object('service_id', service_b, 'sessions', 1))
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Criação de pacote aceitou serviço de outro tenant: %.', v_error_state; END IF;
  SELECT count(*) INTO v_row_count FROM public.packages WHERE tenant_id = tenant_a AND name = 'Orphan Package';
  IF v_row_count <> 0 THEN RAISE EXCEPTION 'Falha no item deixou pacote órfão.'; END IF;
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_save_package_bundle(
      '00000000-0000-4a00-8a00-202610041401', tenant_a,
      '{"name":"Must Roll Back Package","price_cents":9000}'::jsonb,
      jsonb_build_array(jsonb_build_object('service_id', service_b, 'sessions', 1))
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Atualização de pacote aceitou serviço de outro tenant.'; END IF;
  SELECT package.name, package.price_cents INTO v_service_name, v_price_cents FROM public.packages AS package WHERE package.id = '00000000-0000-4a00-8a00-202610041401';
  SELECT count(*) INTO v_row_count FROM public.package_items WHERE package_id = '00000000-0000-4a00-8a00-202610041401' AND service_id = '00000000-0000-4a00-8a00-202610041301';
  IF v_service_name <> 'Existing Atomic Package' OR v_price_cents <> 5000 OR v_row_count <> 1 THEN
    RAISE EXCEPTION 'Falha no item não reverteu o pacote e seu item anterior.';
  END IF;

  -- Membership benefits and protocol sessions have the same atomic guarantee.
  result := public.catalog_save_membership_bundle(
    NULL, tenant_a, '{"name":"Created Atomic Membership","price_cents":4500}'::jsonb,
    jsonb_build_array(jsonb_build_object('service_id', v_service_id, 'sessions_per_cycle', 2, 'discount_pct', 15))
  );
  v_membership_id := (result ->> 'id')::uuid;
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_save_membership_bundle(
      NULL, tenant_a, '{"name":"Orphan Membership"}'::jsonb,
      jsonb_build_array(jsonb_build_object('service_id', service_b, 'sessions_per_cycle', 1, 'discount_pct', 0))
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Criação de membership aceitou serviço de outro tenant.'; END IF;
  SELECT count(*) INTO v_row_count FROM public.memberships WHERE tenant_id = tenant_a AND name = 'Orphan Membership';
  IF v_row_count <> 0 THEN RAISE EXCEPTION 'Falha no benefício deixou membership órfã.'; END IF;
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_save_membership_bundle(
      '00000000-0000-4a00-8a00-202610041501', tenant_a,
      '{"name":"Must Roll Back Membership","price_cents":9900}'::jsonb,
      jsonb_build_array(jsonb_build_object('service_id', service_b, 'sessions_per_cycle', 1, 'discount_pct', 0))
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Atualização de membership aceitou serviço de outro tenant.'; END IF;
  SELECT membership.name, membership.price_cents INTO v_service_name, v_price_cents FROM public.memberships AS membership WHERE membership.id = '00000000-0000-4a00-8a00-202610041501';
  SELECT count(*) INTO v_row_count FROM public.membership_benefits WHERE membership_id = '00000000-0000-4a00-8a00-202610041501' AND service_id = '00000000-0000-4a00-8a00-202610041301';
  IF v_service_name <> 'Existing Atomic Membership' OR v_price_cents <> 6000 OR v_row_count <> 1 THEN
    RAISE EXCEPTION 'Falha no benefício não reverteu a membership e seu benefício anterior.';
  END IF;

  result := public.catalog_save_protocol_bundle(
    NULL, tenant_a, '{"name":"Created Atomic Protocol","total_sessions":1,"total_price_cents":7000}'::jsonb,
    jsonb_build_array(jsonb_build_object('service_id', v_service_id, 'interval_days', 7))
  );
  v_protocol_id := (result ->> 'id')::uuid;
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_save_protocol_bundle(
      NULL, tenant_a, '{"name":"Orphan Protocol","total_sessions":1}'::jsonb,
      jsonb_build_array(jsonb_build_object('service_id', service_b, 'interval_days', 7))
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Criação de protocolo aceitou serviço de outro tenant.'; END IF;
  SELECT count(*) INTO v_row_count FROM public.protocols WHERE tenant_id = tenant_a AND name = 'Orphan Protocol';
  IF v_row_count <> 0 THEN RAISE EXCEPTION 'Falha na etapa deixou protocolo órfão.'; END IF;
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_save_protocol_bundle(
      '00000000-0000-4a00-8a00-202610041601', tenant_a,
      '{"name":"Must Roll Back Protocol","total_price_cents":9900}'::jsonb,
      jsonb_build_array(jsonb_build_object('service_id', service_b, 'interval_days', 7))
    );
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '23514' THEN RAISE EXCEPTION 'Atualização de protocolo aceitou serviço de outro tenant.'; END IF;
  SELECT protocol.name, protocol.total_price_cents INTO v_service_name, v_price_cents FROM public.protocols AS protocol WHERE protocol.id = '00000000-0000-4a00-8a00-202610041601';
  SELECT count(*) INTO v_row_count FROM public.protocol_sessions WHERE protocol_id = '00000000-0000-4a00-8a00-202610041601' AND service_id = '00000000-0000-4a00-8a00-202610041301';
  IF v_service_name <> 'Existing Atomic Protocol' OR v_price_cents <> 7000 OR v_row_count <> 1 THEN
    RAISE EXCEPTION 'Falha na etapa não reverteu o protocolo e sua etapa anterior.';
  END IF;

  -- Explicit role checks defend the RPC boundary in addition to table RLS.
  PERFORM set_config('request.jwt.claim.sub', frontdesk_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', frontdesk_a, 'role', 'authenticated')::text, true);
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_save_package_bundle(NULL, tenant_a, '{"name":"Frontdesk Must Not Create"}'::jsonb, '[]'::jsonb);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM '42501' THEN RAISE EXCEPTION 'Frontdesk conseguiu gravar catálogo: %.', v_error_state; END IF;
  SELECT count(*) INTO v_row_count FROM public.packages WHERE tenant_id = tenant_a AND name = 'Frontdesk Must Not Create';
  IF v_row_count <> 0 THEN RAISE EXCEPTION 'Frontdesk deixou pacote persistido.'; END IF;

  PERFORM set_config('request.jwt.claim.sub', owner_b::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_b, 'role', 'authenticated')::text, true);
  v_error_state := NULL;
  BEGIN
    PERFORM public.catalog_update_service_with_price(v_service_id, '{"name":"Cross Tenant Write"}'::jsonb, 1, NULL);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS v_error_state = RETURNED_SQLSTATE;
  END;
  IF v_error_state IS DISTINCT FROM 'P0002' AND v_error_state IS DISTINCT FROM '42501' THEN
    RAISE EXCEPTION 'Owner de outro tenant acessou serviço alheio: %.', v_error_state;
  END IF;

  RAISE NOTICE 'Catálogo atômico: RPCs, grants, valores nulos/inválidos, rollback pai/filho, escopo tenant e autorização aprovados.';
END
$test$;

ROLLBACK;
