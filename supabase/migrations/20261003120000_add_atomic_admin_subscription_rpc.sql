-- Keep administrative subscription changes and their audit trail atomic.
-- The client invokes this RPC from the super-admin subscription editor.
CREATE OR REPLACE FUNCTION public.admin_manage_tenant_subscription(
  _tenant_id uuid,
  _plan_id uuid,
  _status public.subscription_status,
  _trial_started_at timestamptz,
  _trial_ends_at timestamptz,
  _current_period_start timestamptz,
  _current_period_end timestamptz,
  _discount_cents integer,
  _discount_reason text,
  _override_limits jsonb,
  _notes text,
  _reason text
)
RETURNS public.tenant_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_actor_id uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_before public.tenant_subscriptions%ROWTYPE;
  v_after public.tenant_subscriptions%ROWTYPE;
  v_old_plan_price integer;
  v_limit_key text;
  v_limit_value jsonb;
  v_limit_number numeric;
  v_now timestamptz := clock_timestamp();
  v_event_notes text;
  v_metadata jsonb;
  v_event_written boolean := false;
BEGIN
  IF v_actor_id IS NULL OR NOT public.is_super_admin(v_actor_id) THEN
    RAISE EXCEPTION 'Apenas super_admin pode gerenciar assinaturas.'
      USING ERRCODE = '42501';
  END IF;

  IF _tenant_id IS NULL OR _plan_id IS NULL OR _status IS NULL THEN
    RAISE EXCEPTION 'Tenant, plano e status são obrigatórios.'
      USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(_reason), '') IS NULL OR length(btrim(_reason)) > 500 THEN
    RAISE EXCEPTION 'Informe um motivo com até 500 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF _notes IS NOT NULL AND length(_notes) > 4000 THEN
    RAISE EXCEPTION 'As observações não podem exceder 4000 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF _discount_reason IS NOT NULL AND length(_discount_reason) > 500 THEN
    RAISE EXCEPTION 'O motivo do desconto não pode exceder 500 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF _current_period_start IS NULL
     OR (_current_period_end IS NOT NULL AND _current_period_end <= _current_period_start) THEN
    RAISE EXCEPTION 'O período da assinatura precisa ter datas válidas.'
      USING ERRCODE = '22023';
  END IF;
  IF _status = 'trialing'
     AND (_trial_started_at IS NULL OR _trial_ends_at IS NULL OR _trial_ends_at <= _trial_started_at) THEN
    RAISE EXCEPTION 'O trial precisa ter início e término válidos.'
      USING ERRCODE = '22023';
  END IF;
  IF _discount_cents IS NULL OR _discount_cents < 0 THEN
    RAISE EXCEPTION 'O desconto deve ser um valor não negativo.'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(_override_limits) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Os limites personalizados devem ser um objeto JSON válido.'
      USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(_override_limits)) > 5 THEN
    RAISE EXCEPTION 'Os limites personalizados devem ser um objeto JSON válido.'
      USING ERRCODE = '22023';
  END IF;

  FOR v_limit_key, v_limit_value IN
    SELECT entry.key, entry.value FROM jsonb_each(_override_limits) AS entry
  LOOP
    IF v_limit_key NOT IN (
      'max_units', 'max_professionals', 'max_active_clients',
      'max_storage_mb', 'max_appointments_month'
    ) THEN
      RAISE EXCEPTION 'Limite personalizado não permitido: %.', v_limit_key
        USING ERRCODE = '22023';
    END IF;
    IF v_limit_value <> 'null'::jsonb THEN
      IF jsonb_typeof(v_limit_value) IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'O limite % precisa ser inteiro não negativo ou null.', v_limit_key
          USING ERRCODE = '22023';
      END IF;
      v_limit_number := (v_limit_value #>> '{}')::numeric;
      IF v_limit_number < 0 OR v_limit_number > 2147483647
         OR trunc(v_limit_number) <> v_limit_number THEN
        RAISE EXCEPTION 'O limite % precisa ser inteiro não negativo ou null.', v_limit_key
          USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  -- Serialize administration against this tenant, including first-time
  -- subscription creation where there is not yet a subscription row to lock.
  PERFORM 1 FROM public.tenants AS tenant
  WHERE tenant.id = _tenant_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenant não encontrado.' USING ERRCODE = '23503';
  END IF;

  SELECT * INTO v_plan
  FROM public.plans AS plan
  WHERE plan.id = _plan_id AND plan.status <> 'archived'
  FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano inexistente ou arquivado.' USING ERRCODE = '22023';
  END IF;
  IF _discount_cents > v_plan.price_cents THEN
    RAISE EXCEPTION 'O desconto não pode superar o valor do plano.'
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_before
  FROM public.tenant_subscriptions AS subscription
  WHERE subscription.tenant_id = _tenant_id
  FOR UPDATE;

  v_event_notes := concat_ws(
    E'\n', nullif(btrim(_reason), ''), nullif(btrim(_notes), '')
  );

  IF v_before.id IS NULL THEN
    INSERT INTO public.tenant_subscriptions (
      tenant_id, plan_id, status, trial_started_at, trial_ends_at,
      current_period_start, current_period_end, canceled_at, suspended_at,
      overdue_since, discount_cents, discount_reason, override_limits, notes
    ) VALUES (
      _tenant_id, _plan_id, _status, _trial_started_at, _trial_ends_at,
      _current_period_start, _current_period_end,
      CASE WHEN _status = 'canceled' THEN v_now END,
      CASE WHEN _status = 'suspended' THEN v_now END,
      CASE WHEN _status = 'overdue' THEN v_now END,
      _discount_cents, nullif(btrim(_discount_reason), ''), _override_limits,
      nullif(btrim(_notes), '')
    ) RETURNING * INTO v_after;

    v_metadata := jsonb_build_object(
      'reason', btrim(_reason), 'before', NULL, 'after', to_jsonb(v_after)
    );
    INSERT INTO public.subscription_events (
      tenant_id, subscription_id, event_type, to_plan_id, to_status,
      actor_id, notes, metadata
    ) VALUES (
      _tenant_id, v_after.id, 'created', _plan_id, _status,
      v_actor_id, v_event_notes, v_metadata
    );
    v_event_written := true;
  ELSE
    SELECT plan.price_cents INTO v_old_plan_price
    FROM public.plans AS plan WHERE plan.id = v_before.plan_id;

    UPDATE public.tenant_subscriptions AS subscription
    SET plan_id = _plan_id,
        status = _status,
        trial_started_at = _trial_started_at,
        trial_ends_at = _trial_ends_at,
        current_period_start = _current_period_start,
        current_period_end = _current_period_end,
        canceled_at = CASE
          WHEN _status = 'canceled' THEN coalesce(v_before.canceled_at, v_now)
          ELSE NULL
        END,
        suspended_at = CASE
          WHEN _status = 'suspended' THEN coalesce(v_before.suspended_at, v_now)
          ELSE NULL
        END,
        overdue_since = CASE
          WHEN _status = 'overdue' THEN coalesce(v_before.overdue_since, v_now)
          ELSE NULL
        END,
        discount_cents = _discount_cents,
        discount_reason = nullif(btrim(_discount_reason), ''),
        override_limits = _override_limits,
        notes = nullif(btrim(_notes), '')
    WHERE subscription.id = v_before.id
    RETURNING * INTO v_after;

    v_metadata := jsonb_build_object(
      'reason', btrim(_reason), 'before', to_jsonb(v_before), 'after', to_jsonb(v_after)
    );

    IF v_before.status IS DISTINCT FROM v_after.status THEN
      INSERT INTO public.subscription_events (
        tenant_id, subscription_id, event_type, from_status, to_status,
        from_plan_id, to_plan_id, actor_id, notes, metadata
      ) VALUES (
        _tenant_id, v_after.id,
        CASE v_after.status
          WHEN 'trialing' THEN 'trial_started'::public.subscription_event_type
          WHEN 'active' THEN CASE
            WHEN v_before.status = 'suspended' THEN 'reactivated'::public.subscription_event_type
            ELSE 'activated'::public.subscription_event_type
          END
          WHEN 'overdue' THEN 'overdue'::public.subscription_event_type
          WHEN 'suspended' THEN 'suspended'::public.subscription_event_type
          WHEN 'canceled' THEN 'canceled'::public.subscription_event_type
        END,
        v_before.status, v_after.status,
        v_before.plan_id, v_after.plan_id, v_actor_id, v_event_notes, v_metadata
      );
      v_event_written := true;
    END IF;

    IF v_before.plan_id IS DISTINCT FROM v_after.plan_id THEN
      INSERT INTO public.subscription_events (
        tenant_id, subscription_id, event_type, from_plan_id, to_plan_id,
        from_status, to_status, actor_id, notes, metadata
      ) VALUES (
        _tenant_id, v_after.id,
        CASE
          WHEN v_plan.price_cents > coalesce(v_old_plan_price, 0)
            THEN 'upgraded'::public.subscription_event_type
          WHEN v_plan.price_cents < coalesce(v_old_plan_price, 0)
            THEN 'downgraded'::public.subscription_event_type
          ELSE 'note'::public.subscription_event_type
        END,
        v_before.plan_id, v_after.plan_id, v_before.status, v_after.status,
        v_actor_id, v_event_notes, v_metadata
      );
      v_event_written := true;
    END IF;

    IF v_before.status = 'trialing' AND v_after.status = 'trialing'
       AND v_after.trial_ends_at > v_before.trial_ends_at THEN
      INSERT INTO public.subscription_events (
        tenant_id, subscription_id, event_type, from_status, to_status,
        from_plan_id, to_plan_id, actor_id, notes, metadata
      ) VALUES (
        _tenant_id, v_after.id, 'trial_extended', v_before.status, v_after.status,
        v_before.plan_id, v_after.plan_id, v_actor_id, v_event_notes, v_metadata
      );
      v_event_written := true;
    END IF;

    IF NOT v_event_written THEN
      INSERT INTO public.subscription_events (
        tenant_id, subscription_id, event_type, from_status, to_status,
        from_plan_id, to_plan_id, actor_id, notes, metadata
      ) VALUES (
        _tenant_id, v_after.id, 'note', v_before.status, v_after.status,
        v_before.plan_id, v_after.plan_id, v_actor_id, v_event_notes, v_metadata
      );
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    tenant_id, actor_id, action, entity, entity_id, metadata
  ) VALUES (
    _tenant_id,
    v_actor_id,
    CASE WHEN v_before.id IS NULL THEN 'subscription.created' ELSE 'subscription.updated' END,
    'tenant_subscription',
    v_after.id,
    v_metadata
  );

  RETURN v_after;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_manage_tenant_subscription(
  uuid, uuid, public.subscription_status, timestamptz, timestamptz,
  timestamptz, timestamptz, integer, text, jsonb, text, text
) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_manage_tenant_subscription(
  uuid, uuid, public.subscription_status, timestamptz, timestamptz,
  timestamptz, timestamptz, integer, text, jsonb, text, text
) TO authenticated;
