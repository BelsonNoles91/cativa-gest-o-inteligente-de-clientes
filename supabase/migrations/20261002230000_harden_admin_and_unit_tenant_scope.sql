-- Keep administrative settings, invitations, professionals and subscription
-- events bound to the tenant represented by their UUID foreign keys.

CREATE OR REPLACE FUNCTION public.enforce_admin_unit_tenant_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'O tenant de um registro administrativo existente não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'professionals' THEN
    IF NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'A unidade do profissional deve pertencer ao mesmo tenant.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'subscription_events' THEN
    IF NEW.subscription_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.tenant_subscriptions s
      WHERE s.id = NEW.subscription_id AND s.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'O evento referencia assinatura de outro tenant.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'team_invitations' THEN
    IF NEW.professional_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = NEW.professional_id AND p.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'O convite referencia profissional de outro tenant.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'tenant_settings' THEN
    IF NEW.default_unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.default_unit_id AND u.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'A unidade padrão deve pertencer ao tenant das configurações.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'unit_settings' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'A unidade e as configurações devem pertencer ao mesmo tenant.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_admin_unit_tenant_scope() FROM PUBLIC, anon, authenticated, service_role;

DO $triggers$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'professionals',
    'subscription_events',
    'team_invitations',
    'tenant_settings',
    'unit_settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_admin_unit_tenant_scope', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_unit_tenant_scope()',
      table_name || '_admin_unit_tenant_scope', table_name
    );
  END LOOP;
END;
$triggers$;
