-- RPC para criar assinatura inicial em tenant que ainda não tem nenhuma.
-- Versionamento automático via subscription_events.
CREATE OR REPLACE FUNCTION public.admin_assign_plan_to_tenant(
  _tenant_id uuid,
  _plan_id uuid,
  _start_trial boolean DEFAULT true,
  _notes text DEFAULT NULL
)
RETURNS public.tenant_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.tenant_subscriptions;
  v_plan public.plans;
  v_new public.tenant_subscriptions;
  v_trial_end timestamptz;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode atribuir planos' USING errcode = '42501';
  END IF;

  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id;
  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_existing FROM public.tenant_subscriptions WHERE tenant_id = _tenant_id;

  IF v_existing.id IS NOT NULL THEN
    -- Já tem assinatura: troca o plano e registra evento (upgrade/downgrade)
    UPDATE public.tenant_subscriptions
       SET plan_id = _plan_id,
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_new;

    INSERT INTO public.subscription_events (
      tenant_id, subscription_id, event_type, from_plan_id, to_plan_id, notes
    ) VALUES (
      _tenant_id,
      v_new.id,
      CASE WHEN v_plan.price_cents > (
        SELECT price_cents FROM public.plans WHERE id = v_existing.plan_id
      ) THEN 'upgraded'::subscription_event_type ELSE 'downgraded'::subscription_event_type END,
      v_existing.plan_id,
      _plan_id,
      COALESCE(_notes, 'Plano atribuído via super admin')
    );

    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
      _tenant_id, auth.uid(), 'admin.subscription.plan_changed', 'tenant_subscription', v_new.id,
      jsonb_build_object('from_plan_id', v_existing.plan_id, 'to_plan_id', _plan_id, 'notes', _notes)
    );

    RETURN v_new;
  END IF;

  -- Nova assinatura
  IF _start_trial AND v_plan.trial_days > 0 THEN
    v_trial_end := now() + make_interval(days => v_plan.trial_days);
  END IF;

  INSERT INTO public.tenant_subscriptions (
    tenant_id, plan_id, status,
    trial_started_at, trial_ends_at,
    current_period_start, current_period_end,
    notes
  ) VALUES (
    _tenant_id,
    _plan_id,
    CASE WHEN v_trial_end IS NOT NULL THEN 'trialing'::subscription_status ELSE 'active'::subscription_status END,
    CASE WHEN v_trial_end IS NOT NULL THEN now() ELSE NULL END,
    v_trial_end,
    now(),
    NULL,
    _notes
  )
  RETURNING * INTO v_new;

  INSERT INTO public.subscription_events (
    tenant_id, subscription_id, event_type, to_plan_id, to_status, notes
  ) VALUES (
    _tenant_id, v_new.id, 'created', _plan_id, v_new.status,
    COALESCE(_notes, 'Assinatura criada via super admin')
  );

  IF v_trial_end IS NOT NULL THEN
    INSERT INTO public.subscription_events (
      tenant_id, subscription_id, event_type, to_plan_id, to_status, notes
    ) VALUES (
      _tenant_id, v_new.id, 'trial_started', _plan_id, 'trialing', NULL
    );
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id, auth.uid(), 'admin.subscription.created', 'tenant_subscription', v_new.id,
    jsonb_build_object('plan_id', _plan_id, 'started_trial', _start_trial AND v_trial_end IS NOT NULL)
  );

  RETURN v_new;
END;
$$;