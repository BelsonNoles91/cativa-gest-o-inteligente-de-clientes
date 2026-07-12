DROP POLICY IF EXISTS "memberships: criar membership" ON public.tenant_memberships;

CREATE POLICY "memberships: criar membership"
ON public.tenant_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  (
    user_id = auth.uid()
    AND role = 'owner'::app_role
    AND EXISTS (
      SELECT 1 FROM public.tenants t
      WHERE t.id = tenant_memberships.tenant_id
        AND t.created_by = auth.uid()
    )
  )
  OR has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
  OR is_super_admin(auth.uid())
);