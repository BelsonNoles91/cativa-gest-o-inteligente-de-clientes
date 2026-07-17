
-- 1) system_incidents: remove public read; restrict to authenticated users
DROP POLICY IF EXISTS "Incidents viewable by everyone" ON public.system_incidents;
CREATE POLICY "Incidents viewable by authenticated"
  ON public.system_incidents
  FOR SELECT
  TO authenticated
  USING (true);

-- 2) team_invitations: prevent invited user (and anyone else) from reading raw token/token_hash via PostgREST.
-- Use column-level privileges: revoke blanket SELECT, then grant SELECT on all columns except token/token_hash.
REVOKE SELECT ON public.team_invitations FROM authenticated;
GRANT SELECT (
  id, tenant_id, email, role, status, invited_by, accepted_by,
  professional_id, message, expires_at, accepted_at, revoked_at,
  created_at, updated_at
) ON public.team_invitations TO authenticated;
-- service_role keeps full access for edge functions that need to validate tokens
GRANT ALL ON public.team_invitations TO service_role;

-- 3) tenant_memberships: add is_super_admin fallback to owner/manager read policy for consistency
DROP POLICY IF EXISTS "memberships: owner/manager veem equipe" ON public.tenant_memberships;
CREATE POLICY "memberships: owner/manager veem equipe"
  ON public.tenant_memberships
  FOR SELECT
  TO authenticated
  USING (
    has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
    OR is_super_admin(auth.uid())
  );
