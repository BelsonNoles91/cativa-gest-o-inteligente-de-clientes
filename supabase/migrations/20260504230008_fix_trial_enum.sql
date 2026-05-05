CREATE OR REPLACE FUNCTION public.start_default_trial(_tenant_id uuid)
RETURNS public.tenant_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.tenant_subscriptions;
  v_plan public.plans;
  v_now timestamptz := now();
  v_trial_end timestamptz;
  v_inserted public.tenant_subscriptions;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_any_tenant_role(v_user, _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para ativar trial neste tenant.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
    FROM public.tenant_subscriptions
   WHERE tenant_id = _tenant_id
   LIMIT 1;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_plan
    FROM public.plans
   WHERE is_default = true AND status = 'public'
   ORDER BY display_order
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_plan
      FROM public.plans
     WHERE status = 'public'
     ORDER BY display_order
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.plans ORDER BY display_order LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum plano disponível para iniciar o trial.' USING ERRCODE = 'P0002';
  END IF;

  -- Se o plano é gratuito (Apoio, price <= 0), não entra em trial.
  IF v_plan.price_cents <= 0 THEN
    INSERT INTO public.tenant_subscriptions (
      tenant_id,
      plan_id,
      status,
      trial_started_at,
      trial_ends_at,
      current_period_start,
      current_period_end
    )
    VALUES (
      _tenant_id,
      v_plan.id,
      'active',
      NULL,
      NULL,
      v_now,
      CASE 
        WHEN v_plan.billing_period = 'annual' THEN v_now + '1 year'::interval
        ELSE v_now + '1 month'::interval
      END
    )
    RETURNING * INTO v_inserted;

    BEGIN
      INSERT INTO public.subscription_events (
        tenant_id, subscription_id, event_type, to_status, to_plan_id, notes
      ) VALUES (
        _tenant_id,
        v_inserted.id,
        'subscription_started',
        'active',
        v_plan.id,
        'Assinatura gratuita ativada sem período de trial.'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

  ELSE
    -- Planos pagos entram em Trialing
    v_trial_end := v_now + (COALESCE(v_plan.trial_days, 14) || ' days')::interval;
    
    INSERT INTO public.tenant_subscriptions (
      tenant_id,
      plan_id,
      status,
      trial_started_at,
      trial_ends_at,
      current_period_start,
      current_period_end
    )
    VALUES (
      _tenant_id,
      v_plan.id,
      'trialing',
      v_now,
      v_trial_end,
      v_now,
      v_trial_end
    )
    RETURNING * INTO v_inserted;

    BEGIN
      INSERT INTO public.subscription_events (
        tenant_id, subscription_id, event_type, to_status, to_plan_id, notes
      ) VALUES (
        _tenant_id,
        v_inserted.id,
        'trial_started',
        'trialing',
        v_plan.id,
        'Trial padrão de ' || COALESCE(v_plan.trial_days, 14) || ' dias iniciado pelo próprio tenant.'
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN v_inserted;
END;
$$;
