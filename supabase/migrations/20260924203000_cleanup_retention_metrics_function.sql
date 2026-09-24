-- Fase 2: remove variaveis e consultas sem uso apontadas pelo plpgsql_check.
-- O calculo e os campos atualizados permanecem os mesmos.

CREATE OR REPLACE FUNCTION public.update_client_retention_metrics(p_client_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_last_visit TIMESTAMP WITH TIME ZONE;
    v_avg_cycle INTEGER;
    v_last_service_id UUID;
BEGIN
    SELECT
        MAX(starts_at),
        (
            SELECT service_id
            FROM public.appointment_items
            WHERE appointment_id = (
                SELECT id
                FROM public.appointments
                WHERE client_id = p_client_id
                  AND status = 'completed'
                ORDER BY starts_at DESC
                LIMIT 1
            )
            LIMIT 1
        )
    INTO v_last_visit, v_last_service_id
    FROM public.appointments
    WHERE client_id = p_client_id
      AND status = 'completed';

    WITH visit_gaps AS (
        SELECT
            starts_at,
            LAG(starts_at) OVER (ORDER BY starts_at) AS prev_starts_at
        FROM public.appointments
        WHERE client_id = p_client_id
          AND status = 'completed'
        ORDER BY starts_at DESC
        LIMIT 5
    )
    SELECT AVG(EXTRACT(DAY FROM (starts_at - prev_starts_at)))::INTEGER
    INTO v_avg_cycle
    FROM visit_gaps
    WHERE prev_starts_at IS NOT NULL;

    UPDATE public.clients
    SET last_visit_at = v_last_visit,
        average_cycle_days = v_avg_cycle,
        last_service_id = v_last_service_id,
        updated_at = now()
    WHERE id = p_client_id;
END;
$$;
