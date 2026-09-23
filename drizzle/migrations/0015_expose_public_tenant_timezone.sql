CREATE OR REPLACE FUNCTION public.get_public_tenant_timezone(_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(t.timezone, 'America/Sao_Paulo')
  FROM public.tenants t
  JOIN public.tenant_public_pages p ON p.tenant_id = t.id
  WHERE t.slug = _slug
    AND p.is_published = true
    AND t.status = 'active'
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_tenant_timezone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_timezone(text) TO anon, authenticated, service_role;