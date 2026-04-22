
-- ============================================================================
-- Feature Flags & Limits Management RPCs (Super Admin)
-- ============================================================================

-- 1) Upsert / criar feature flag (global se _tenant_id IS NULL)
CREATE OR REPLACE FUNCTION public.admin_upsert_feature_flag(
  _flag_key text,
  _label text,
  _value jsonb,
  _value_type feature_flag_value_type DEFAULT 'boolean',
  _description text DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_existing public.feature_flags%ROWTYPE;
  v_id uuid;
  v_is_global boolean := (_tenant_id IS NULL);
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode gerenciar feature flags';
  END IF;

  IF _flag_key IS NULL OR length(trim(_flag_key)) = 0 THEN
    RAISE EXCEPTION 'flag_key é obrigatório';
  END IF;

  SELECT * INTO v_existing
  FROM public.feature_flags
  WHERE flag_key = _flag_key
    AND (
      (_tenant_id IS NULL AND tenant_id IS NULL)
      OR (tenant_id = _tenant_id)
    )
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.feature_flags
       SET label = _label,
           value = _value,
           value_type = _value_type,
           description = COALESCE(_description, description),
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, v_caller, 'feature_flag.updated', 'feature_flag', v_id,
            jsonb_build_object(
              'flag_key', _flag_key,
              'is_global', v_is_global,
              'before', to_jsonb(v_existing),
              'after', jsonb_build_object('label', _label, 'value', _value, 'value_type', _value_type)
            ));
  ELSE
    INSERT INTO public.feature_flags (tenant_id, flag_key, label, description, value, value_type, is_global)
    VALUES (_tenant_id, _flag_key, _label, _description, _value, _value_type, v_is_global)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, v_caller, 'feature_flag.created', 'feature_flag', v_id,
            jsonb_build_object(
              'flag_key', _flag_key,
              'is_global', v_is_global,
              'value', _value,
              'value_type', _value_type
            ));
  END IF;

  RETURN v_id;
END;
$$;

-- 2) Alternar boolean de uma flag
CREATE OR REPLACE FUNCTION public.admin_toggle_feature_flag(
  _flag_id uuid,
  _enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_flag public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode alternar feature flags';
  END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE id = _flag_id;
  IF v_flag.id IS NULL THEN
    RAISE EXCEPTION 'Flag não encontrada';
  END IF;

  UPDATE public.feature_flags
     SET value = to_jsonb(_enabled),
         value_type = 'boolean',
         updated_at = now()
   WHERE id = _flag_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_flag.tenant_id, v_caller, 'feature_flag.toggled', 'feature_flag', _flag_id,
          jsonb_build_object(
            'flag_key', v_flag.flag_key,
            'is_global', v_flag.is_global,
            'before', v_flag.value,
            'after', to_jsonb(_enabled)
          ));
END;
$$;

-- 3) Remover feature flag
CREATE OR REPLACE FUNCTION public.admin_delete_feature_flag(_flag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_flag public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode remover feature flags';
  END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE id = _flag_id;
  IF v_flag.id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.feature_flags WHERE id = _flag_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_flag.tenant_id, v_caller, 'feature_flag.deleted', 'feature_flag', _flag_id,
          jsonb_build_object(
            'flag_key', v_flag.flag_key,
            'is_global', v_flag.is_global,
            'value', v_flag.value
          ));
END;
$$;

