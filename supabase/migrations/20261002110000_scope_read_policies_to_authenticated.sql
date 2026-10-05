-- Prevent anonymous sessions from reaching authenticated-only read policies.
-- The existing predicates already rejected anon; this narrows the role grant
-- itself while preserving the intended access for signed-in tenant members.

DROP POLICY IF EXISTS "Qualquer membro lê assinatura do tenant"
  ON public.tenant_subscriptions;

CREATE POLICY "Qualquer membro lê assinatura do tenant"
  ON public.tenant_subscriptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.tenant_memberships tm
      WHERE tm.tenant_id = tenant_subscriptions.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_super_admin = true
    )
  );

DROP POLICY IF EXISTS "Qualquer autenticado lê features de planos"
  ON public.plan_features;

CREATE POLICY "Qualquer autenticado lê features de planos"
  ON public.plan_features
  FOR SELECT
  TO authenticated
  USING (true);
