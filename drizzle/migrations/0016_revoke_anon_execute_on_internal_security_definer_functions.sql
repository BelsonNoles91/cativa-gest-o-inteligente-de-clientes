-- Fase 7: reduzir a superfície pública das funções SECURITY DEFINER.
-- Somente as funções realmente usadas pela página pública e pela tela de convite
-- continuam executáveis sem login.
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
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND NOT (p.proname = ANY (allowed))
      AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', r.sig);
  END LOOP;
END
$$;