-- 4) Atualizar limites de um plano
CREATE OR REPLACE FUNCTION public.admin_update_plan_limits(
  _plan_id uuid,
  _max_units integer DEFAULT NULL,
  _max_professionals integer DEFAULT NULL,
  _max_active_clients integer DEFAULT NULL,
  _max_storage_mb integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_before public.plans%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode alterar limites de planos';
  END IF;

  SELECT * INTO v_before FROM public.plans WHERE id = _plan_id;
  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado';
  END IF;

  UPDATE public.plans
     SET max_units = _max_units,
         max_professionals = _max_professionals,
         max_active_clients = _max_active_clients,
         max_storage_mb = _max_storage_mb,
         updated_at = now()
   WHERE id = _plan_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (NULL, v_caller, 'plan.limits_updated', 'plan', _plan_id,
          jsonb_build_object(
            'plan_code', v_before.code,
            'before', jsonb_build_object(
              'max_units', v_before.max_units,
              'max_professionals', v_before.max_professionals,
              'max_active_clients', v_before.max_active_clients,
              'max_storage_mb', v_before.max_storage_mb
            ),
            'after', jsonb_build_object(
              'max_units', _max_units,
              'max_professionals', _max_professionals,
              'max_active_clients', _max_active_clients,
              'max_storage_mb', _max_storage_mb
            )
          ));
END;
$$;

-- 5) Atualizar override de limites por tenant (assinatura)
CREATE OR REPLACE FUNCTION public.admin_update_subscription_overrides(
  _subscription_id uuid,
  _override_limits jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_before public.tenant_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode alterar overrides de assinatura';
  END IF;

  SELECT * INTO v_before FROM public.tenant_subscriptions WHERE id = _subscription_id;
  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'Assinatura não encontrada';
  END IF;

  UPDATE public.tenant_subscriptions
     SET override_limits = COALESCE(_override_limits, '{}'::jsonb),
         updated_at = now()
   WHERE id = _subscription_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_before.tenant_id, v_caller, 'subscription.overrides_updated', 'tenant_subscription', _subscription_id,
          jsonb_build_object(
            'before', v_before.override_limits,
            'after', _override_limits
          ));
END;
$$;

-- 6) Calcular impacto de alteração (quantos tenants/usuários afetados)
CREATE OR REPLACE FUNCTION public.admin_feature_flag_impact(_flag_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_global_count integer;
  v_tenant_count integer;
  v_affected_tenants integer;
  v_affected_users integer;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode consultar impacto';
  END IF;

  SELECT COUNT(*) INTO v_global_count
  FROM public.feature_flags
  WHERE flag_key = _flag_key AND tenant_id IS NULL;

  SELECT COUNT(*) INTO v_tenant_count
  FROM public.feature_flags
  WHERE flag_key = _flag_key AND tenant_id IS NOT NULL;

  -- Tenants ativos (têm assinatura)
  SELECT COUNT(DISTINCT t.id) INTO v_affected_tenants
  FROM public.tenants t
  WHERE EXISTS (SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id = t.id);

  -- Usuários ativos nesses tenants
  SELECT COUNT(DISTINCT tm.user_id) INTO v_affected_users
  FROM public.tenant_memberships tm
  WHERE tm.status = 'active';

  RETURN jsonb_build_object(
    'flag_key', _flag_key,
    'has_global_flag', v_global_count > 0,
    'tenant_overrides_count', v_tenant_count,
    'estimated_affected_tenants', v_affected_tenants,
    'estimated_affected_users', v_affected_users
  );
END;
$$;

-- 7) Calcular impacto de mudança de limite de plano
CREATE OR REPLACE FUNCTION public.admin_plan_limit_impact(_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_subscriptions integer;
  v_active_subs integer;
  v_tenants_with_override integer;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode consultar impacto';
  END IF;

  SELECT COUNT(*) INTO v_subscriptions
  FROM public.tenant_subscriptions WHERE plan_id = _plan_id;

  SELECT COUNT(*) INTO v_active_subs
  FROM public.tenant_subscriptions
  WHERE plan_id = _plan_id AND status IN ('active','trialing');

  SELECT COUNT(*) INTO v_tenants_with_override
  FROM public.tenant_subscriptions
  WHERE plan_id = _plan_id AND override_limits <> '{}'::jsonb;

  RETURN jsonb_build_object(
    'plan_id', _plan_id,
    'total_subscriptions', v_subscriptions,
    'active_or_trial', v_active_subs,
    'tenants_with_override', v_tenants_with_override
  );
END;
$$;
