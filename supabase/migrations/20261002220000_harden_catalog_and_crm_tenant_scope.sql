-- UUID-only foreign keys do not bind catalog and CRM records to the tenant
-- stored on the child row. Enforce tenant coherence at the database boundary.

CREATE OR REPLACE FUNCTION public.enforce_catalog_crm_tenant_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_related_tenant uuid;
  v_related_client uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'O tenant de um registro do catálogo/CRM existente não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'clients' THEN
    IF (NEW.preferred_unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u WHERE u.id = NEW.preferred_unit_id AND u.tenant_id = NEW.tenant_id
    )) OR (NEW.preferred_professional_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.professionals p WHERE p.id = NEW.preferred_professional_id AND p.tenant_id = NEW.tenant_id
    )) OR (NEW.referred_by_client_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.referred_by_client_id AND c.tenant_id = NEW.tenant_id
    )) OR (NEW.last_service_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.last_service_id AND s.tenant_id = NEW.tenant_id
    )) THEN
      RAISE EXCEPTION 'As referências preferidas/históricas do cliente devem pertencer ao mesmo tenant.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'service_categories' THEN
    IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.service_categories parent
      WHERE parent.id = NEW.parent_id AND parent.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'A categoria pai não pertence ao tenant da categoria.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'services' THEN
    IF (NEW.category_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.service_categories c WHERE c.id = NEW.category_id AND c.tenant_id = NEW.tenant_id
    )) OR (NEW.cancellation_policy_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.cancellation_policies p WHERE p.id = NEW.cancellation_policy_id AND p.tenant_id = NEW.tenant_id
    )) THEN
      RAISE EXCEPTION 'A categoria ou política do serviço não pertence ao tenant do serviço.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'service_prices' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'O preço referencia serviço de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'service_unit_prices' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.units u WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'O preço por unidade referencia serviço/unidade de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'service_professional_prices' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.professionals p WHERE p.id = NEW.professional_id AND p.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'O preço por profissional referencia serviço/profissional de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'package_items' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.packages p WHERE p.id = NEW.package_id AND p.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'O item do pacote referencia pacote/serviço de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'membership_benefits' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.memberships m WHERE m.id = NEW.membership_id AND m.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'O benefício referencia assinatura/serviço de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'protocol_sessions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.protocols p WHERE p.id = NEW.protocol_id AND p.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'A sessão referencia protocolo/serviço de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'client_package_balances' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.packages p WHERE p.id = NEW.package_id AND p.tenant_id = NEW.tenant_id
    ) OR (NEW.service_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    )) THEN RAISE EXCEPTION 'O saldo do pacote referencia cliente/pacote/serviço de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'client_membership_subscriptions' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.memberships m WHERE m.id = NEW.membership_id AND m.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'A assinatura do cliente referencia cliente/benefício de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'client_membership_balances' THEN
    SELECT s.tenant_id INTO v_related_tenant
    FROM public.client_membership_subscriptions s
    WHERE s.id = NEW.subscription_id;
    IF NOT FOUND OR v_related_tenant IS DISTINCT FROM NEW.tenant_id
       OR NOT EXISTS (
         SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
       ) THEN RAISE EXCEPTION 'O saldo de assinatura referencia assinatura/serviço de outro tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'client_tag_relations' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.client_tags t WHERE t.id = NEW.tag_id AND t.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'A tag e o cliente relacionados devem pertencer ao mesmo tenant.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'client_custom_field_values' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.custom_field_definitions d
      WHERE d.id = NEW.definition_id AND d.tenant_id = NEW.tenant_id AND d.entity = 'client'
    ) THEN RAISE EXCEPTION 'O valor de campo personalizado referencia cliente/definição incompatível.' USING ERRCODE = '23514'; END IF;

  ELSIF TG_TABLE_NAME = 'client_timeline_events' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'O evento da linha do tempo referencia cliente de outro tenant.' USING ERRCODE = '23514'; END IF;
    IF auth.uid() IS NOT NULL THEN NEW.actor_id := auth.uid(); END IF;

  ELSIF TG_TABLE_NAME = 'client_files' OR TG_TABLE_NAME = 'client_photos' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) OR NEW.storage_path NOT LIKE NEW.tenant_id::text || '/' || NEW.client_id::text || '/%' THEN
      RAISE EXCEPTION 'A mídia precisa referenciar cliente e caminho do mesmo tenant.' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'client_photos' THEN
      IF NEW.pair_id IS NOT NULL THEN
        SELECT p.tenant_id, p.client_id INTO v_related_tenant, v_related_client
        FROM public.client_photos p WHERE p.id = NEW.pair_id;
        IF NOT FOUND OR v_related_tenant IS DISTINCT FROM NEW.tenant_id
           OR v_related_client IS DISTINCT FROM NEW.client_id THEN
          RAISE EXCEPTION 'A foto pareada precisa pertencer ao mesmo cliente e tenant.' USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
    IF auth.uid() IS NOT NULL THEN NEW.uploaded_by := auth.uid(); END IF;

  ELSIF TG_TABLE_NAME = 'consent_form_responses' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) OR NOT EXISTS (
      SELECT 1 FROM public.consent_form_templates t WHERE t.id = NEW.template_id AND t.tenant_id = NEW.tenant_id
    ) THEN RAISE EXCEPTION 'A resposta de consentimento referencia cliente/modelo de outro tenant.' USING ERRCODE = '23514'; END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_catalog_crm_tenant_scope() FROM PUBLIC, anon, authenticated, service_role;

DO $triggers$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'clients',
    'service_categories',
    'services',
    'service_prices',
    'service_unit_prices',
    'service_professional_prices',
    'packages',
    'package_items',
    'memberships',
    'membership_benefits',
    'protocols',
    'protocol_sessions',
    'client_package_balances',
    'client_membership_subscriptions',
    'client_membership_balances',
    'client_tags',
    'client_tag_relations',
    'client_files',
    'client_photos',
    'client_timeline_events',
    'custom_field_definitions',
    'client_custom_field_values',
    'consent_form_templates',
    'consent_form_responses'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_catalog_crm_tenant_scope', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_catalog_crm_tenant_scope()',
      table_name || '_catalog_crm_tenant_scope', table_name
    );
  END LOOP;
END;
$triggers$;
