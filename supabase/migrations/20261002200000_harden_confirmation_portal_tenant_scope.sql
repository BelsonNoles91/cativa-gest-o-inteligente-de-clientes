-- UUID foreign keys do not guarantee that CRM/portal references share a
-- tenant. Keep confirmation, contact history, client identity and reviews
-- consistent even for service-role writes that bypass RLS.

CREATE OR REPLACE FUNCTION public.enforce_confirmation_portal_tenant_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_queue_client_id uuid;
  v_queue_appointment_id uuid;
  v_appointment_client_id uuid;
  v_appointment_professional_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'O tenant de um registro de confirmação/portal existente não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'message_templates' THEN
    IF (NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    )) OR (NEW.service_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    )) THEN
      RAISE EXCEPTION 'A unidade ou serviço do modelo não pertence ao tenant.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'confirmation_rules' THEN
    IF NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'A unidade da regra de confirmação não pertence ao tenant.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'confirmation_queue' THEN
    SELECT a.client_id INTO v_appointment_client_id
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id AND a.tenant_id = NEW.tenant_id;
    IF NOT FOUND OR v_appointment_client_id IS DISTINCT FROM NEW.client_id
       OR NOT EXISTS (
         SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
       ) OR (NEW.rule_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.confirmation_rules r WHERE r.id = NEW.rule_id AND r.tenant_id = NEW.tenant_id
       )) THEN
      RAISE EXCEPTION 'Agendamento, cliente ou regra da fila pertence a outro tenant ou não é coerente.'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
      OR NEW.client_id IS DISTINCT FROM OLD.client_id
    ) THEN
      RAISE EXCEPTION 'A identidade do agendamento e do cliente da fila é imutável.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'contact_attempts' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'O cliente da tentativa de contato não pertence ao tenant.' USING ERRCODE = '23514';
    END IF;
    IF NEW.appointment_id IS NOT NULL THEN
      SELECT a.client_id INTO v_appointment_client_id
      FROM public.appointments a
      WHERE a.id = NEW.appointment_id AND a.tenant_id = NEW.tenant_id;
      IF NOT FOUND OR v_appointment_client_id IS DISTINCT FROM NEW.client_id THEN
        RAISE EXCEPTION 'O agendamento da tentativa não corresponde ao tenant e cliente.' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.queue_id IS NOT NULL THEN
      SELECT q.client_id, q.appointment_id INTO v_queue_client_id, v_queue_appointment_id
      FROM public.confirmation_queue q
      WHERE q.id = NEW.queue_id AND q.tenant_id = NEW.tenant_id;
      IF NOT FOUND OR v_queue_client_id IS DISTINCT FROM NEW.client_id
         OR (NEW.appointment_id IS NOT NULL AND v_queue_appointment_id IS DISTINCT FROM NEW.appointment_id) THEN
        RAISE EXCEPTION 'A fila da tentativa não corresponde ao tenant, cliente e agendamento.' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.template_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.message_templates m WHERE m.id = NEW.template_id AND m.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'O modelo da tentativa de contato não pertence ao tenant.' USING ERRCODE = '23514';
    END IF;
    IF auth.uid() IS NOT NULL THEN NEW.attempted_by := auth.uid(); END IF;

  ELSIF TG_TABLE_NAME = 'call_logs' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'O cliente do registro de ligação não pertence ao tenant.' USING ERRCODE = '23514';
    END IF;
    IF NEW.appointment_id IS NOT NULL THEN
      SELECT a.client_id INTO v_appointment_client_id
      FROM public.appointments a
      WHERE a.id = NEW.appointment_id AND a.tenant_id = NEW.tenant_id;
      IF NOT FOUND OR v_appointment_client_id IS DISTINCT FROM NEW.client_id THEN
        RAISE EXCEPTION 'O agendamento da ligação não corresponde ao tenant e cliente.' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF NEW.queue_id IS NOT NULL THEN
      SELECT q.client_id, q.appointment_id INTO v_queue_client_id, v_queue_appointment_id
      FROM public.confirmation_queue q
      WHERE q.id = NEW.queue_id AND q.tenant_id = NEW.tenant_id;
      IF NOT FOUND OR v_queue_client_id IS DISTINCT FROM NEW.client_id
         OR (NEW.appointment_id IS NOT NULL AND v_queue_appointment_id IS DISTINCT FROM NEW.appointment_id) THEN
        RAISE EXCEPTION 'A fila da ligação não corresponde ao tenant, cliente e agendamento.' USING ERRCODE = '23514';
      END IF;
    END IF;
    IF auth.uid() IS NOT NULL THEN NEW.called_by := auth.uid(); END IF;

  ELSIF TG_TABLE_NAME = 'channel_preferences' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'A preferência de canal referencia cliente de outro tenant.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'client_users' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'O vínculo do portal referencia cliente de outro tenant.' USING ERRCODE = '23514';
    END IF;

  ELSIF TG_TABLE_NAME = 'client_reviews' THEN
    SELECT a.client_id, a.professional_id
      INTO v_appointment_client_id, v_appointment_professional_id
    FROM public.appointments a
    WHERE a.id = NEW.appointment_id AND a.tenant_id = NEW.tenant_id;
    IF NOT FOUND OR v_appointment_client_id IS DISTINCT FROM NEW.client_id
       OR (NEW.professional_id IS NOT NULL AND v_appointment_professional_id IS DISTINCT FROM NEW.professional_id)
       OR NOT EXISTS (
         SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
       ) OR (NEW.professional_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.professionals p WHERE p.id = NEW.professional_id AND p.tenant_id = NEW.tenant_id
       )) THEN
      RAISE EXCEPTION 'A avaliação precisa corresponder ao tenant, cliente e profissional do agendamento.'
        USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'UPDATE' AND (
      NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
    ) THEN
      RAISE EXCEPTION 'A avaliação não pode ser transferida para outro cliente ou agendamento.' USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_confirmation_portal_tenant_scope() FROM PUBLIC, anon, authenticated, service_role;

DO $triggers$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'message_templates',
    'confirmation_rules',
    'confirmation_queue',
    'contact_attempts',
    'call_logs',
    'channel_preferences',
    'client_users',
    'client_reviews'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_enforce_tenant_scope', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_confirmation_portal_tenant_scope()',
      table_name || '_enforce_tenant_scope', table_name
    );
  END LOOP;
END;
$triggers$;
