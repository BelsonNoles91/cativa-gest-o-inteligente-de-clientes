-- Regras configuraveis de autoatendimento do cliente (sem mencao a taxas)
CREATE TABLE IF NOT EXISTS public.client_self_service_rules (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  allow_client_confirm boolean NOT NULL DEFAULT true,
  allow_client_reschedule boolean NOT NULL DEFAULT true,
  allow_client_cancel boolean NOT NULL DEFAULT true,
  min_hours_to_reschedule integer NOT NULL DEFAULT 12,
  min_hours_to_cancel integer NOT NULL DEFAULT 12,
  max_reschedules_per_appointment integer NOT NULL DEFAULT 2,
  max_cancellations_per_30d integer NOT NULL DEFAULT 3,
  max_no_shows_per_90d integer NOT NULL DEFAULT 2,
  block_days_after_limit integer NOT NULL DEFAULT 30,
  require_cancel_reason boolean NOT NULL DEFAULT true,
  policy_note text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT ON public.client_self_service_rules TO authenticated;
GRANT INSERT, UPDATE ON public.client_self_service_rules TO authenticated;
GRANT ALL ON public.client_self_service_rules TO service_role;

ALTER TABLE public.client_self_service_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "self_service_rules_read" ON public.client_self_service_rules;
CREATE POLICY "self_service_rules_read" ON public.client_self_service_rules
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.user_id = auth.uid() AND cu.tenant_id = client_self_service_rules.tenant_id
    )
  );

DROP POLICY IF EXISTS "self_service_rules_write" ON public.client_self_service_rules;
CREATE POLICY "self_service_rules_write" ON public.client_self_service_rules
  FOR ALL TO authenticated
  USING (
    public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[])
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[])
    OR public.is_super_admin(auth.uid())
  );

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_reschedule_count integer NOT NULL DEFAULT 0;

-- Situacao do cliente frente as regras (usada pela UI e pelas RPCs)
CREATE OR REPLACE FUNCTION public.client_self_service_status(_tenant_id uuid, _client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.client_self_service_rules%ROWTYPE;
  cancels integer;
  noshows integer;
  blocked boolean := false;
  reason text := NULL;
BEGIN
  SELECT * INTO r FROM public.client_self_service_rules WHERE tenant_id = _tenant_id;
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

  SELECT count(*) INTO cancels FROM public.appointments a
   WHERE a.tenant_id = _tenant_id AND a.client_id = _client_id
     AND a.status = 'canceled' AND a.canceled_at > now() - interval '30 days';

  SELECT count(*) INTO noshows FROM public.appointments a
   WHERE a.tenant_id = _tenant_id AND a.client_id = _client_id
     AND a.status = 'no_show' AND a.starts_at > now() - interval '90 days';

  IF r.max_cancellations_per_30d > 0 AND cancels >= r.max_cancellations_per_30d THEN
    blocked := true;
    reason := 'limite_cancelamentos';
  ELSIF r.max_no_shows_per_90d > 0 AND noshows >= r.max_no_shows_per_90d THEN
    blocked := true;
    reason := 'limite_faltas';
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
    'cancellationsLast30d', cancels,
    'noShowsLast90d', noshows,
    'blocked', blocked,
    'blockReason', reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.client_self_service_status(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.client_self_service_status(uuid, uuid) TO authenticated, service_role;

-- Cancelamento pelo cliente, com validacao server-side
CREATE OR REPLACE FUNCTION public.portal_cancel_appointment(_appointment_id uuid, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.appointments%ROWTYPE;
  st jsonb;
  hours_left numeric;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid() AND cu.tenant_id = a.tenant_id
      AND cu.client_id = a.client_id AND cu.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você não tem acesso a este agendamento.';
  END IF;

  IF a.status IN ('canceled','completed','no_show') THEN
    RAISE EXCEPTION 'Este horário não pode mais ser cancelado.';
  END IF;

  st := public.client_self_service_status(a.tenant_id, a.client_id);

  IF NOT (st->>'allowCancel')::boolean THEN
    RAISE EXCEPTION 'O cancelamento pelo portal está desativado. Fale com o estabelecimento.';
  END IF;
  IF (st->>'blocked')::boolean THEN
    RAISE EXCEPTION 'Seu autoatendimento está temporariamente suspenso. Fale com o estabelecimento.';
  END IF;
  IF (st->>'requireCancelReason')::boolean AND coalesce(btrim(_reason), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento.';
  END IF;

  hours_left := EXTRACT(EPOCH FROM (a.starts_at - now())) / 3600;
  IF hours_left < (st->>'minHoursToCancel')::numeric THEN
    RAISE EXCEPTION 'Cancelamentos pelo portal só até % h antes do horário. Fale com o estabelecimento.',
      (st->>'minHoursToCancel');
  END IF;

  UPDATE public.appointments
     SET status = 'canceled', canceled_at = now(), canceled_reason = _reason, updated_at = now()
   WHERE id = _appointment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_cancel_appointment(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.portal_cancel_appointment(uuid, text) TO authenticated, service_role;

-- Reagendamento pelo cliente, com validacao server-side
CREATE OR REPLACE FUNCTION public.portal_reschedule_appointment(
  _appointment_id uuid, _starts_at timestamptz, _ends_at timestamptz, _professional_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.appointments%ROWTYPE;
  st jsonb;
  hours_left numeric;
BEGIN
  SELECT * INTO a FROM public.appointments WHERE id = _appointment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid() AND cu.tenant_id = a.tenant_id
      AND cu.client_id = a.client_id AND cu.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Você não tem acesso a este agendamento.';
  END IF;

  IF a.status IN ('canceled','completed','no_show') THEN
    RAISE EXCEPTION 'Este horário não pode mais ser alterado.';
  END IF;

  st := public.client_self_service_status(a.tenant_id, a.client_id);

  IF NOT (st->>'allowReschedule')::boolean THEN
    RAISE EXCEPTION 'O reagendamento pelo portal está desativado. Fale com o estabelecimento.';
  END IF;
  IF (st->>'blocked')::boolean THEN
    RAISE EXCEPTION 'Seu autoatendimento está temporariamente suspenso. Fale com o estabelecimento.';
  END IF;

  hours_left := EXTRACT(EPOCH FROM (a.starts_at - now())) / 3600;
  IF hours_left < (st->>'minHoursToReschedule')::numeric THEN
    RAISE EXCEPTION 'Alterações pelo portal só até % h antes do horário. Fale com o estabelecimento.',
      (st->>'minHoursToReschedule');
  END IF;

  IF (st->>'maxReschedulesPerAppointment')::int > 0
     AND coalesce(a.client_reschedule_count, 0) >= (st->>'maxReschedulesPerAppointment')::int THEN
    RAISE EXCEPTION 'Você já alterou este horário o número máximo de vezes permitido.';
  END IF;

  IF _starts_at <= now() THEN
    RAISE EXCEPTION 'Escolha um horário futuro.';
  END IF;

  UPDATE public.appointments
     SET starts_at = _starts_at,
         ends_at = _ends_at,
         professional_id = coalesce(_professional_id, professional_id),
         status = 'pending',
         client_reschedule_count = coalesce(client_reschedule_count, 0) + 1,
         updated_at = now()
   WHERE id = _appointment_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_reschedule_appointment(uuid, timestamptz, timestamptz, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.portal_reschedule_appointment(uuid, timestamptz, timestamptz, uuid) TO authenticated, service_role;