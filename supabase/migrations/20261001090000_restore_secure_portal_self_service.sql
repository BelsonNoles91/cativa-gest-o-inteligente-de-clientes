-- Restaura o contrato de autoatendimento já esperado pelo portal e pelos tipos.
-- Todas as alterações sensíveis continuam sendo validadas no servidor.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_reschedule_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.client_users
  ADD COLUMN IF NOT EXISTS booking_origin text;

UPDATE public.client_users cu
SET booking_origin = 'public_link'
FROM public.clients c
WHERE c.id = cu.client_id
  AND c.tenant_id = cu.tenant_id
  AND c.origin = 'public_link'
  AND cu.booking_origin IS NULL;

CREATE TABLE IF NOT EXISTS public.client_self_service_rules (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  allow_client_confirm boolean NOT NULL DEFAULT true,
  allow_client_reschedule boolean NOT NULL DEFAULT true,
  allow_client_cancel boolean NOT NULL DEFAULT true,
  min_hours_to_reschedule integer NOT NULL DEFAULT 12 CHECK (min_hours_to_reschedule >= 0),
  min_hours_to_cancel integer NOT NULL DEFAULT 12 CHECK (min_hours_to_cancel >= 0),
  max_reschedules_per_appointment integer NOT NULL DEFAULT 2 CHECK (max_reschedules_per_appointment >= 0),
  max_cancellations_per_30d integer NOT NULL DEFAULT 3 CHECK (max_cancellations_per_30d >= 0),
  max_no_shows_per_90d integer NOT NULL DEFAULT 2 CHECK (max_no_shows_per_90d >= 0),
  block_days_after_limit integer NOT NULL DEFAULT 30 CHECK (block_days_after_limit >= 0),
  require_cancel_reason boolean NOT NULL DEFAULT true,
  policy_note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.client_self_service_rules TO authenticated;
GRANT ALL ON public.client_self_service_rules TO service_role;
ALTER TABLE public.client_self_service_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_self_service_rules_read ON public.client_self_service_rules;
CREATE POLICY client_self_service_rules_read
ON public.client_self_service_rules FOR SELECT TO authenticated
USING (
  public.is_tenant_member(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.tenant_id = client_self_service_rules.tenant_id
      AND cu.status = 'active'
  )
);

DROP POLICY IF EXISTS client_self_service_rules_write ON public.client_self_service_rules;
CREATE POLICY client_self_service_rules_write
ON public.client_self_service_rules FOR ALL TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner', 'manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner', 'manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

CREATE INDEX IF NOT EXISTS appointments_client_cancelled_recent_idx
  ON public.appointments (tenant_id, client_id, canceled_at DESC)
  WHERE status = 'canceled';
CREATE INDEX IF NOT EXISTS appointments_client_no_show_recent_idx
  ON public.appointments (tenant_id, client_id, starts_at DESC)
  WHERE status = 'no_show';

CREATE OR REPLACE FUNCTION public.client_self_service_status(_tenant_id uuid, _client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.client_self_service_rules%ROWTYPE;
  cancellations integer;
  no_shows integer;
  blocked boolean := false;
  block_reason text := NULL;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND NOT (
    public.is_super_admin(auth.uid())
    OR public.is_tenant_member(auth.uid(), _tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.tenant_id = _tenant_id
        AND cu.client_id = _client_id
        AND cu.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'Você não tem acesso às regras deste cliente.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r
  FROM public.client_self_service_rules
  WHERE tenant_id = _tenant_id;

  IF NOT FOUND THEN
    r.allow_client_confirm := true;
    r.allow_client_reschedule := true;
    r.allow_client_cancel := true;
    r.min_hours_to_reschedule := 12;
    r.min_hours_to_cancel := 12;
    r.max_reschedules_per_appointment := 2;
    r.max_cancellations_per_30d := 3;
    r.max_no_shows_per_90d := 2;
    r.block_days_after_limit := 30;
    r.require_cancel_reason := true;
    r.policy_note := NULL;
  END IF;

  SELECT count(*)::integer INTO cancellations
  FROM public.appointments a
  WHERE a.tenant_id = _tenant_id
    AND a.client_id = _client_id
    AND a.status = 'canceled'
    AND a.canceled_at >= now() - interval '30 days';

  SELECT count(*)::integer INTO no_shows
  FROM public.appointments a
  WHERE a.tenant_id = _tenant_id
    AND a.client_id = _client_id
    AND a.status = 'no_show'
    AND a.starts_at >= now() - interval '90 days';

  IF r.max_cancellations_per_30d > 0 AND cancellations >= r.max_cancellations_per_30d THEN
    blocked := true;
    block_reason := 'limite_cancelamentos';
  ELSIF r.max_no_shows_per_90d > 0 AND no_shows >= r.max_no_shows_per_90d THEN
    blocked := true;
    block_reason := 'limite_faltas';
  END IF;

  RETURN jsonb_build_object(
    'allowConfirm', r.allow_client_confirm,
    'allowReschedule', r.allow_client_reschedule,
    'allowCancel', r.allow_client_cancel,
    'minHoursToReschedule', r.min_hours_to_reschedule,
    'minHoursToCancel', r.min_hours_to_cancel,
    'maxReschedulesPerAppointment', r.max_reschedules_per_appointment,
    'maxCancellationsPer30d', r.max_cancellations_per_30d,
    'maxNoShowsPer90d', r.max_no_shows_per_90d,
    'blockDaysAfterLimit', r.block_days_after_limit,
    'requireCancelReason', r.require_cancel_reason,
    'policyNote', r.policy_note,
    'cancellationsLast30d', cancellations,
    'noShowsLast90d', no_shows,
    'blocked', blocked,
    'blockReason', block_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.client_self_service_status(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.client_self_service_status(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.portal_can_book(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' AND auth.uid() IS DISTINCT FROM _user_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.client_users cu
    WHERE cu.user_id = _user_id
      AND cu.tenant_id = _tenant_id
      AND cu.status = 'active'
      AND (
        cu.booking_origin = 'public_link'
        OR EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.client_id = cu.client_id
            AND a.tenant_id = cu.tenant_id
        )
      )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_can_book(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_can_book(uuid, uuid) TO authenticated, service_role;

-- create_appointment_atomic é SECURITY DEFINER e, por isso, não depende da
-- policy INSERT da tabela. Este trigger fecha o caminho de bypass e mantém a
-- mesma regra tanto na UI quanto em chamadas diretas à RPC.
CREATE OR REPLACE FUNCTION public.enforce_portal_booking_eligibility()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source = 'client_portal'::public.appointment_source
     AND public.is_portal_client_of(NEW.client_id, auth.uid())
     AND NOT public.has_any_tenant_role(
       auth.uid(),
       NEW.tenant_id,
       ARRAY['owner', 'manager', 'frontdesk', 'professional']::public.app_role[]
     )
     AND NOT public.is_super_admin(auth.uid())
     AND NOT public.portal_can_book(auth.uid(), NEW.tenant_id) THEN
    RAISE EXCEPTION 'Para seu primeiro agendamento, use o link público do estabelecimento.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_portal_booking_eligibility() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_portal_booking_eligibility() TO service_role;

DROP TRIGGER IF EXISTS appointments_enforce_portal_booking_eligibility ON public.appointments;
CREATE TRIGGER appointments_enforce_portal_booking_eligibility
BEFORE INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.enforce_portal_booking_eligibility();

DROP POLICY IF EXISTS "appointments: portal cliente cria os proprios" ON public.appointments;
CREATE POLICY "appointments: portal cliente cria os proprios"
ON public.appointments FOR INSERT TO authenticated
WITH CHECK (
  client_id = public.client_user_tenant(tenant_id, auth.uid())
  AND source = 'client_portal'::public.appointment_source
  AND public.portal_can_book(auth.uid(), tenant_id)
);

-- O cliente não pode alterar datas/status por UPDATE direto; confirmação,
-- cancelamento e reagendamento passam exclusivamente pelas RPCs abaixo.
DROP POLICY IF EXISTS "appointments: portal cliente atualiza os proprios" ON public.appointments;

CREATE OR REPLACE FUNCTION public.portal_confirm_appointment(_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.appointments%ROWTYPE;
  rules jsonb;
BEGIN
  SELECT * INTO a
  FROM public.appointments
  WHERE id = _appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.tenant_id = a.tenant_id
      AND cu.client_id = a.client_id
      AND cu.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você não tem acesso a este agendamento.' USING ERRCODE = '42501';
  END IF;

  IF a.status = 'confirmed' THEN
    RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
  END IF;
  IF a.status NOT IN ('requested', 'pending', 'reminded') OR a.starts_at <= now() THEN
    RAISE EXCEPTION 'Este horário não pode mais ser confirmado.' USING ERRCODE = '22023';
  END IF;

  rules := public.client_self_service_status(a.tenant_id, a.client_id);
  IF NOT coalesce((rules->>'allowConfirm')::boolean, false) THEN
    RAISE EXCEPTION 'A confirmação pelo portal está desativada. Fale com o estabelecimento.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.appointments
  SET status = 'confirmed', confirmed_at = now(), updated_at = now()
  WHERE id = a.id;

  RETURN jsonb_build_object('ok', true, 'status', 'confirmed');
END;
$$;

REVOKE ALL ON FUNCTION public.portal_confirm_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_confirm_appointment(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.portal_cancel_appointment(_appointment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.appointments%ROWTYPE;
  rules jsonb;
  hours_left numeric;
  reason text := nullif(btrim(_reason), '');
BEGIN
  SELECT * INTO a
  FROM public.appointments
  WHERE id = _appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.tenant_id = a.tenant_id
      AND cu.client_id = a.client_id
      AND cu.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você não tem acesso a este agendamento.' USING ERRCODE = '42501';
  END IF;

  IF a.status NOT IN ('requested', 'pending', 'confirmed', 'reminded') THEN
    RAISE EXCEPTION 'Este horário não pode mais ser cancelado.' USING ERRCODE = '22023';
  END IF;
  IF char_length(coalesce(reason, '')) > 1000 THEN
    RAISE EXCEPTION 'O motivo do cancelamento deve ter no máximo 1000 caracteres.' USING ERRCODE = '22023';
  END IF;

  rules := public.client_self_service_status(a.tenant_id, a.client_id);
  IF NOT coalesce((rules->>'allowCancel')::boolean, false) THEN
    RAISE EXCEPTION 'O cancelamento pelo portal está desativado. Fale com o estabelecimento.' USING ERRCODE = '42501';
  END IF;
  IF coalesce((rules->>'blocked')::boolean, true) THEN
    RAISE EXCEPTION 'Seu autoatendimento está temporariamente suspenso. Fale com o estabelecimento.' USING ERRCODE = '42501';
  END IF;
  IF coalesce((rules->>'requireCancelReason')::boolean, true)
     AND char_length(coalesce(reason, '')) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento com pelo menos 3 caracteres.' USING ERRCODE = '22023';
  END IF;

  hours_left := extract(epoch FROM (a.starts_at - now())) / 3600;
  IF hours_left < (rules->>'minHoursToCancel')::numeric THEN
    RAISE EXCEPTION 'Cancelamentos pelo portal só até % h antes do horário. Fale com o estabelecimento.',
      (rules->>'minHoursToCancel');
  END IF;

  UPDATE public.appointments
  SET status = 'canceled', canceled_at = now(), canceled_reason = reason, updated_at = now()
  WHERE id = a.id;

  RETURN jsonb_build_object('ok', true, 'status', 'canceled');
END;
$$;

REVOKE ALL ON FUNCTION public.portal_cancel_appointment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_cancel_appointment(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.portal_reschedule_appointment(
  _appointment_id uuid,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _professional_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.appointments%ROWTYPE;
  rules jsonb;
  hours_left numeric;
  v_service_id uuid;
  v_professional_id uuid;
  service_row public.services%ROWTYPE;
  tenant_timezone text;
  available boolean := false;
BEGIN
  SELECT * INTO a
  FROM public.appointments
  WHERE id = _appointment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agendamento não encontrado.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.tenant_id = a.tenant_id
      AND cu.client_id = a.client_id
      AND cu.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você não tem acesso a este agendamento.' USING ERRCODE = '42501';
  END IF;

  IF a.status NOT IN ('requested', 'pending', 'confirmed', 'reminded') THEN
    RAISE EXCEPTION 'Este horário não pode mais ser alterado.' USING ERRCODE = '22023';
  END IF;

  rules := public.client_self_service_status(a.tenant_id, a.client_id);
  IF NOT coalesce((rules->>'allowReschedule')::boolean, false) THEN
    RAISE EXCEPTION 'O reagendamento pelo portal está desativado. Fale com o estabelecimento.' USING ERRCODE = '42501';
  END IF;
  IF coalesce((rules->>'blocked')::boolean, true) THEN
    RAISE EXCEPTION 'Seu autoatendimento está temporariamente suspenso. Fale com o estabelecimento.' USING ERRCODE = '42501';
  END IF;

  hours_left := extract(epoch FROM (a.starts_at - now())) / 3600;
  IF hours_left < (rules->>'minHoursToReschedule')::numeric THEN
    RAISE EXCEPTION 'Alterações pelo portal só até % h antes do horário. Fale com o estabelecimento.',
      (rules->>'minHoursToReschedule');
  END IF;
  IF (rules->>'maxReschedulesPerAppointment')::integer > 0
     AND coalesce(a.client_reschedule_count, 0) >= (rules->>'maxReschedulesPerAppointment')::integer THEN
    RAISE EXCEPTION 'Você já alterou este horário o número máximo de vezes permitido.' USING ERRCODE = '22023';
  END IF;
  IF _starts_at IS NULL OR _ends_at IS NULL OR _starts_at <= now()
     OR _ends_at <> _starts_at + make_interval(mins => a.duration_minutes) THEN
    RAISE EXCEPTION 'Data, horário ou duração do novo agendamento inválidos.' USING ERRCODE = '22023';
  END IF;

  SELECT s.* INTO service_row
  FROM public.appointment_items ai
  JOIN public.services s ON s.id = ai.service_id AND s.tenant_id = ai.tenant_id
  WHERE ai.appointment_id = a.id
    AND ai.tenant_id = a.tenant_id
  ORDER BY ai.position
  LIMIT 1;
  IF NOT FOUND OR NOT service_row.is_active OR NOT service_row.is_public THEN
    RAISE EXCEPTION 'O serviço deste agendamento não está disponível para reagendamento pelo portal.' USING ERRCODE = '22023';
  END IF;
  v_service_id := service_row.id;
  v_professional_id := coalesce(_professional_id, a.professional_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = v_professional_id
      AND p.tenant_id = a.tenant_id
      AND p.is_active
      AND (p.unit_id IS NULL OR p.unit_id = a.unit_id)
  ) THEN
    RAISE EXCEPTION 'Profissional indisponível.' USING ERRCODE = '22023';
  END IF;

  IF _starts_at < now() + make_interval(hours => coalesce(service_row.min_advance_hours, 0))
     OR _starts_at > now() + make_interval(days => coalesce(service_row.max_advance_days, 60)) THEN
    RAISE EXCEPTION 'O horário escolhido está fora do período permitido para este serviço.' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(t.timezone, 'America/Sao_Paulo') INTO tenant_timezone
  FROM public.tenants t
  WHERE t.id = a.tenant_id;

  SELECT EXISTS (
    SELECT 1
    FROM public.get_available_slots(
      a.tenant_id,
      v_professional_id,
      a.unit_id,
      v_service_id,
      (_starts_at AT TIME ZONE tenant_timezone)::date
    ) slot
    WHERE abs(extract(epoch FROM (slot.slot_start - _starts_at))) < 60
      AND slot.slot_end = _ends_at
  ) INTO available;
  IF NOT available THEN
    RAISE EXCEPTION 'Esse horário acabou de ficar indisponível. Escolha outro.' USING ERRCODE = '23P01';
  END IF;

  UPDATE public.appointments
  SET starts_at = _starts_at,
      ends_at = _ends_at,
      professional_id = v_professional_id,
      status = 'pending',
      confirmed_at = NULL,
      reminded_at = NULL,
      client_reschedule_count = coalesce(client_reschedule_count, 0) + 1,
      updated_at = now()
  WHERE id = a.id;

  RETURN jsonb_build_object('ok', true, 'startsAt', _starts_at, 'endsAt', _ends_at);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_reschedule_appointment(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_reschedule_appointment(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;

-- Reagendar um confirmado para pendente é uma transição válida somente quando
-- a data foi efetivamente alterada. UPDATE direto de portal foi removido acima.
CREATE OR REPLACE FUNCTION public.validate_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'pending'
     AND NEW.starts_at IS DISTINCT FROM OLD.starts_at
     AND OLD.status IN ('requested', 'pending', 'confirmed', 'reminded', 'arrived') THEN
    RETURN NEW;
  END IF;

  IF NOT (
    CASE OLD.status
      WHEN 'requested' THEN NEW.status IN ('pending', 'confirmed', 'canceled')
      WHEN 'pending' THEN NEW.status IN ('confirmed', 'reminded', 'arrived', 'canceled', 'no_show')
      WHEN 'confirmed' THEN NEW.status IN ('reminded', 'arrived', 'canceled', 'no_show')
      WHEN 'reminded' THEN NEW.status IN ('arrived', 'confirmed', 'canceled', 'no_show')
      WHEN 'arrived' THEN NEW.status IN ('in_service', 'canceled')
      WHEN 'in_service' THEN NEW.status = 'completed'
      ELSE false
    END
  ) THEN
    RAISE EXCEPTION 'Transição de status inválida: % para %.', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_appointment_status_transition() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_appointment_status_transition() TO service_role;

-- Ao mover um compromisso, o registro de confirmação não pode continuar
-- fechado como confirmado nem conservar o horário antigo.
CREATE OR REPLACE FUNCTION public.sync_confirmation_queue_on_appointment_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'canceled' THEN
    UPDATE public.confirmation_queue
    SET status = 'canceled'::public.confirmation_queue_status,
        closed_at = now(),
        notes = coalesce(notes, '') || ' [Auto-fechado por alteração no agendamento]'
    WHERE appointment_id = NEW.id
      AND status <> 'canceled';
  ELSIF NEW.status IN ('completed', 'no_show') THEN
    UPDATE public.confirmation_queue
    SET status = 'closed'::public.confirmation_queue_status,
        closed_at = now(),
        notes = coalesce(notes, '') || ' [Auto-fechado por alteração no agendamento]'
    WHERE appointment_id = NEW.id
      AND status NOT IN ('closed', 'canceled');
  END IF;

  IF NEW.starts_at IS DISTINCT FROM OLD.starts_at
     AND NEW.status NOT IN ('canceled', 'completed', 'no_show') THEN
    UPDATE public.confirmation_queue
    SET status = 'pending'::public.confirmation_queue_status,
        closed_at = NULL,
        scheduled_for = now(),
        appointment_starts_at = NEW.starts_at,
        attempts_count = 0,
        last_attempt_at = NULL,
        follow_up_at = NULL,
        notes = coalesce(notes, '') || ' [Reaberto por reagendamento]'
    WHERE appointment_id = NEW.id
      AND status <> 'canceled';
  END IF;

  IF NEW.status = 'confirmed' OR NEW.confirmed_at IS NOT NULL THEN
    UPDATE public.confirmation_queue
    SET status = 'confirmed'::public.confirmation_queue_status,
        closed_at = now(),
        notes = coalesce(notes, '') || ' [Auto-confirmado por ação externa]'
    WHERE appointment_id = NEW.id
      AND status NOT IN ('closed', 'confirmed', 'canceled');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_confirmation_queue_on_appointment_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_confirmation_queue_on_appointment_change() TO service_role;

DROP TRIGGER IF EXISTS trg_sync_confirmation_queue ON public.appointments;
CREATE TRIGGER trg_sync_confirmation_queue
AFTER UPDATE OF status, confirmed_at, starts_at ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_confirmation_queue_on_appointment_change();
