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
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_before public.tenant_subscriptions;
  v_after public.tenant_subscriptions;
  v_plan public.plans;
  v_event public.subscription_event_type := 'note';
  v_allowed_keys text[] := ARRAY['max_units','max_professionals','max_active_clients','max_storage_mb','max_appointments_month'];
  v_key text;
  v_value jsonb;
BEGIN
  IF v_actor IS NULL OR NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas super administrador pode gerenciar assinaturas' USING errcode = '42501';
  END IF;

  IF NULLIF(btrim(COALESCE(_reason, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Informe o motivo da alteração' USING errcode = '22023';
  END IF;

  PERFORM 1 FROM public.tenants WHERE id = _tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estabelecimento não encontrado' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id AND status <> 'archived';
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Plano inexistente ou arquivado' USING errcode = '22023';
  END IF;

  IF COALESCE(_discount_cents, 0) < 0 THEN
    RAISE EXCEPTION 'O desconto não pode ser negativo' USING errcode = '22023';
  END IF;
  IF COALESCE(_discount_cents, 0) > v_plan.price_cents THEN
    RAISE EXCEPTION 'O desconto não pode superar o valor do plano' USING errcode = '22023';
  END IF;
  IF _current_period_start IS NULL THEN
    RAISE EXCEPTION 'A data inicial do ciclo é obrigatória' USING errcode = '22023';
  END IF;
  IF _current_period_end IS NOT NULL AND _current_period_end <= _current_period_start THEN
    RAISE EXCEPTION 'A renovação deve ser posterior ao início do ciclo' USING errcode = '22023';
  END IF;
  IF _trial_ends_at IS NOT NULL AND _trial_started_at IS NOT NULL AND _trial_ends_at <= _trial_started_at THEN
    RAISE EXCEPTION 'O fim do teste deve ser posterior ao início' USING errcode = '22023';
  END IF;
  IF _status = 'trialing' AND _trial_ends_at IS NULL THEN
    RAISE EXCEPTION 'Assinatura em teste precisa ter uma data final' USING errcode = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(_override_limits, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'Limites personalizados inválidos' USING errcode = '22023';
  END IF;

  FOR v_key, v_value IN SELECT key, value FROM jsonb_each(COALESCE(_override_limits, '{}'::jsonb)) LOOP
    IF NOT (v_key = ANY(v_allowed_keys)) THEN
      RAISE EXCEPTION 'Limite personalizado desconhecido: %', v_key USING errcode = '22023';
    END IF;
    IF jsonb_typeof(v_value) <> 'number' OR (v_value #>> '{}')::numeric < 0 OR (v_value #>> '{}')::numeric <> trunc((v_value #>> '{}')::numeric) THEN
      RAISE EXCEPTION 'O limite % deve ser um número inteiro não negativo', v_key USING errcode = '22023';
    END IF;
  END LOOP;

  SELECT * INTO v_before FROM public.tenant_subscriptions WHERE tenant_id = _tenant_id FOR UPDATE;

  IF v_before.id IS NULL THEN
    INSERT INTO public.tenant_subscriptions (
      tenant_id, plan_id, status, trial_started_at, trial_ends_at,
      current_period_start, current_period_end, canceled_at, suspended_at,
      overdue_since, discount_cents, discount_reason, override_limits, notes
    ) VALUES (
      _tenant_id, _plan_id, _status, _trial_started_at, _trial_ends_at,
      _current_period_start, _current_period_end,
      CASE WHEN _status = 'canceled' THEN now() END,
      CASE WHEN _status = 'suspended' THEN now() END,
      CASE WHEN _status = 'overdue' THEN now() END,
      COALESCE(_discount_cents, 0), NULLIF(btrim(COALESCE(_discount_reason, '')), ''),
      COALESCE(_override_limits, '{}'::jsonb), NULLIF(btrim(COALESCE(_notes, '')), '')
    ) RETURNING * INTO v_after;
    v_event := 'created';
  ELSE
    IF v_before.plan_id <> _plan_id THEN
      IF v_plan.price_cents >= (SELECT price_cents FROM public.plans WHERE id = v_before.plan_id) THEN
        v_event := 'upgraded';
      ELSE
        v_event := 'downgraded';
      END IF;
    ELSIF v_before.status IS DISTINCT FROM _status THEN
      v_event := CASE _status
        WHEN 'active' THEN CASE WHEN v_before.status = 'suspended' THEN 'reactivated'::public.subscription_event_type ELSE 'activated'::public.subscription_event_type END
        WHEN 'overdue' THEN 'overdue'::public.subscription_event_type
        WHEN 'suspended' THEN 'suspended'::public.subscription_event_type
        WHEN 'canceled' THEN 'canceled'::public.subscription_event_type
        ELSE 'trial_started'::public.subscription_event_type
      END;
    ELSIF v_before.trial_ends_at IS DISTINCT FROM _trial_ends_at THEN
      v_event := 'trial_extended';
    END IF;

    UPDATE public.tenant_subscriptions
    SET plan_id = _plan_id,
        status = _status,
        trial_started_at = _trial_started_at,
        trial_ends_at = _trial_ends_at,
        current_period_start = _current_period_start,
        current_period_end = _current_period_end,
        canceled_at = CASE WHEN _status = 'canceled' THEN COALESCE(v_before.canceled_at, now()) ELSE NULL END,
        suspended_at = CASE WHEN _status = 'suspended' THEN COALESCE(v_before.suspended_at, now()) ELSE NULL END,
        overdue_since = CASE WHEN _status = 'overdue' THEN COALESCE(v_before.overdue_since, now()) ELSE NULL END,
        discount_cents = COALESCE(_discount_cents, 0),
        discount_reason = NULLIF(btrim(COALESCE(_discount_reason, '')), ''),
        override_limits = COALESCE(_override_limits, '{}'::jsonb),
        notes = NULLIF(btrim(COALESCE(_notes, '')), ''),
        updated_at = now()
    WHERE id = v_before.id
    RETURNING * INTO v_after;
  END IF;

  INSERT INTO public.subscription_events (
    tenant_id, subscription_id, event_type, from_plan_id, to_plan_id,
    from_status, to_status, actor_id, notes, metadata
  ) VALUES (
    _tenant_id, v_after.id, v_event,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE v_before.plan_id END,
    v_after.plan_id,
    CASE WHEN v_before.id IS NULL THEN NULL ELSE v_before.status END,
    v_after.status,
    v_actor,
    btrim(_reason),
    jsonb_build_object(
      'before', CASE WHEN v_before.id IS NULL THEN NULL ELSE to_jsonb(v_before) - 'id' - 'tenant_id' END,
      'after', to_jsonb(v_after) - 'id' - 'tenant_id'
    )
  );

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id, v_actor,
    CASE WHEN v_before.id IS NULL THEN 'admin.subscription.created' ELSE 'admin.subscription.updated' END,
    'tenant_subscription', v_after.id,
    jsonb_build_object('reason', btrim(_reason), 'event_type', v_event,
      'before', CASE WHEN v_before.id IS NULL THEN NULL ELSE to_jsonb(v_before) - 'id' - 'tenant_id' END,
      'after', to_jsonb(v_after) - 'id' - 'tenant_id')
  );

  RETURN v_after;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_tenant_subscription(uuid, uuid, public.subscription_status, timestamptz, timestamptz, timestamptz, timestamptz, integer, text, jsonb, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_manage_tenant_subscription(uuid, uuid, public.subscription_status, timestamptz, timestamptz, timestamptz, timestamptz, integer, text, jsonb, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_tenant_subscription(uuid, uuid, public.subscription_status, timestamptz, timestamptz, timestamptz, timestamptz, integer, text, jsonb, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_tenant_subscription(uuid, uuid, public.subscription_status, timestamptz, timestamptz, timestamptz, timestamptz, integer, text, jsonb, text, text) TO service_role;