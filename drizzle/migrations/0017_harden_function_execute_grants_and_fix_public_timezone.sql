-- 1) Alinha o fuso público com a mesma regra da página pública (inclui trial).
CREATE OR REPLACE FUNCTION public.get_public_tenant_timezone(_slug text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(t.timezone, 'America/Sao_Paulo')
  FROM public.tenants t
  JOIN public.tenant_public_pages p ON p.tenant_id = t.id
  WHERE t.slug = _slug
    AND p.is_published = true
    AND t.status IN ('active','trialing')
  LIMIT 1;
$$;

-- 2) Remove o EXECUTE herdado de PUBLIC nas funções internas SECURITY DEFINER
--    e mantém apenas authenticated + service_role.
DO $$
DECLARE
  r record;
  allowed text[] := ARRAY[
    'get_public_tenant_page',
    'get_public_tenant_timezone',
    'get_public_services',
    'get_public_units',
    'get_public_professionals',
    'get_public_availability',
    'create_public_appointment',
    'lookup_team_invitation'
  ];
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig, p.prorettype
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT (p.proname = ANY (allowed))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', r.sig);
    IF r.prorettype <> 'trigger'::regtype THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', r.sig);
    END IF;
  END LOOP;
END
$$;

-- 3) Garante que as funções públicas continuem acessíveis sem login.
GRANT EXECUTE ON FUNCTION public.get_public_tenant_page(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_tenant_timezone(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_units(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_team_invitation(text) TO anon, authenticated;