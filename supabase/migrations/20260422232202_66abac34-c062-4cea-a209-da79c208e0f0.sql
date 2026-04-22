CREATE OR REPLACE FUNCTION public.admin_list_tenant_memberships()
 RETURNS TABLE(membership_id uuid, tenant_id uuid, tenant_name text, tenant_slug text, user_id uuid, role app_role, status text, user_full_name text, user_email text, user_is_super_admin boolean, invited_email text, invited_at timestamp with time zone, accepted_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    tm.id, tm.tenant_id, t.name, t.slug,
    tm.user_id, tm.role, tm.status::text,
    p.full_name,
    u.email::text AS user_email,
    COALESCE(p.is_super_admin, false),
    tm.invited_email, tm.invited_at, tm.accepted_at, tm.updated_at
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  LEFT JOIN auth.users u ON u.id = tm.user_id
  ORDER BY t.name ASC, tm.updated_at DESC;
END;
$function$;