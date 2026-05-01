-- Reforço de isolamento multi-tenant para agendamentos
CREATE OR REPLACE FUNCTION public.check_appointment_tenant_integrity()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o cliente pertence ao mesmo tenant do agendamento
  IF NOT EXISTS (
    SELECT 1 FROM public.clients 
    WHERE id = NEW.client_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'O cliente informado não pertence a este estabelecimento.' USING ERRCODE = 'P0005';
  END IF;

  -- Verificar se o profissional pertence ao mesmo tenant
  IF NOT EXISTS (
    SELECT 1 FROM public.professionals 
    WHERE id = NEW.professional_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'O profissional informado não pertence a este estabelecimento.' USING ERRCODE = 'P0006';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_check_appointment_tenant_integrity ON public.appointments;
CREATE TRIGGER trg_check_appointment_tenant_integrity
BEFORE INSERT OR UPDATE OF client_id, professional_id ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_appointment_tenant_integrity();

-- Garantir que as políticas de RLS cubram novos campos ou tabelas de sistema
ALTER TABLE public.reactivation_campaigns ENABLE ROW LEVEL SECURITY;
-- Já criada no passo anterior, mas reforçando para garantir.

-- Reforço na política de audit_logs (apenas owner/manager podem ver)
DROP POLICY IF EXISTS "Users can view audit logs of their tenant" ON public.audit_logs;
CREATE POLICY "Users can view audit logs of their tenant"
    ON public.audit_logs
    FOR SELECT
    USING (
      public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
      OR public.is_super_admin(auth.uid())
    );
