-- =============================================================================
-- PORTAL DO PROFISSIONAL — agenda própria + pedidos de autorização
-- =============================================================================

-- Helper: o usuário é o profissional dono da ficha?
CREATE OR REPLACE FUNCTION public.is_professional_owner(_user_id uuid, _professional_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.professionals p
    WHERE p.id = _professional_id AND p.user_id = _user_id
  )
$$;

-- Helper: ficha do profissional do usuário logado dentro de um tenant
CREATE OR REPLACE FUNCTION public.current_professional_id(_tenant_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM public.professionals p
  WHERE p.tenant_id = _tenant_id AND p.user_id = auth.uid()
  LIMIT 1
$$;

-- Trigger: profissional só cria/edita janelas dentro do horário de funcionamento
CREATE OR REPLACE FUNCTION public.enforce_availability_within_business_hours()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit uuid;
  v_open time;
  v_close time;
  v_closed boolean;
BEGIN
  -- gestores e super admin não passam pela validação automática
  IF public.has_any_tenant_role(auth.uid(), NEW.tenant_id, array['owner','manager']::public.app_role[])
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF NOT public.is_professional_owner(auth.uid(), NEW.professional_id) THEN
    RAISE EXCEPTION 'Você só pode alterar a sua própria agenda.';
  END IF;

  SELECT COALESCE(NEW.unit_id, p.unit_id) INTO v_unit
  FROM public.professionals p WHERE p.id = NEW.professional_id;

  IF v_unit IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT opens_at, closes_at, is_closed INTO v_open, v_close, v_closed
  FROM public.unit_business_hours
  WHERE tenant_id = NEW.tenant_id AND unit_id = v_unit AND weekday = NEW.weekday
  LIMIT 1;

  IF v_open IS NULL OR v_closed THEN
    RAISE EXCEPTION 'A unidade não abre neste dia. Solicite autorização ao gestor.';
  END IF;

  IF NEW.starts_at < v_open OR NEW.ends_at > v_close THEN
    RAISE EXCEPTION 'Horário fora do funcionamento da unidade (% às %). Solicite autorização ao gestor.', v_open, v_close;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS professional_availability_within_hours ON public.professional_availability;
CREATE TRIGGER professional_availability_within_hours
  BEFORE INSERT OR UPDATE ON public.professional_availability
  FOR EACH ROW EXECUTE FUNCTION public.enforce_availability_within_business_hours();

-- Policies: profissional gerencia a própria disponibilidade
DROP POLICY IF EXISTS "pro_availability: profissional gerencia a própria" ON public.professional_availability;
CREATE POLICY "pro_availability: profissional gerencia a própria"
ON public.professional_availability FOR ALL TO authenticated
USING (
  public.is_tenant_member(auth.uid(), tenant_id)
  AND public.is_professional_owner(auth.uid(), professional_id)
)
WITH CHECK (
  public.is_tenant_member(auth.uid(), tenant_id)
  AND public.is_professional_owner(auth.uid(), professional_id)
);

-- =============================================================================
-- PEDIDOS DE AUTORIZAÇÃO DE AGENDA
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE public.schedule_request_status AS ENUM ('pending','approved','rejected','canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.professional_schedule_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  unit_id         uuid REFERENCES public.units(id) ON DELETE SET NULL,
  weekday         smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at       time NOT NULL,
  ends_at         time NOT NULL,
  reason          text,
  status          public.schedule_request_status NOT NULL DEFAULT 'pending',
  requested_by    uuid,
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  review_note     text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS psr_tenant_status_idx
  ON public.professional_schedule_requests(tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS psr_professional_idx
  ON public.professional_schedule_requests(professional_id, created_at DESC);

DROP TRIGGER IF EXISTS professional_schedule_requests_set_updated_at
  ON public.professional_schedule_requests;
CREATE TRIGGER professional_schedule_requests_set_updated_at
  BEFORE UPDATE ON public.professional_schedule_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_schedule_requests TO authenticated;
GRANT ALL ON public.professional_schedule_requests TO service_role;

ALTER TABLE public.professional_schedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psr: profissional lê os próprios"
ON public.professional_schedule_requests FOR SELECT TO authenticated
USING (
  (public.is_tenant_member(auth.uid(), tenant_id)
    AND public.is_professional_owner(auth.uid(), professional_id))
  OR public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "psr: profissional solicita"
ON public.professional_schedule_requests FOR INSERT TO authenticated
WITH CHECK (
  public.is_tenant_member(auth.uid(), tenant_id)
  AND public.is_professional_owner(auth.uid(), professional_id)
  AND status = 'pending'
  AND requested_by = auth.uid()
);

CREATE POLICY "psr: gestor revisa"
ON public.professional_schedule_requests FOR UPDATE TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "psr: gestor remove"
ON public.professional_schedule_requests FOR DELETE TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  OR public.is_super_admin(auth.uid())
);

-- Aprovação: cria a janela de disponibilidade e marca o pedido como aprovado
CREATE OR REPLACE FUNCTION public.approve_schedule_request(_request_id uuid, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.professional_schedule_requests%ROWTYPE;
  v_availability_id uuid;
BEGIN
  SELECT * INTO r FROM public.professional_schedule_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;

  IF NOT (public.has_any_tenant_role(auth.uid(), r.tenant_id, array['owner','manager']::public.app_role[])
          OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão para aprovar solicitações.';
  END IF;

  IF r.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta solicitação já foi revisada.';
  END IF;

  INSERT INTO public.professional_availability
    (tenant_id, professional_id, unit_id, weekday, starts_at, ends_at)
  VALUES (r.tenant_id, r.professional_id, r.unit_id, r.weekday, r.starts_at, r.ends_at)
  RETURNING id INTO v_availability_id;

  UPDATE public.professional_schedule_requests
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note
  WHERE id = _request_id;

  RETURN v_availability_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_schedule_request(_request_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_tenant FROM public.professional_schedule_requests WHERE id = _request_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;

  IF NOT (public.has_any_tenant_role(auth.uid(), v_tenant, array['owner','manager']::public.app_role[])
          OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Sem permissão para revisar solicitações.';
  END IF;

  UPDATE public.professional_schedule_requests
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), review_note = _note
  WHERE id = _request_id AND status = 'pending';
END;
$$;

REVOKE ALL ON FUNCTION public.approve_schedule_request(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_schedule_request(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_schedule_request(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_schedule_request(uuid, text) TO authenticated, service_role;