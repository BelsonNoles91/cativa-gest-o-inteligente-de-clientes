-- Atomic per-tenant/day provider-call quota; all test rows roll back.
BEGIN;

DO $test$
DECLARE
  run_suffix text := replace(gen_random_uuid()::text, '-', '');
  tenant_a uuid := gen_random_uuid();
  tenant_b uuid := gen_random_uuid();
  owner_a uuid := gen_random_uuid();
  owner_b uuid := gen_random_uuid();
  first_reserved boolean;
  second_reserved boolean;
  third_reserved boolean;
  other_tenant_reserved boolean;
  denied boolean := false;
  count_for_tenant integer;
BEGIN
  IF has_function_privilege('anon', 'public.reserve_retention_advisor_evaluation(uuid, integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.reserve_retention_advisor_evaluation(uuid, integer)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.reserve_retention_advisor_evaluation(uuid, integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'A reserva de quota não está restrita ao service_role.';
  END IF;
  IF has_table_privilege('anon', 'public.retention_advisor_daily_usage', 'SELECT')
     OR has_table_privilege('authenticated', 'public.retention_advisor_daily_usage', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.retention_advisor_daily_usage', 'SELECT')
     OR has_table_privilege('service_role', 'public.retention_advisor_daily_usage', 'INSERT')
     OR has_table_privilege('service_role', 'public.retention_advisor_daily_usage', 'UPDATE')
     OR has_table_privilege('service_role', 'public.retention_advisor_daily_usage', 'DELETE') THEN
    RAISE EXCEPTION 'Privilégios diretos da tabela diária de quota estão incorretos.';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'retention-quota-a-' || run_suffix || '@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'retention-quota-b-' || run_suffix || '@example.test', '', now(), now(), now());
  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (owner_a, 'Retention Quota Owner A', false), (owner_b, 'Retention Quota Owner B', false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_super_admin = false;
  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'Retention Quota A', 'retention-quota-a-' || substring(run_suffix, 1, 12), 'salao', owner_a),
    (tenant_b, 'Retention Quota B', 'retention-quota-b-' || substring(run_suffix, 1, 12), 'salao', owner_b);

  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.reserve_retention_advisor_evaluation(tenant_a, 2);
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;
  IF NOT denied THEN RAISE EXCEPTION 'authenticated executou a reserva de quota.'; END IF;
  EXECUTE 'RESET ROLE';

  EXECUTE 'SET LOCAL ROLE service_role';
  first_reserved := public.reserve_retention_advisor_evaluation(tenant_a, 2);
  second_reserved := public.reserve_retention_advisor_evaluation(tenant_a, 2);
  third_reserved := public.reserve_retention_advisor_evaluation(tenant_a, 2);
  other_tenant_reserved := public.reserve_retention_advisor_evaluation(tenant_b, 2);
  EXECUTE 'RESET ROLE';
  SELECT invocation_count INTO STRICT count_for_tenant
  FROM public.retention_advisor_daily_usage
  WHERE tenant_id = tenant_a AND usage_date = (statement_timestamp() AT TIME ZONE 'UTC')::date;

  IF NOT first_reserved OR NOT second_reserved OR third_reserved OR NOT other_tenant_reserved THEN
    RAISE EXCEPTION 'A reserva de limite diário aceitou/rejeitou chamadas incorretamente: %, %, %, %.',
      first_reserved, second_reserved, third_reserved, other_tenant_reserved;
  END IF;
  IF count_for_tenant <> 2 THEN
    RAISE EXCEPTION 'Contador diário do tenant A ficou em %, esperado 2.', count_for_tenant;
  END IF;

  denied := false;
  EXECUTE 'SET LOCAL ROLE service_role';
  BEGIN
    PERFORM public.reserve_retention_advisor_evaluation(tenant_a, 0);
  EXCEPTION WHEN invalid_parameter_value THEN
    denied := true;
  END;
  EXECUTE 'RESET ROLE';
  IF NOT denied THEN RAISE EXCEPTION 'Limite diário zero foi aceito.'; END IF;
END;
$test$;

ROLLBACK;
