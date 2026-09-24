CREATE OR REPLACE FUNCTION public.get_audit_logs_advanced(_tenant_id uuid DEFAULT NULL::uuid, _actor_id uuid DEFAULT NULL::uuid, _action_prefix text DEFAULT NULL::text, _entity text DEFAULT NULL::text, _from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone, _limit integer DEFAULT 50, _cursor_id uuid DEFAULT NULL::uuid, _cursor_timestamp timestamp with time zone DEFAULT NULL::timestamp with time zone, _sort_order text DEFAULT 'desc'::text)
 RETURNS TABLE(id uuid, tenant_id uuid, tenant_name text, actor_id uuid, actor_name text, actor_email text, action text, entity text, entity_id uuid, metadata jsonb, created_at timestamp with time zone, total_count bigint)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _total_count bigint;
  _is_sa boolean := public.is_super_admin(auth.uid());
  _lim int := GREATEST(LEAST(COALESCE(_limit, 50), 1000), 1);
BEGIN
  IF NOT (_is_sa OR (_tenant_id IS NOT NULL AND public.has_any_tenant_role(auth.uid(), _tenant_id, ARRAY['owner','manager']::app_role[]))) THEN
    RAISE EXCEPTION 'Sem permissão para acessar logs de auditoria' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO _total_count FROM public.audit_logs al
  WHERE (_tenant_id IS NULL OR al.tenant_id = _tenant_id)
    AND (_actor_id IS NULL OR al.actor_id = _actor_id)
    AND (_action_prefix IS NULL OR al.action LIKE _action_prefix || '%')
    AND (_entity IS NULL OR al.entity = _entity)
    AND (_from IS NULL OR al.created_at >= _from)
    AND (_to IS NULL OR al.created_at <= _to);

  RETURN QUERY
  SELECT al.id, al.tenant_id, t.name::text, al.actor_id, p.full_name::text,
         CASE WHEN _is_sa THEN au.email::text ELSE NULL END,
         al.action::text, al.entity::text, al.entity_id,
         public.redact_sensitive_data(al.metadata), al.created_at, _total_count
  FROM public.audit_logs al
  LEFT JOIN public.tenants t ON t.id = al.tenant_id
  LEFT JOIN public.profiles p ON p.id = al.actor_id
  LEFT JOIN auth.users au ON au.id = al.actor_id
  WHERE (_tenant_id IS NULL OR al.tenant_id = _tenant_id)
    AND (_actor_id IS NULL OR al.actor_id = _actor_id)
    AND (_action_prefix IS NULL OR al.action LIKE _action_prefix || '%')
    AND (_entity IS NULL OR al.entity = _entity)
    AND (_from IS NULL OR al.created_at >= _from)
    AND (_to IS NULL OR al.created_at <= _to)
    AND (_cursor_id IS NULL OR CASE WHEN _sort_order = 'asc'
          THEN (al.created_at > _cursor_timestamp) OR (al.created_at = _cursor_timestamp AND al.id > _cursor_id)
          ELSE (al.created_at < _cursor_timestamp) OR (al.created_at = _cursor_timestamp AND al.id < _cursor_id) END)
  ORDER BY
    CASE WHEN _sort_order = 'asc' THEN al.created_at END ASC,
    CASE WHEN _sort_order = 'asc' THEN al.id END ASC,
    CASE WHEN _sort_order <> 'asc' THEN al.created_at END DESC,
    CASE WHEN _sort_order <> 'asc' THEN al.id END DESC
  LIMIT _lim;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.get_audit_logs_advanced(uuid,uuid,text,text,timestamptz,timestamptz,integer,uuid,timestamptz,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_audit_logs_advanced(uuid,uuid,text,text,timestamptz,timestamptz,integer,uuid,timestamptz,text) TO authenticated, service_role;