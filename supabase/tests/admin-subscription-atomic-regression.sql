-- Verify subscription administration is super-admin-only, validated,
-- serialized, and atomic with both subscription and audit-event writes.
BEGIN;

CREATE OR REPLACE FUNCTION public._qa_fail_admin_subscription_audit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF NEW.tenant_id = '00000000-0000-4000-8000-00000000a701'::uuid
     AND NEW.action = 'subscription.updated'
     AND NEW.metadata->>'reason' = 'audit failure rollback regression' THEN
    RAISE EXCEPTION 'qa_admin_subscription_audit_failure';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER _qa_fail_admin_subscription_audit
BEFORE INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public._qa_fail_admin_subscription_audit();

DO $test$
DECLARE
  v_tenant uuid := '00000000-0000-4000-8000-00000000a701';
  v_user uuid := '00000000-0000-4000-8000-0000000007a1';
  v_owner uuid := '00000000-0000-4000-8000-0000000007a2';
  v_plan_basic uuid := '00000000-0000-4000-8000-00000000a711';
  v_plan_pro uuid := '00000000-0000-4000-8000-00000000a712';
  v_subscription public.tenant_subscriptions%ROWTYPE;
  v_before public.tenant_subscriptions%ROWTYPE;
  v_event_count integer;
  v_audit_count integer;
  v_denied boolean := false;
  v_invalid boolean := false;
  v_atomic_rollback boolean := false;
