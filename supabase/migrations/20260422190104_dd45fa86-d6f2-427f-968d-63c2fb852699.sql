-- =====================================================================
-- Super Admin: provisionar usuários (convite) + gerenciar memberships
-- de clientes (pacotes e assinaturas recorrentes) em qualquer tenant.
-- Tudo com SECURITY DEFINER + auditoria em audit_logs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Provisionar usuário em qualquer tenant via convite (token)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_provision_team_invitation(
  _tenant_id uuid,
  _email text,
  _role app_role,
  _message text DEFAULT NULL,
  _expires_in_days integer DEFAULT 14
)
RETURNS public.team_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_invite public.team_invitations;
  v_existing public.team_invitations;
  v_tenant public.tenants;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode provisionar usuários' USING errcode = '42501';
  END IF;

  IF v_email IS NULL OR v_email !~ '^.+@.+\..+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING errcode = '22023';
  END IF;

  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel inválido para convite de equipe' USING errcode = '22023';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING errcode = 'P0002';
  END IF;

  -- Reaproveita convite pendente em vez de duplicar
  SELECT * INTO v_existing
    FROM public.team_invitations
   WHERE tenant_id = _tenant_id AND lower(email) = v_email AND status = 'pending'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.team_invitations
       SET role = _role,
           message = COALESCE(_message, message),
           expires_at = now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_invite;
  ELSE
    INSERT INTO public.team_invitations (
      tenant_id, email, role, invited_by, message, expires_at
    ) VALUES (
      _tenant_id, v_email, _role, auth.uid(), _message,
      now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1))
    )
    RETURNING * INTO v_invite;
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id, auth.uid(),
    'admin.team.invitation_created',
    'team_invitation', v_invite.id,
    jsonb_build_object('email', v_email, 'role', _role, 'reused', v_existing.id IS NOT NULL)
  );

  RETURN v_invite;
END;
$$;

-- ---------------------------------------------------------------------
-- 2) Listar convites pendentes de um tenant (para o painel)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_team_invitations(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  tenant_name text,
  email text,
  role app_role,
  status text,
  token text,
  invited_by uuid,
  inviter_name text,
  message text,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.tenant_id,
    t.name,
    i.email,
    i.role,
    i.status::text,
    i.token,
    i.invited_by,
    p.full_name,
    i.message,
    i.expires_at,
    i.created_at,
    i.updated_at
  FROM public.team_invitations i
  LEFT JOIN public.tenants t ON t.id = i.tenant_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE public.is_super_admin(auth.uid())
    AND (_tenant_id IS NULL OR i.tenant_id = _tenant_id)
  ORDER BY i.created_at DESC;
$$;

-- ---------------------------------------------------------------------
-- 3) Listar memberships (planos recorrentes) por tenant
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_client_memberships(_tenant_id uuid)
RETURNS TABLE(
  subscription_id uuid,
  tenant_id uuid,
  client_id uuid,
  client_name text,
  client_email text,
  membership_id uuid,
  membership_name text,
  billing_cycle membership_billing_cycle,
  price_cents integer,
  status client_subscription_status,
  started_at timestamptz,
  current_cycle_start timestamptz,
  current_cycle_end timestamptz,
  canceled_at timestamptz,
  notes text,
  total_sessions_total integer,
  total_sessions_used integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.tenant_id,
    s.client_id,
    c.full_name,
    c.email,
    m.id,
    m.name,
    m.billing_cycle,
    m.price_cents,
    s.status,
    s.started_at,
    s.current_cycle_start,
    s.current_cycle_end,
    s.canceled_at,
    s.notes,
    COALESCE((SELECT SUM(b.sessions_total)::int FROM public.client_membership_balances b WHERE b.subscription_id = s.id), 0),
    COALESCE((SELECT SUM(b.sessions_used)::int  FROM public.client_membership_balances b WHERE b.subscription_id = s.id), 0)
  FROM public.client_membership_subscriptions s
  JOIN public.clients c     ON c.id = s.client_id
  JOIN public.memberships m ON m.id = s.membership_id
  WHERE public.is_super_admin(auth.uid())
    AND s.tenant_id = _tenant_id
  ORDER BY s.status, c.full_name;
$$;

-- ---------------------------------------------------------------------
-- 4) Conceder membership a cliente (com ciclo + saldos por benefício)
-- ---------------------------------------------------------------------
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
    WHEN 'biannual'  THEN now() + interval '6 months'
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

  -- Cria saldo por benefício
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

  -- Timeline + audit
  INSERT INTO public.client_timeline_events (
    tenant_id, client_id, actor_id, event_type, title, description, reference_id, metadata
  ) VALUES (
    _tenant_id, _client_id, auth.uid(),
    'membership_started'::timeline_event_type,
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

-- ---------------------------------------------------------------------
-- 5) Cancelar membership do cliente (mantém histórico)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_cancel_client_membership(
  _subscription_id uuid,
  _reason text DEFAULT NULL
)
RETURNS public.client_membership_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.client_membership_subscriptions;
  v_new public.client_membership_subscriptions;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode cancelar memberships' USING errcode = '42501';
  END IF;

  SELECT * INTO v_old FROM public.client_membership_subscriptions WHERE id = _subscription_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Assinatura não encontrada' USING errcode = 'P0002';
  END IF;

  UPDATE public.client_membership_subscriptions
     SET status = 'canceled'::client_subscription_status,
         canceled_at = now(),
         notes = COALESCE(_reason, notes),
         updated_at = now()
   WHERE id = _subscription_id
   RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_new.tenant_id, auth.uid(), 'admin.client_membership.canceled',
    'client_membership_subscription', v_new.id,
    jsonb_build_object('client_id', v_new.client_id, 'reason', _reason)
  );

  RETURN v_new;
END;
$$;

-- ---------------------------------------------------------------------
-- 6) Reativar membership cancelada
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reactivate_client_membership(
  _subscription_id uuid
)
RETURNS public.client_membership_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new public.client_membership_subscriptions;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode reativar memberships' USING errcode = '42501';
  END IF;

  UPDATE public.client_membership_subscriptions
     SET status = 'active'::client_subscription_status,
         canceled_at = NULL,
         updated_at = now()
   WHERE id = _subscription_id
   RETURNING * INTO v_new;

  IF v_new.id IS NULL THEN
    RAISE EXCEPTION 'Assinatura não encontrada' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_new.tenant_id, auth.uid(), 'admin.client_membership.reactivated',
    'client_membership_subscription', v_new.id,
    jsonb_build_object('client_id', v_new.client_id)
  );

  RETURN v_new;
END;
$$;

-- ---------------------------------------------------------------------
-- 7) Snapshot leve para popular o painel (clientes + memberships do tenant)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_tenant_membership_dashboard(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clients jsonb;
  v_memberships jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin' USING errcode = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name, 'email', email)
                            ORDER BY full_name), '[]'::jsonb)
    INTO v_clients
    FROM public.clients
   WHERE tenant_id = _tenant_id AND status = 'active'::client_status;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', id, 'name', name, 'billing_cycle', billing_cycle,
            'price_cents', price_cents, 'is_active', is_active
          ) ORDER BY name), '[]'::jsonb)
    INTO v_memberships
    FROM public.memberships
   WHERE tenant_id = _tenant_id;

  RETURN jsonb_build_object('clients', v_clients, 'memberships', v_memberships);
END;
$$;
