-- Adiciona colunas de inteligência de retenção na tabela de clientes
ALTER TABLE public.clients 
ADD COLUMN average_cycle_days INTEGER,
ADD COLUMN churn_risk_score INTEGER DEFAULT 0,
ADD COLUMN next_best_action TEXT,
ADD COLUMN last_service_id UUID REFERENCES public.services(id);

-- Índice para performance em queries de retenção
CREATE INDEX idx_clients_retention ON public.clients (tenant_id, status, last_visit_at, churn_risk_score);

-- Função para atualizar métricas de retenção de um cliente
CREATE OR REPLACE FUNCTION public.update_client_retention_metrics(p_client_id UUID)
RETURNS VOID AS $$
DECLARE
    v_tenant_id UUID;
    v_last_visit TIMESTAMP WITH TIME ZONE;
    v_avg_cycle INTEGER;
    v_last_service_id UUID;
    v_visit_count INTEGER;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.clients WHERE id = p_client_id;

    -- Busca histórico de visitas concluídas
    SELECT 
        MAX(starts_at),
        (SELECT service_id FROM public.appointment_items WHERE appointment_id = (SELECT id FROM public.appointments WHERE client_id = p_client_id AND status = 'completed' ORDER BY starts_at DESC LIMIT 1) LIMIT 1),
        COUNT(*)
    INTO v_last_visit, v_last_service_id, v_visit_count
    FROM public.appointments 
    WHERE client_id = p_client_id AND status = 'completed';

    -- Cálculo simplificado do ciclo médio (últimas 4 visitas)
    WITH visit_gaps AS (
        SELECT 
            starts_at,
            LAG(starts_at) OVER (ORDER BY starts_at) as prev_starts_at
        FROM public.appointments
        WHERE client_id = p_client_id AND status = 'completed'
        ORDER BY starts_at DESC
        LIMIT 5
    )
    SELECT AVG(EXTRACT(DAY FROM (starts_at - prev_starts_at)))::INTEGER
    INTO v_avg_cycle
    FROM visit_gaps
    WHERE prev_starts_at IS NOT NULL;

    -- Atualiza o cliente
    UPDATE public.clients SET
        last_visit_at = v_last_visit,
        average_cycle_days = v_avg_cycle,
        last_service_id = v_last_service_id,
        updated_at = now()
    WHERE id = p_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para disparar atualização após conclusão de agendamento
CREATE OR REPLACE FUNCTION public.on_appointment_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed')) THEN
        PERFORM public.update_client_retention_metrics(NEW.client_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_client_retention
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.on_appointment_status_change();
