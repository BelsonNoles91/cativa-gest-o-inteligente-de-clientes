-- 1. Função de validação de conflitos de agendamento
CREATE OR REPLACE FUNCTION public.check_appointment_conflicts()
RETURNS TRIGGER AS $$
DECLARE
  v_has_conflict boolean;
  v_unit_open time;
  v_unit_close time;
  v_pro_start time;
  v_pro_end time;
  v_weekday smallint;
BEGIN
  -- Ignorar cancelados e no-show
  IF NEW.status IN ('canceled', 'no_show') THEN
    RETURN NEW;
  END IF;

  -- 1.1 Conflito de Profissional (mesmo horário)
  -- Ignorar se for overbooked manual (se o sistema permitir explicitamente)
  IF NOT NEW.is_overbooked THEN
    SELECT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id <> NEW.id
        AND professional_id = NEW.professional_id
        AND tenant_id = NEW.tenant_id
        AND status NOT IN ('canceled', 'no_show')
        AND starts_at < NEW.ends_at
        AND ends_at > NEW.starts_at
    ) INTO v_has_conflict;

    IF v_has_conflict THEN
      RAISE EXCEPTION 'O profissional já possui um agendamento neste horário.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- 1.2 Conflito de Recurso (se houver recurso alocado)
  IF NEW.resource_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.appointments
      WHERE id <> NEW.id
        AND resource_id = NEW.resource_id
        AND tenant_id = NEW.tenant_id
        AND status NOT IN ('canceled', 'no_show')
        AND starts_at < NEW.ends_at
        AND ends_at > NEW.starts_at
    ) INTO v_has_conflict;

    IF v_has_conflict THEN
      RAISE EXCEPTION 'O recurso (sala/equipamento) já está reservado para este horário.' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- 1.3 Validação de Horário de Funcionamento (Unidade)
  v_weekday := extract(dow from NEW.starts_at)::smallint;
  
  SELECT opens_at, closes_at INTO v_unit_open, v_unit_close
  FROM public.unit_business_hours
  WHERE unit_id = NEW.unit_id AND weekday = v_weekday AND is_closed = false;

  IF v_unit_open IS NULL THEN
    RAISE EXCEPTION 'A unidade está fechada neste dia.' USING ERRCODE = 'P0003';
  END IF;

  IF NEW.starts_at::time < v_unit_open OR NEW.ends_at::time > v_unit_close THEN
    RAISE EXCEPTION 'O agendamento está fora do horário de funcionamento da unidade.' USING ERRCODE = 'P0004';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger para validar agendamentos
DROP TRIGGER IF EXISTS trg_check_appointment_conflicts ON public.appointments;
CREATE TRIGGER trg_check_appointment_conflicts
BEFORE INSERT OR UPDATE OF starts_at, ends_at, professional_id, resource_id, status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_appointment_conflicts();

-- 2. Log de Auditoria para Cancelamentos (Opcional, mas melhora a inteligência operacional)
CREATE OR REPLACE FUNCTION public.log_appointment_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status <> 'canceled' AND NEW.status = 'canceled' THEN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
      NEW.tenant_id, 
      auth.uid(), 
      'appointment.canceled', 
      'appointment', 
      NEW.id, 
      jsonb_build_object(
        'original_starts_at', OLD.starts_at,
        'canceled_at', now(),
        'reason', NEW.canceled_reason
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_log_appointment_cancellation ON public.appointments;
CREATE TRIGGER trg_log_appointment_cancellation
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
WHEN (NEW.status = 'canceled')
EXECUTE FUNCTION public.log_appointment_cancellation();