BEGIN
  IF NOT has_function_privilege(
       'authenticated',
       'public.admin_manage_tenant_subscription(uuid,uuid,public.subscription_status,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,integer,text,jsonb,text,text)',
       'EXECUTE'
     ) OR has_function_privilege(
       'anon',
       'public.admin_manage_tenant_subscription(uuid,uuid,public.subscription_status,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,integer,text,jsonb,text,text)',
       'EXECUTE'
     ) OR has_function_privilege(
       'service_role',
       'public.admin_manage_tenant_subscription(uuid,uuid,public.subscription_status,timestamp with time zone,timestamp with time zone,timestamp with time zone,timestamp with time zone,integer,text,jsonb,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'A RPC deve ser executável somente por authenticated (com autorização interna).';
  END IF;

  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at
  ) VALUES
    (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'admin-subscription-' || replace(v_user::text, '-', '') || '@example.test', '', now(), now(), now()),
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'admin-subscription-owner-' || replace(v_owner::text, '-', '') || '@example.test', '', now(), now(), now());

  ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_super_admin_changes_trg;
  ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_self_super_admin;
  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (v_user, 'QA Subscription Admin', true), (v_owner, 'QA Subscription Owner', false)
  ON CONFLICT (id) DO UPDATE SET is_super_admin = EXCLUDED.is_super_admin;
  ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_super_admin_changes_trg;
  ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_self_super_admin;

  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES (v_tenant, 'QA Atomic Subscription', 'qa-atomic-subscription', 'salao', v_owner);
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (v_tenant, v_owner, 'owner', 'active');
  INSERT INTO public.plans (id, code, name, billing_period, price_cents, status)
  VALUES
    (v_plan_basic, 'qa-subscription-basic', 'QA Basic', 'monthly', 10000, 'public'),
    (v_plan_pro, 'qa-subscription-pro', 'QA Pro', 'monthly', 20000, 'public');

  PERFORM set_config('request.jwt.claim.sub', v_owner::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.admin_manage_tenant_subscription(
      v_tenant, v_plan_basic, 'active', NULL, NULL, now(), NULL,
      0, NULL, '{}'::jsonb, NULL, 'test of denied non-admin'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;
  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  IF NOT v_denied THEN
    RAISE EXCEPTION 'Usuário owner conseguiu administrar uma assinatura.';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT * INTO v_subscription
  FROM public.admin_manage_tenant_subscription(
    v_tenant, v_plan_basic, 'trialing', now(), now() + interval '14 days', now(), NULL,
    0, NULL, '{"max_units":2,"max_appointments_month":500}'::jsonb,
    'initial synthetic trial', 'QA fixture creation'
  );
  RESET ROLE;

  IF v_subscription.tenant_id IS DISTINCT FROM v_tenant
     OR v_subscription.plan_id IS DISTINCT FROM v_plan_basic
     OR v_subscription.status IS DISTINCT FROM 'trialing'::public.subscription_status
     OR v_subscription.override_limits <> '{"max_units":2,"max_appointments_month":500}'::jsonb
     OR NOT EXISTS (
       SELECT 1 FROM public.subscription_events
       WHERE subscription_id = v_subscription.id AND tenant_id = v_tenant
         AND event_type = 'created' AND actor_id = v_user
         AND notes LIKE '%QA fixture creation%'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.audit_logs
       WHERE tenant_id = v_tenant AND entity_id = v_subscription.id
         AND action = 'subscription.created' AND actor_id = v_user
         AND metadata->>'reason' = 'QA fixture creation'
     ) THEN
    RAISE EXCEPTION 'Criação da assinatura/trial e trilhas de auditoria não foram persistidas corretamente.';
  END IF;

  -- A validation failure must not alter subscription, event, or audit rows.
  SELECT * INTO v_before FROM public.tenant_subscriptions WHERE id = v_subscription.id;
  SELECT count(*) INTO v_event_count FROM public.subscription_events WHERE subscription_id = v_subscription.id;
  SELECT count(*) INTO v_audit_count FROM public.audit_logs WHERE tenant_id = v_tenant;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.admin_manage_tenant_subscription(
      v_tenant, v_plan_pro, 'active', NULL, NULL, now(), NULL,
      20001, 'over limit', '{}'::jsonb, 'must not persist', 'invalid discount regression'
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    v_invalid := true;
  END;
  RESET ROLE;
  IF NOT v_invalid
     OR (SELECT to_jsonb(subscription) FROM public.tenant_subscriptions AS subscription WHERE id = v_subscription.id)
       IS DISTINCT FROM to_jsonb(v_before)
     OR (SELECT count(*) FROM public.subscription_events WHERE subscription_id = v_subscription.id) <> v_event_count
     OR (SELECT count(*) FROM public.audit_logs WHERE tenant_id = v_tenant) <> v_audit_count THEN
    RAISE EXCEPTION 'Validação inválida alterou assinatura ou histórico.';
  END IF;

  v_invalid := false;
  BEGIN
    PERFORM public.admin_manage_tenant_subscription(
      v_tenant, v_plan_pro, 'active', NULL, NULL, now(), NULL,
      0, NULL, '{"unexpected_limit":1}'::jsonb, 'must not persist', 'invalid override regression'
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    v_invalid := true;
  END;
  IF NOT v_invalid
     OR (SELECT to_jsonb(subscription) FROM public.tenant_subscriptions AS subscription WHERE id = v_subscription.id)
       IS DISTINCT FROM to_jsonb(v_before)
     OR (SELECT count(*) FROM public.subscription_events WHERE subscription_id = v_subscription.id) <> v_event_count
     OR (SELECT count(*) FROM public.audit_logs WHERE tenant_id = v_tenant) <> v_audit_count THEN
    RAISE EXCEPTION 'Override inválido alterou assinatura ou histórico.';
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  SELECT * INTO v_subscription
  FROM public.admin_manage_tenant_subscription(
    v_tenant, v_plan_pro, 'active', NULL, NULL, now(), NULL,
    1000, 'campaign', '{"max_units":4}'::jsonb,
    'approved by QA', 'upgrade and activation regression'
  );
  RESET ROLE;
  IF v_subscription.status <> 'active'
     OR v_subscription.plan_id <> v_plan_pro
     OR v_subscription.discount_cents <> 1000
     OR NOT EXISTS (
       SELECT 1 FROM public.subscription_events
       WHERE subscription_id = v_subscription.id AND event_type = 'activated'
         AND from_status = 'trialing' AND to_status = 'active'
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.subscription_events
       WHERE subscription_id = v_subscription.id AND event_type = 'upgraded'
         AND from_plan_id = v_plan_basic AND to_plan_id = v_plan_pro
     ) THEN
    RAISE EXCEPTION 'Alteração de status/plano não produziu eventos correspondentes.';
  END IF;

  SELECT * INTO v_before FROM public.tenant_subscriptions WHERE id = v_subscription.id;
  SELECT count(*) INTO v_event_count FROM public.subscription_events WHERE subscription_id = v_subscription.id;
  EXECUTE 'SET LOCAL ROLE authenticated';
  BEGIN
    PERFORM public.admin_manage_tenant_subscription(
      v_tenant, v_plan_pro, 'suspended', NULL, NULL, now(), NULL,
      0, NULL, '{}'::jsonb, 'must roll back', 'audit failure rollback regression'
    );
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'qa_admin_subscription_audit_failure' THEN
      v_atomic_rollback := true;
    ELSE
      RAISE;
    END IF;
  END;
  RESET ROLE;
  IF NOT v_atomic_rollback
     OR (SELECT to_jsonb(subscription) FROM public.tenant_subscriptions AS subscription WHERE id = v_subscription.id)
       IS DISTINCT FROM to_jsonb(v_before)
     OR (SELECT count(*) FROM public.subscription_events WHERE subscription_id = v_subscription.id) <> v_event_count THEN
    RAISE EXCEPTION 'Falha ao gravar auditoria deixou mutação ou evento parcial.';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'Atomic admin subscription: grants, super-admin authorization, validation, status/plan events and audit rollback approved.';
END;
$test$;

ROLLBACK;
