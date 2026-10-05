-- Keep every appointment and its dependent operational rows inside one tenant.
-- Foreign keys on UUID alone do not guarantee that their tenant_id values agree.

CREATE OR REPLACE FUNCTION public.check_appointment_tenant_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'O tenant de um agendamento existente não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.units u
    WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'A unidade informada não pertence a este estabelecimento.'
      USING ERRCODE = 'P0007';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'O cliente informado não pertence a este estabelecimento.'
      USING ERRCODE = 'P0005';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = NEW.professional_id AND p.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'O profissional informado não pertence a este estabelecimento.'
      USING ERRCODE = 'P0006';
  END IF;

  IF NEW.resource_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.resources r
    WHERE r.id = NEW.resource_id
      AND r.tenant_id = NEW.tenant_id
      AND (r.unit_id IS NULL OR r.unit_id = NEW.unit_id)
  ) THEN
    RAISE EXCEPTION 'A sala ou recurso informado não pertence a esta unidade.'
      USING ERRCODE = 'P0008';
  END IF;

  IF NEW.cancellation_policy_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.cancellation_policies cp
    WHERE cp.id = NEW.cancellation_policy_id AND cp.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'A política de cancelamento não pertence a este estabelecimento.'
      USING ERRCODE = 'P0009';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_appointment_tenant_integrity() FROM PUBLIC, anon, authenticated, service_role;

-- Include tenant_id and all tenant-scoped foreign keys in the trigger event;
-- without tenant_id here, a user belonging to both tenants could move an
-- appointment by updating only that column.
DROP TRIGGER IF EXISTS trg_check_appointment_tenant_integrity ON public.appointments;
DROP TRIGGER IF EXISTS a_appointment_tenant_integrity_guard ON public.appointments;
CREATE TRIGGER a_appointment_tenant_integrity_guard
BEFORE INSERT OR UPDATE OF
  tenant_id,
  unit_id,
  client_id,
  professional_id,
  resource_id,
  cancellation_policy_id
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_appointment_tenant_integrity();

CREATE OR REPLACE FUNCTION public.enforce_appointment_item_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_client_id uuid;
  v_balance_client_id uuid;
  v_balance_service_id uuid;
  v_membership_service_id uuid;
  v_membership_client_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
    OR NEW.appointment_id IS DISTINCT FROM OLD.appointment_id
  ) THEN
    RAISE EXCEPTION 'O tenant e o agendamento de um item existente não podem ser alterados.'
      USING ERRCODE = '23514';
  END IF;

  SELECT a.client_id INTO v_client_id
  FROM public.appointments a
  WHERE a.id = NEW.appointment_id AND a.tenant_id = NEW.tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'O item precisa pertencer ao mesmo tenant do agendamento.'
      USING ERRCODE = '23514';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.services s
    WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'O serviço do item não pertence ao tenant do agendamento.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.package_balance_id IS NOT NULL THEN
    SELECT b.client_id, b.service_id
      INTO v_balance_client_id, v_balance_service_id
    FROM public.client_package_balances b
    WHERE b.id = NEW.package_balance_id AND b.tenant_id = NEW.tenant_id;

    IF NOT FOUND
       OR v_balance_client_id IS DISTINCT FROM v_client_id
       OR (v_balance_service_id IS NOT NULL AND v_balance_service_id <> NEW.service_id) THEN
      RAISE EXCEPTION 'O saldo do pacote não corresponde ao cliente, serviço e tenant do agendamento.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.membership_balance_id IS NOT NULL THEN
    SELECT mb.service_id, ms.client_id
      INTO v_membership_service_id, v_membership_client_id
    FROM public.client_membership_balances mb
    JOIN public.client_membership_subscriptions ms
      ON ms.id = mb.subscription_id
     AND ms.tenant_id = mb.tenant_id
    WHERE mb.id = NEW.membership_balance_id AND mb.tenant_id = NEW.tenant_id;

    IF NOT FOUND
       OR v_membership_client_id IS DISTINCT FROM v_client_id
       OR v_membership_service_id IS DISTINCT FROM NEW.service_id THEN
      RAISE EXCEPTION 'O saldo de assinatura não corresponde ao cliente, serviço e tenant do agendamento.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_appointment_item_scope() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enforce_appointment_event_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.id = NEW.appointment_id AND a.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'O evento precisa pertencer ao mesmo tenant do agendamento.'
      USING ERRCODE = '23514';
  END IF;

  -- Authenticated staff cannot attribute an operational log to another user.
  IF TG_TABLE_NAME = 'appointment_logs' AND auth.uid() IS NOT NULL THEN
    NEW.actor_id := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_appointment_event_scope() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS appointment_items_enforce_tenant_scope ON public.appointment_items;
CREATE TRIGGER appointment_items_enforce_tenant_scope
BEFORE INSERT OR UPDATE ON public.appointment_items
FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_item_scope();

DROP TRIGGER IF EXISTS appointment_status_history_enforce_tenant_scope ON public.appointment_status_history;
CREATE TRIGGER appointment_status_history_enforce_tenant_scope
BEFORE INSERT OR UPDATE ON public.appointment_status_history
FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_event_scope();

