-- Helper: cliente autenticado vinculado ao tenant
CREATE OR REPLACE FUNCTION public.is_tenant_client(_user_id uuid, _tenant_id uuid, _client_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = _user_id
      AND cu.tenant_id = _tenant_id
      AND cu.status = 'active'
      AND (_client_id IS NULL OR cu.client_id = _client_id)
  )
$$;

-- ============ Comissões e fechamento ============
CREATE TABLE public.professional_commission_rules (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  percent numeric(5,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  PRIMARY KEY (tenant_id, professional_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_commission_rules TO authenticated;
GRANT ALL ON public.professional_commission_rules TO service_role;
ALTER TABLE public.professional_commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commission rules: membros leem" ON public.professional_commission_rules
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "commission rules: owner e manager gerenciam" ON public.professional_commission_rules
  FOR ALL TO authenticated
  USING (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.professional_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  revenue_cents integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  appointments_count integer NOT NULL DEFAULT 0,
  percent numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  closed_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid,
  UNIQUE (tenant_id, professional_id, period_month)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_closings TO authenticated;
GRANT ALL ON public.professional_closings TO service_role;
ALTER TABLE public.professional_closings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "closings: membros leem" ON public.professional_closings
  FOR SELECT TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));
CREATE POLICY "closings: owner e manager gerenciam" ON public.professional_closings
  FOR ALL TO authenticated
  USING (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()));

-- ============ Cupons de reativação ============
CREATE TABLE public.reactivation_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  code text NOT NULL,
  label text,
  discount_percent integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  redeemed_at timestamptz,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  UNIQUE (tenant_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reactivation_coupons TO authenticated;
GRANT ALL ON public.reactivation_coupons TO service_role;
ALTER TABLE public.reactivation_coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "coupons: equipe le" ON public.reactivation_coupons
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
    OR public.is_tenant_client(auth.uid(), tenant_id, client_id)
  );
CREATE POLICY "coupons: equipe gerencia" ON public.reactivation_coupons
  FOR ALL TO authenticated
  USING (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager','frontdesk']::app_role[]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager','frontdesk']::app_role[]) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_reactivation_coupons_client ON public.reactivation_coupons (tenant_id, client_id, status);

-- ============ Fidelidade ============
CREATE TABLE public.loyalty_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  points_per_visit integer NOT NULL DEFAULT 10,
  points_per_real integer NOT NULL DEFAULT 0,
  reward_threshold_points integer NOT NULL DEFAULT 100,
  reward_description text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_settings TO authenticated;
GRANT ALL ON public.loyalty_settings TO service_role;
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty settings: leitura" ON public.loyalty_settings
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
    OR public.is_tenant_client(auth.uid(), tenant_id)
  );
CREATE POLICY "loyalty settings: owner e manager gerenciam" ON public.loyalty_settings
  FOR ALL TO authenticated
  USING (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.loyalty_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.loyalty_ledger TO authenticated;
GRANT ALL ON public.loyalty_ledger TO service_role;
ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "loyalty ledger: leitura" ON public.loyalty_ledger
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
    OR public.is_tenant_client(auth.uid(), tenant_id, client_id)
  );
CREATE POLICY "loyalty ledger: equipe gerencia" ON public.loyalty_ledger
  FOR ALL TO authenticated
  USING (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager','frontdesk']::app_role[]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager','frontdesk']::app_role[]) OR public.is_super_admin(auth.uid()));
CREATE INDEX idx_loyalty_ledger_client ON public.loyalty_ledger (tenant_id, client_id);

-- ============ Avaliação pós-atendimento ============
CREATE TABLE public.review_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  google_review_url text,
  message_template text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_settings TO authenticated;
GRANT ALL ON public.review_settings TO service_role;
ALTER TABLE public.review_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review settings: leitura" ON public.review_settings
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
    OR public.is_tenant_client(auth.uid(), tenant_id)
  );
CREATE POLICY "review settings: owner e manager gerenciam" ON public.review_settings
  FOR ALL TO authenticated
  USING (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  sent_by uuid,
  outcome text NOT NULL DEFAULT 'sent',
  UNIQUE (tenant_id, appointment_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.review_requests TO authenticated;
GRANT ALL ON public.review_requests TO service_role;
ALTER TABLE public.review_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "review requests: equipe" ON public.review_requests
  FOR ALL TO authenticated
  USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));

-- ============ Anamnese digital ============
CREATE TABLE public.anamnesis_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  intro text,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamnesis_templates TO authenticated;
GRANT ALL ON public.anamnesis_templates TO service_role;
ALTER TABLE public.anamnesis_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anamnese modelos: leitura" ON public.anamnesis_templates
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
    OR public.is_tenant_client(auth.uid(), tenant_id)
  );
CREATE POLICY "anamnese modelos: owner e manager gerenciam" ON public.anamnesis_templates
  FOR ALL TO authenticated
  USING (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()))
  WITH CHECK (public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[]) OR public.is_super_admin(auth.uid()));

CREATE TABLE public.anamnesis_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.anamnesis_templates(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  signature_name text NOT NULL,
  signed_at timestamptz NOT NULL DEFAULT now(),
  signed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anamnesis_responses TO authenticated;
GRANT ALL ON public.anamnesis_responses TO service_role;
ALTER TABLE public.anamnesis_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anamnese respostas: leitura" ON public.anamnesis_responses
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
    OR public.is_tenant_client(auth.uid(), tenant_id, client_id)
  );
CREATE POLICY "anamnese respostas: equipe grava" ON public.anamnesis_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_tenant_client(auth.uid(), tenant_id, client_id)
  );
CREATE INDEX idx_anamnesis_responses_client ON public.anamnesis_responses (tenant_id, client_id);