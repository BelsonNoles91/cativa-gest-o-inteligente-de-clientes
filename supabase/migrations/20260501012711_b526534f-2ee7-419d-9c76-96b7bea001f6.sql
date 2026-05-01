-- 1. Tabela de Campanhas de Reativação
CREATE TABLE IF NOT EXISTS public.reactivation_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
    min_ltv_cents BIGINT, -- Filtro opcional por valor
    max_days_inactive INT DEFAULT 60,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.reactivation_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage campaigns of their tenant"
    ON public.reactivation_campaigns
    FOR ALL
    USING (auth.uid() IN (SELECT user_id FROM public.tenant_memberships WHERE tenant_id = reactivation_campaigns.tenant_id AND status = 'active'));

-- 2. Função para identificar clientes que precisam de reativação e movê-los para a fila
CREATE OR REPLACE FUNCTION public.process_client_reactivation(_tenant_id uuid)
RETURNS TABLE (
    client_id uuid,
    full_name text,
    days_inactive int,
    estimated_ltv float8
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id, 
        c.full_name, 
        extract(day from now() - c.last_visit_at)::int as days_inactive,
        public.get_tenant_ltv_estimate(_tenant_id) as estimated_ltv -- Simplificado: ltv médio do tenant para priorização
    FROM public.clients c
    WHERE c.tenant_id = _tenant_id
      AND c.status = 'active'
      AND c.last_visit_at IS NOT NULL
      AND c.last_visit_at < now() - interval '45 days' -- Fora da janela ideal (21-45 dias)
      AND NOT EXISTS (
          -- Não ter agendamento futuro
          SELECT 1 FROM public.appointments a 
          WHERE a.client_id = c.id 
            AND a.status NOT IN ('canceled', 'no_show')
            AND a.starts_at > now()
      )
      AND NOT EXISTS (
          -- Não estar já na fila de recuperação
          SELECT 1 FROM public.confirmation_queue q
          WHERE q.client_id = c.id
            AND q.stage = 'recovery'
            AND q.status NOT IN ('closed', 'confirmed', 'canceled')
      );
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- 3. Procedure para gerar itens na fila de confirmação (Recovery)
CREATE OR REPLACE FUNCTION public.generate_reactivation_tasks(_tenant_id uuid)
RETURNS int AS $$
DECLARE
    v_count int := 0;
    v_client record;
BEGIN
    FOR v_client IN SELECT * FROM public.process_client_reactivation(_tenant_id) LOOP
        INSERT INTO public.confirmation_queue (
            tenant_id,
            client_id,
            stage,
            status,
            priority,
            appointment_starts_at, -- Usamos a última visita como referência
            notes
        ) VALUES (
            _tenant_id,
            v_client.client_id,
            'recovery',
            'pending',
            CASE WHEN v_client.estimated_ltv > 500 THEN 80 ELSE 40 END, -- Prioriza alto valor
            now(), -- Para aparecer na fila de hoje
            'Cliente inativo há ' || v_client.days_inactive || ' dias. Janela ideal ultrapassada.'
        );
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql VOLATILE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.generate_reactivation_tasks(uuid) TO authenticated;
