CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(_tenant_id uuid DEFAULT NULL::uuid, _actor_id uuid DEFAULT NULL::uuid, _action_prefix text DEFAULT NULL::text, _from timestamp with time zone DEFAULT NULL::timestamp with time zone, _to timestamp with time zone DEFAULT NULL::timestamp with time zone, _limit integer DEFAULT 200)
 RETURNS TABLE(id uuid, tenant_id uuid, tenant_name text, actor_id uuid, actor_name text, actor_email text, action text, entity text, entity_id uuid, metadata jsonb, created_at timestamp with time zone)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT a.id, a.tenant_id, t.name::text, a.actor_id, p.full_name::text, u.email::text,
         a.action::text, a.entity::text, a.entity_id, a.metadata, a.created_at
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
$function$;