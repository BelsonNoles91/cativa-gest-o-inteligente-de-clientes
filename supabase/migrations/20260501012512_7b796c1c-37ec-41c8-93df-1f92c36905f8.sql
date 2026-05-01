-- Função para calcular estimativa de LTV médio do tenant
CREATE OR REPLACE FUNCTION public.get_tenant_ltv_estimate(_tenant_id uuid)
RETURNS float8 AS $$
DECLARE
  v_ticket_avg float8;
  v_frequency float8;
  v_total_completed bigint;
  v_unique_clients bigint;
BEGIN
  -- 1. Ticket Médio (últimos 90 dias para estabilidade)
  SELECT COALESCE(AVG(total_price_cents), 0) / 100.0 INTO v_ticket_avg
  FROM public.appointments
  WHERE tenant_id = _tenant_id
    AND status = 'completed'
    AND starts_at >= now() - interval '90 days';

  -- 2. Frequência Média (Visitas por cliente nos últimos 90 dias)
  SELECT COUNT(*), COUNT(DISTINCT client_id) INTO v_total_completed, v_unique_clients
  FROM public.appointments
  WHERE tenant_id = _tenant_id
    AND status = 'completed'
    AND starts_at >= now() - interval '90 days';

  IF v_unique_clients = 0 THEN
    RETURN 0;
  END IF;

  v_frequency := (v_total_completed::float8 / v_unique_clients::float8) / 3.0; -- visitas/mês

  -- 3. LTV = Ticket x Freq x 12 meses
  RETURN ROUND(v_ticket_avg * v_frequency * 12.0);
END;
$$ LANGUAGE plpgsql STABLE SET search_path = public;

-- Garantir que a função seja acessível via RPC
GRANT EXECUTE ON FUNCTION public.get_tenant_ltv_estimate(uuid) TO authenticated;
