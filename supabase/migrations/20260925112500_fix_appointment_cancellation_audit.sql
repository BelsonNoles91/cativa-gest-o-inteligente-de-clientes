-- Permite que o trigger interno registre cancelamentos em audit_logs sem
-- reabrir INSERT direto para usuários autenticados. A tabela permanece com
-- RLS e com a policy de INSERT bloqueada; apenas esta função, executada como
-- owner do schema, grava o evento de auditoria.
CREATE OR REPLACE FUNCTION public.log_appointment_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status <> 'canceled' AND NEW.status = 'canceled' THEN
    INSERT INTO public.audit_logs (
      tenant_id,
      actor_id,
      action,
      entity,
      entity_id,
      metadata
    )
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
$$;
