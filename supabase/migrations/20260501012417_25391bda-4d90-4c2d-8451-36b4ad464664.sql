-- 1. Sincronização da Fila de Confirmação com o Agendamento
CREATE OR REPLACE FUNCTION public.sync_confirmation_queue_on_appointment_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o agendamento for cancelado, concluído ou no-show, fecha itens da fila
  IF NEW.status IN ('canceled', 'completed', 'no_show') THEN
    UPDATE public.confirmation_queue
    SET status = CASE 
                   WHEN NEW.status = 'canceled' THEN 'canceled'::confirmation_queue_status
                   ELSE 'closed'::confirmation_queue_status
                 END,
        closed_at = now(),
        notes = COALESCE(notes, '') || ' [Auto-fechado por alteração no agendamento]'
    WHERE appointment_id = NEW.id
      AND status NOT IN ('closed', 'confirmed', 'canceled');
  END IF;

  -- Se o agendamento for confirmado externamente (ex: pelo cliente no portal)
  IF NEW.status = 'confirmed' OR NEW.confirmed_at IS NOT NULL THEN
    UPDATE public.confirmation_queue
    SET status = 'confirmed',
        closed_at = now(),
        notes = COALESCE(notes, '') || ' [Auto-confirmado por ação externa]'
    WHERE appointment_id = NEW.id
      AND status NOT IN ('closed', 'confirmed', 'canceled');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_sync_confirmation_queue ON public.appointments;
CREATE TRIGGER trg_sync_confirmation_queue
AFTER UPDATE OF status, confirmed_at ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_confirmation_queue_on_appointment_change();

-- 2. Alerta de Oportunidade na Lista de Espera
-- Quando um agendamento é cancelado, verifica se há alguém na waitlist para aquele profissional/unidade
CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancellation()
RETURNS TRIGGER AS $$
DECLARE
  v_waitlist_count int;
BEGIN
  IF OLD.status <> 'canceled' AND NEW.status = 'canceled' THEN
    SELECT COUNT(*) INTO v_waitlist_count
    FROM public.waitlist_entries
    WHERE tenant_id = NEW.tenant_id
      AND status = 'open'
      AND (preferred_unit_id IS NULL OR preferred_unit_id = NEW.unit_id)
      AND (preferred_professional_id IS NULL OR preferred_professional_id = NEW.professional_id);

    IF v_waitlist_count > 0 THEN
      INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
      VALUES (
        NEW.tenant_id,
        NULL,
        'waitlist.opportunity',
        'appointment',
        NEW.id,
        jsonb_build_object(
          'message', 'Horário liberado com ' || v_waitlist_count || ' cliente(s) aguardando na lista de espera.',
          'unit_id', NEW.unit_id,
          'professional_id', NEW.professional_id,
          'starts_at', NEW.starts_at
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_notify_waitlist_on_cancellation ON public.appointments;
CREATE TRIGGER trg_notify_waitlist_on_cancellation
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.notify_waitlist_on_cancellation();
