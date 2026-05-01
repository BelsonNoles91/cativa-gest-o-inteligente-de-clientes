-- 1) Drop weak JWT-claim-based policies on audit_logs (verified helpers cover access)
DROP POLICY IF EXISTS "audit_logs_super_admin_all" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_tenant_isolation" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view audit logs of their tenant" ON public.audit_logs;

-- 2) Harden reactivation_campaigns
-- Make tenant_id NOT NULL (delete orphan rows first to avoid migration failure)
DELETE FROM public.reactivation_campaigns WHERE tenant_id IS NULL;
ALTER TABLE public.reactivation_campaigns ALTER COLUMN tenant_id SET NOT NULL;

-- Replace permissive policy with role-scoped one limited to authenticated users
DROP POLICY IF EXISTS "Users can manage campaigns of their tenant" ON public.reactivation_campaigns;

CREATE POLICY "reactivation_campaigns: gestor gerencia"
ON public.reactivation_campaigns
FOR ALL
TO authenticated
USING (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "reactivation_campaigns: equipe lê"
ON public.reactivation_campaigns
FOR SELECT
TO authenticated
USING (
  public.is_tenant_member(auth.uid(), tenant_id)
  OR public.is_super_admin(auth.uid())
);