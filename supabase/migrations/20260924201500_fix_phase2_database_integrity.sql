-- Fase 2 da auditoria pre-producao: corrige inconsistencias funcionais
-- detectadas pelo plpgsql_check no banco remoto.

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
    SELECT * INTO v_plan
      FROM public.plans
     ORDER BY display_order
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum plano disponível para iniciar o trial.' USING ERRCODE = 'P0002';
  END IF;

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

    INSERT INTO public.subscription_events (
      tenant_id, subscription_id, event_type, to_status, to_plan_id, notes
    ) VALUES (
      _tenant_id,
      v_inserted.id,
      'activated',
      'active',
      v_plan.id,
      'Assinatura gratuita ativada sem período de trial.'
    );
  ELSE
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
  END IF;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.start_specific_trial(_tenant_id uuid, _plan_id uuid)
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
   WHERE id = _plan_id AND status = 'public'
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plano selecionado não é válido ou não está disponível.' USING ERRCODE = 'P0002';
  END IF;

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

    INSERT INTO public.subscription_events (
      tenant_id, subscription_id, event_type, to_status, to_plan_id, notes
    ) VALUES (
      _tenant_id,
      v_inserted.id,
      'activated',
      'active',
      v_plan.id,
      'Assinatura gratuita ativada sem período de trial.'
    );
  ELSE
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

    INSERT INTO public.subscription_events (
      tenant_id, subscription_id, event_type, to_status, to_plan_id, notes
    ) VALUES (
      _tenant_id,
      v_inserted.id,
      'trial_started',
      'trialing',
      v_plan.id,
      'Trial de ' || COALESCE(v_plan.trial_days, 14) || ' dias iniciado pelo próprio tenant.'
    );
  END IF;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_force_reset_password(target_user_id uuid, new_raw_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas Super Admins.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_raw_password, extensions.gen_salt('bf')),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"force_password_reset": true}'::jsonb
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_change_password_with_history(new_raw_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_history_record record;
  v_is_reused boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  FOR v_history_record IN
    SELECT password_hash
      FROM public.password_history
     WHERE user_id = v_uid
     ORDER BY created_at DESC
     LIMIT 5
  LOOP
    IF v_history_record.password_hash = extensions.crypt(new_raw_password, v_history_record.password_hash) THEN
      v_is_reused := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_is_reused THEN
    RAISE EXCEPTION 'REUSED_PASSWORD';
  END IF;

  INSERT INTO public.password_history (user_id, password_hash)
  VALUES (v_uid, extensions.crypt(new_raw_password, extensions.gen_salt('bf')));

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_raw_password, extensions.gen_salt('bf')),
      raw_app_meta_data = raw_app_meta_data - 'force_password_reset'
  WHERE id = v_uid;
END;
$$;
