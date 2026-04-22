CREATE OR REPLACE FUNCTION public.admin_grant_client_membership(
  _tenant_id uuid,
  _client_id uuid,
  _membership_id uuid,
  _notes text DEFAULT NULL
)
RETURNS public.client_membership_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.memberships;
  v_client public.clients;
  v_sub public.client_membership_subscriptions;
  v_cycle_end timestamptz;
  v_benefit RECORD;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode conceder memberships' USING errcode = '42501';
  END IF;

  SELECT * INTO v_membership FROM public.memberships WHERE id = _membership_id AND tenant_id = _tenant_id;
  IF v_membership.id IS NULL THEN
    RAISE EXCEPTION 'Plano de membership não encontrado neste tenant' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = _client_id AND tenant_id = _tenant_id;
  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Cliente não encontrado neste tenant' USING errcode = 'P0002';
  END IF;

  v_cycle_end := CASE v_membership.billing_cycle
    WHEN 'monthly'   THEN now() + interval '1 month'
    WHEN 'quarterly' THEN now() + interval '3 months'
    WHEN 'yearly'    THEN now() + interval '1 year'
    ELSE now() + interval '1 month'
  END;

  INSERT INTO public.client_membership_subscriptions (
    tenant_id, client_id, membership_id, status,
    started_at, current_cycle_start, current_cycle_end, notes
  ) VALUES (
    _tenant_id, _client_id, _membership_id, 'active',
    now(), now(), v_cycle_end, _notes
  )
  RETURNING * INTO v_sub;

  FOR v_benefit IN
    SELECT b.service_id, b.sessions_per_cycle
    FROM public.membership_benefits b
    WHERE b.membership_id = _membership_id AND b.tenant_id = _tenant_id
  LOOP
    INSERT INTO public.client_membership_balances (
      tenant_id, subscription_id, service_id,
      sessions_total, sessions_used, cycle_start, cycle_end
    ) VALUES (
      _tenant_id, v_sub.id, v_benefit.service_id,
      v_benefit.sessions_per_cycle, 0, now(), v_cycle_end
    );
  END LOOP;

  INSERT INTO public.client_timeline_events (
    tenant_id, client_id, actor_id, event_type, title, description, reference_id, metadata
  ) VALUES (
    _tenant_id, _client_id, auth.uid(),
    'system'::timeline_event_type,
    'Membership concedida via super admin',
    v_membership.name, v_sub.id,
    jsonb_build_object('membership_id', _membership_id, 'price_cents', v_membership.price_cents)
  );

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id, auth.uid(), 'admin.client_membership.granted',
    'client_membership_subscription', v_sub.id,
    jsonb_build_object('client_id', _client_id, 'membership_id', _membership_id, 'membership_name', v_membership.name)
  );

  RETURN v_sub;
END;
$$;