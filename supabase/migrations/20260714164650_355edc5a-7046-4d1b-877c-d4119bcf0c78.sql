
-- 1) Reactivation RPCs: tenant membership guard
CREATE OR REPLACE FUNCTION public.get_tenant_ltv_estimate(_tenant_id uuid)
RETURNS float8
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_result float8;
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_tenant_member(auth.uid(), _tenant_id) OR public.is_super_admin(auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado a este estabelecimento.' USING ERRCODE = '42501';
    END IF;

    SELECT COALESCE(AVG(total_price_cents)::float8 / 100.0, 0)
      INTO v_result
      FROM public.appointments
     WHERE tenant_id = _tenant_id
       AND status = 'completed';

    RETURN COALESCE(v_result, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_ltv_estimate(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.process_client_reactivation(_tenant_id uuid)
RETURNS TABLE (
    client_id uuid,
    full_name text,
    days_inactive int,
    estimated_ltv float8
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_tenant_member(auth.uid(), _tenant_id) OR public.is_super_admin(auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado a este estabelecimento.' USING ERRCODE = '42501';
    END IF;

    RETURN QUERY
    SELECT
        c.id,
        c.full_name,
        extract(day from now() - c.last_visit_at)::int as days_inactive,
        public.get_tenant_ltv_estimate(_tenant_id) as estimated_ltv
    FROM public.clients c
    WHERE c.tenant_id = _tenant_id
      AND c.status = 'active'
      AND c.last_visit_at IS NOT NULL
      AND c.last_visit_at < now() - interval '45 days'
      AND NOT EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.client_id = c.id
            AND a.status NOT IN ('canceled', 'no_show')
            AND a.starts_at > now()
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.confirmation_queue q
          WHERE q.client_id = c.id
            AND q.stage = 'recovery'
            AND q.status NOT IN ('closed', 'confirmed', 'canceled')
      );
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_reactivation_tasks(_tenant_id uuid)
RETURNS int
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count int := 0;
    v_client record;
BEGIN
    IF auth.uid() IS NULL OR NOT (public.is_tenant_member(auth.uid(), _tenant_id) OR public.is_super_admin(auth.uid())) THEN
        RAISE EXCEPTION 'Acesso negado a este estabelecimento.' USING ERRCODE = '42501';
    END IF;

    FOR v_client IN SELECT * FROM public.process_client_reactivation(_tenant_id) LOOP
        INSERT INTO public.confirmation_queue (
            tenant_id,
            client_id,
            stage,
            status,
            priority,
            appointment_starts_at,
            notes
        ) VALUES (
            _tenant_id,
            v_client.client_id,
            'recovery',
            'pending',
            CASE WHEN v_client.estimated_ltv > 500 THEN 80 ELSE 40 END,
            now(),
            'Cliente inativo há ' || v_client.days_inactive || ' dias. Janela ideal ultrapassada.'
        );
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_reactivation_tasks(uuid) TO authenticated;

-- 2) team_invitations SELECT policy: restrict to authenticated role
DROP POLICY IF EXISTS "team_invitations: convidado lê próprio" ON public.team_invitations;
CREATE POLICY "team_invitations: convidado lê próprio"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND lower(u.email) = lower(team_invitations.email)
    )
  );
