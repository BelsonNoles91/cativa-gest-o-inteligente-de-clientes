-- 1) Audit logs RPC: add authorization check
CREATE OR REPLACE FUNCTION public.get_audit_logs_advanced(
  _tenant_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _action_prefix text DEFAULT NULL,
  _entity text DEFAULT NULL,
  _from timestamp with time zone DEFAULT NULL,
  _to timestamp with time zone DEFAULT NULL,
  _limit integer DEFAULT 50,
  _offset integer DEFAULT 0,
  _sort_order text DEFAULT 'desc'
)
RETURNS TABLE(
  id uuid, tenant_id uuid, tenant_name text, actor_id uuid,
  actor_name text, actor_email text, action text, entity text,
  entity_id uuid, metadata jsonb, created_at timestamp with time zone,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    public.is_super_admin(auth.uid())
    OR (
      _tenant_id IS NOT NULL
      AND public.has_any_tenant_role(
        auth.uid(), _tenant_id,
        ARRAY['owner'::app_role, 'manager'::app_role]
      )
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
      p.display_name AS actor_name,
      CASE WHEN public.is_super_admin(auth.uid()) THEN au.email ELSE NULL END AS actor_email,
      al.action,
      al.entity,
      al.entity_id,
      al.metadata,
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
    SELECT COUNT(*)::bigint AS total_count FROM filtered_logs
  )
  SELECT
    fl.id, fl.tenant_id, fl.tenant_name, fl.actor_id, fl.actor_name,
    fl.actor_email, fl.action, fl.entity, fl.entity_id, fl.metadata,
    fl.created_at, c.total_count
  FROM filtered_logs fl, counted c
  ORDER BY
    CASE WHEN _sort_order = 'asc'  THEN fl.created_at END ASC,
    CASE WHEN _sort_order = 'desc' THEN fl.created_at END DESC
  LIMIT _limit OFFSET _offset;
END;
$function$;

-- 2) system_status / system_incidents: real super-admin check
DROP POLICY IF EXISTS "Status manageable by super admins" ON public.system_status;
CREATE POLICY "Status manageable by super admins"
ON public.system_status
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Incidents manageable by super admins" ON public.system_incidents;
CREATE POLICY "Incidents manageable by super admins"
ON public.system_incidents
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 3) Remove leaky policy on professionals + provide a safe view
DROP POLICY IF EXISTS "professionals: membros leem (sem commission)" ON public.professionals;

DROP VIEW IF EXISTS public.professionals_public;
CREATE VIEW public.professionals_public
WITH (security_invoker = true)
AS
SELECT
  id, tenant_id, unit_id, user_id, display_name, role_title,
  bio, color, is_active, email, phone, specialty,
  created_at, updated_at
FROM public.professionals;

GRANT SELECT ON public.professionals_public TO authenticated;