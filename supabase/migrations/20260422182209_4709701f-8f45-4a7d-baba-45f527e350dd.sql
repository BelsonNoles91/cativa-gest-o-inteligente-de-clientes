-- 1) Lista global de tenants (com contagens) para super admin
CREATE OR REPLACE FUNCTION public.admin_list_all_tenants()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  segment public.tenant_segment,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint,
  unit_count bigint,
  client_count bigint,
  subscription_status public.subscription_status,
  plan_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.slug,
    t.segment,
    t.created_at,
    t.updated_at,
    (SELECT count(*) FROM public.tenant_memberships m WHERE m.tenant_id = t.id AND m.status = 'active') AS member_count,
    (SELECT count(*) FROM public.units u WHERE u.tenant_id = t.id) AS unit_count,
    (SELECT count(*) FROM public.clients c WHERE c.tenant_id = t.id) AS client_count,
    s.status,
    p.name
  FROM public.tenants t
  LEFT JOIN public.tenant_subscriptions s ON s.tenant_id = t.id
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY t.name NULLS LAST;
$$;

-- 2) Auditoria global navegável
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(
  _tenant_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _action_prefix text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  tenant_name text,
  actor_id uuid,
  actor_name text,
  actor_email text,
  action text,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.tenant_id,
    t.name,
    a.actor_id,
    p.full_name,
    u.email::text,
    a.action,
    a.entity,
    a.entity_id,
    a.metadata,
    a.created_at
  FROM public.audit_logs a
  LEFT JOIN public.tenants t ON t.id = a.tenant_id
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  LEFT JOIN auth.users u ON u.id = a.actor_id
  WHERE public.is_super_admin(auth.uid())
    AND (_tenant_id IS NULL OR a.tenant_id = _tenant_id)
    AND (_actor_id IS NULL OR a.actor_id = _actor_id)
    AND (_action_prefix IS NULL OR a.action ILIKE (_action_prefix || '%'))
    AND (_from IS NULL OR a.created_at >= _from)
    AND (_to IS NULL OR a.created_at <= _to)
  ORDER BY a.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 200), 1000), 1);
$$;

-- 3) Impersonação: log de início e fim
CREATE OR REPLACE FUNCTION public.admin_log_impersonation_start(
  _tenant_id uuid,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_tenant public.tenants;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode impersonar tenants' USING errcode = '42501';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id,
    auth.uid(),
    'admin.impersonation.started',
    'tenant',
    _tenant_id,
    jsonb_build_object('tenant_name', v_tenant.name, 'reason', _reason)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_log_impersonation_end(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode encerrar impersonação' USING errcode = '42501';
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id,
    auth.uid(),
    'admin.impersonation.ended',
    'tenant',
    _tenant_id,
    jsonb_build_object()
  );
END;
$$;

-- 4) Editar tenant (nome, slug, segmento) — somente super admin
CREATE OR REPLACE FUNCTION public.admin_update_tenant(
  _tenant_id uuid,
  _name text DEFAULT NULL,
  _slug text DEFAULT NULL,
  _segment public.tenant_segment DEFAULT NULL
)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.tenants;
  v_new public.tenants;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode editar tenants' USING errcode = '42501';
  END IF;

  SELECT * INTO v_old FROM public.tenants WHERE id = _tenant_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING errcode = 'P0002';
  END IF;

  UPDATE public.tenants
     SET name = COALESCE(_name, name),
         slug = COALESCE(_slug, slug),
         segment = COALESCE(_segment, segment),
         updated_at = now()
   WHERE id = _tenant_id
   RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id,
    auth.uid(),
    'admin.tenant.updated',
    'tenant',
    _tenant_id,
    jsonb_build_object(
      'from', jsonb_build_object('name', v_old.name, 'slug', v_old.slug, 'segment', v_old.segment),
      'to',   jsonb_build_object('name', v_new.name, 'slug', v_new.slug, 'segment', v_new.segment)
    )
  );

  RETURN v_new;
END;
$$;