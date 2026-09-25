-- Fix the SECURITY DEFINER audit RPC result shape hardened in 20260925101500.
-- auth.users.email is varchar, while the public RPC contract exposes actor_email as text.

CREATE OR REPLACE FUNCTION public.get_audit_logs_advanced(
  _tenant_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _action_prefix text DEFAULT NULL,
  _entity text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 50,
  _cursor_id uuid DEFAULT NULL,
  _cursor_timestamp timestamptz DEFAULT NULL,
  _sort_order text DEFAULT 'desc'
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
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_is_super_admin boolean := false;
  safe_limit integer := LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
  safe_sort_order text := CASE WHEN pg_catalog.lower(COALESCE(_sort_order, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
  total_rows bigint;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Sem permissão para acessar logs de auditoria'
      USING ERRCODE = '42501';
  END IF;

  requester_is_super_admin := public.is_super_admin(requester_id);

  IF NOT requester_is_super_admin AND (
    _tenant_id IS NULL
    OR NOT public.has_any_tenant_role(
      requester_id,
      _tenant_id,
      ARRAY['owner'::public.app_role, 'manager'::public.app_role]
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para acessar logs de auditoria'
      USING ERRCODE = '42501';
  END IF;

  IF (_cursor_id IS NULL) <> (_cursor_timestamp IS NULL) THEN
    RAISE EXCEPTION 'Cursor de auditoria inválido'
      USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.count(*)
  INTO total_rows
  FROM public.audit_logs al
  WHERE (_tenant_id IS NULL OR al.tenant_id = _tenant_id)
    AND (_actor_id IS NULL OR al.actor_id = _actor_id)
    AND (_action_prefix IS NULL OR al.action ILIKE _action_prefix || '%')
    AND (_entity IS NULL OR al.entity = _entity)
    AND (_from IS NULL OR al.created_at >= _from)
    AND (_to IS NULL OR al.created_at <= _to);

  RETURN QUERY
  SELECT
    al.id,
    al.tenant_id,
    t.name AS tenant_name,
    al.actor_id,
    p.full_name AS actor_name,
    (CASE WHEN requester_is_super_admin THEN au.email ELSE NULL END)::text AS actor_email,
    al.action,
    al.entity,
    al.entity_id,
    public.redact_sensitive_data(al.metadata) AS metadata,
    al.created_at,
    total_rows
  FROM public.audit_logs al
  LEFT JOIN public.tenants t ON t.id = al.tenant_id
  LEFT JOIN public.profiles p ON p.id = al.actor_id
  LEFT JOIN auth.users au ON au.id = al.actor_id
  WHERE (_tenant_id IS NULL OR al.tenant_id = _tenant_id)
    AND (_actor_id IS NULL OR al.actor_id = _actor_id)
    AND (_action_prefix IS NULL OR al.action ILIKE _action_prefix || '%')
    AND (_entity IS NULL OR al.entity = _entity)
    AND (_from IS NULL OR al.created_at >= _from)
    AND (_to IS NULL OR al.created_at <= _to)
    AND (
      _cursor_id IS NULL
      OR CASE
        WHEN safe_sort_order = 'desc' THEN
          (al.created_at < _cursor_timestamp)
          OR (al.created_at = _cursor_timestamp AND al.id < _cursor_id)
        ELSE
          (al.created_at > _cursor_timestamp)
          OR (al.created_at = _cursor_timestamp AND al.id > _cursor_id)
      END
    )
  ORDER BY
    CASE WHEN safe_sort_order = 'asc' THEN al.created_at END ASC,
    CASE WHEN safe_sort_order = 'asc' THEN al.id END ASC,
    CASE WHEN safe_sort_order = 'desc' THEN al.created_at END DESC,
    CASE WHEN safe_sort_order = 'desc' THEN al.id END DESC
  LIMIT safe_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_audit_logs_advanced(
  _tenant_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _action_prefix text DEFAULT NULL,
  _entity text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0,
  _sort_order text DEFAULT 'desc'
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
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  requester_id uuid := auth.uid();
  requester_is_super_admin boolean := false;
  safe_limit integer := LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
  safe_offset integer := GREATEST(COALESCE(_offset, 0), 0);
  safe_sort_order text := CASE WHEN pg_catalog.lower(COALESCE(_sort_order, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
BEGIN
  IF requester_id IS NULL THEN
    RAISE EXCEPTION 'Sem permissão para acessar logs de auditoria'
      USING ERRCODE = '42501';
  END IF;

  requester_is_super_admin := public.is_super_admin(requester_id);

  IF NOT requester_is_super_admin AND (
    _tenant_id IS NULL
    OR NOT public.has_any_tenant_role(
      requester_id,
      _tenant_id,
      ARRAY['owner'::public.app_role, 'manager'::public.app_role]
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para acessar logs de auditoria'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH filtered_logs AS (
    SELECT
      al.id,
      al.tenant_id,
      t.name AS tenant_name,
      al.actor_id,
      p.full_name AS actor_name,
      (CASE WHEN requester_is_super_admin THEN au.email ELSE NULL END)::text AS actor_email,
      al.action,
      al.entity,
      al.entity_id,
      public.redact_sensitive_data(al.metadata) AS metadata,
      al.created_at
    FROM public.audit_logs al
    LEFT JOIN public.tenants t ON t.id = al.tenant_id
    LEFT JOIN public.profiles p ON p.id = al.actor_id
    LEFT JOIN auth.users au ON au.id = al.actor_id
    WHERE (_tenant_id IS NULL OR al.tenant_id = _tenant_id)
      AND (_actor_id IS NULL OR al.actor_id = _actor_id)
      AND (_action_prefix IS NULL OR al.action ILIKE _action_prefix || '%')
      AND (_entity IS NULL OR al.entity = _entity)
      AND (_from IS NULL OR al.created_at >= _from)
      AND (_to IS NULL OR al.created_at <= _to)
  ),
  counted AS (
    SELECT pg_catalog.count(*)::bigint AS total_count FROM filtered_logs
  )
  SELECT
    fl.id,
    fl.tenant_id,
    fl.tenant_name,
    fl.actor_id,
    fl.actor_name,
    fl.actor_email,
    fl.action,
    fl.entity,
    fl.entity_id,
    fl.metadata,
    fl.created_at,
    counted.total_count
  FROM filtered_logs fl
  CROSS JOIN counted
  ORDER BY
    CASE WHEN safe_sort_order = 'asc' THEN fl.created_at END ASC,
    CASE WHEN safe_sort_order = 'asc' THEN fl.id END ASC,
    CASE WHEN safe_sort_order = 'desc' THEN fl.created_at END DESC,
    CASE WHEN safe_sort_order = 'desc' THEN fl.id END DESC
  LIMIT safe_limit
  OFFSET safe_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.get_audit_logs_advanced(
  uuid, uuid, text, text, timestamptz, timestamptz, integer, uuid, timestamptz, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_audit_logs_advanced(
  uuid, uuid, text, text, timestamptz, timestamptz, integer, uuid, timestamptz, text
) TO authenticated;

REVOKE ALL ON FUNCTION public.get_audit_logs_advanced(
  uuid, uuid, text, text, timestamptz, timestamptz, integer, integer, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_audit_logs_advanced(
  uuid, uuid, text, text, timestamptz, timestamptz, integer, integer, text
) TO authenticated;