DROP TRIGGER IF EXISTS appointment_logs_enforce_tenant_scope ON public.appointment_logs;
CREATE TRIGGER appointment_logs_enforce_tenant_scope
BEFORE INSERT OR UPDATE ON public.appointment_logs
FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_event_scope();

-- Status history is written by the appointment status trigger, not by clients.
-- The trigger function is SECURITY DEFINER, so direct staff INSERT is needless
-- and would permit fabricated state transitions.
DROP POLICY IF EXISTS "appt_status_history: equipe registra" ON public.appointment_status_history;

CREATE OR REPLACE FUNCTION public.log_appointment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.appointment_status_history
      (tenant_id, appointment_id, from_status, to_status, actor_id)
    VALUES
      (NEW.tenant_id, NEW.id, NULL, NEW.status, NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.appointment_status_history
      (tenant_id, appointment_id, from_status, to_status, actor_id)
    VALUES
      (NEW.tenant_id, NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_appointment_status_change() FROM PUBLIC, anon, authenticated, service_role;

-- Scheduling configuration tables also store tenant_id beside ordinary UUID
-- foreign keys. Validate every non-null reference against that tenant.
CREATE OR REPLACE FUNCTION public.enforce_scheduling_reference_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_appointment_client_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'O tenant de um registro de agenda existente não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'resources' THEN
    IF NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'A unidade do recurso não pertence ao tenant do recurso.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'unit_business_hours' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'A unidade do horário não pertence ao tenant do horário.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'professional_availability' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = NEW.professional_id AND p.tenant_id = NEW.tenant_id
    ) OR (NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    )) THEN
      RAISE EXCEPTION 'Profissional ou unidade da disponibilidade pertence a outro tenant.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'time_off_blocks' THEN
    IF (NEW.professional_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = NEW.professional_id AND p.tenant_id = NEW.tenant_id
    )) OR (NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    )) THEN
      RAISE EXCEPTION 'Profissional ou unidade do bloqueio pertence a outro tenant.' USING ERRCODE = '23514';
    END IF;
    IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
  ELSIF TG_TABLE_NAME = 'recurring_blocks' THEN
    IF (NEW.professional_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = NEW.professional_id AND p.tenant_id = NEW.tenant_id
    )) OR (NEW.unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.unit_id AND u.tenant_id = NEW.tenant_id
    )) THEN
      RAISE EXCEPTION 'Profissional ou unidade do bloqueio recorrente pertence a outro tenant.' USING ERRCODE = '23514';
    END IF;
  ELSIF TG_TABLE_NAME = 'waitlist_entries' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = NEW.client_id AND c.tenant_id = NEW.tenant_id
    ) OR (NEW.service_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.services s
      WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id
    )) OR (NEW.preferred_professional_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.professionals p
      WHERE p.id = NEW.preferred_professional_id AND p.tenant_id = NEW.tenant_id
    )) OR (NEW.preferred_unit_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.units u
      WHERE u.id = NEW.preferred_unit_id AND u.tenant_id = NEW.tenant_id
    )) THEN
      RAISE EXCEPTION 'Cliente, serviço, profissional ou unidade da fila pertence a outro tenant.' USING ERRCODE = '23514';
    END IF;

    IF NEW.scheduled_appointment_id IS NOT NULL THEN
      SELECT a.client_id INTO v_appointment_client_id
      FROM public.appointments a
      WHERE a.id = NEW.scheduled_appointment_id AND a.tenant_id = NEW.tenant_id;
      IF NOT FOUND OR v_appointment_client_id IS DISTINCT FROM NEW.client_id THEN
        RAISE EXCEPTION 'O agendamento vinculado à fila deve pertencer ao mesmo tenant e cliente.'
          USING ERRCODE = '23514';
      END IF;
    END IF;
    IF auth.uid() IS NOT NULL THEN NEW.created_by := auth.uid(); END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_scheduling_reference_scope() FROM PUBLIC, anon, authenticated, service_role;

DO $triggers$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'resources',
    'unit_business_hours',
    'professional_availability',
    'time_off_blocks',
    'recurring_blocks',
    'waitlist_entries'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_enforce_tenant_scope', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_scheduling_reference_scope()',
      table_name || '_enforce_tenant_scope', table_name
    );
  END LOOP;
END;
$triggers$;

-- Parent records referenced by appointments must not be transferred between
-- tenants either. A user may legitimately hold memberships in both tenants;
-- RLS alone would then allow changing only the parent's tenant_id and orphan
-- or cross-scope existing appointments.
CREATE OR REPLACE FUNCTION public.prevent_tenant_scope_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'O tenant de um registro de negócio existente não pode ser alterado.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_tenant_scope_reassignment() FROM PUBLIC, anon, authenticated, service_role;

DO $triggers$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'units',
    'clients',
    'professionals',
    'services',
    'cancellation_policies'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', table_name || '_prevent_tenant_reassignment', table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OF tenant_id ON public.%I FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_scope_reassignment()',
      table_name || '_prevent_tenant_reassignment', table_name
    );
  END LOOP;
END;
$triggers$;
