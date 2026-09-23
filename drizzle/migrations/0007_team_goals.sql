CREATE TABLE public.professional_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.professionals(id) ON DELETE CASCADE,
  period_month date NOT NULL,
  revenue_goal_cents integer NOT NULL DEFAULT 0,
  appointments_goal integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (tenant_id, professional_id, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.professional_goals TO authenticated;
GRANT ALL ON public.professional_goals TO service_role;

ALTER TABLE public.professional_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals: membros do tenant leem"
ON public.professional_goals
FOR SELECT
TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id) OR public.is_super_admin(auth.uid()));

CREATE POLICY "goals: owner e manager gerenciam"
ON public.professional_goals
FOR ALL
TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::app_role[])
  OR public.is_super_admin(auth.uid())
);

CREATE INDEX professional_goals_tenant_period_idx ON public.professional_goals (tenant_id, period_month);