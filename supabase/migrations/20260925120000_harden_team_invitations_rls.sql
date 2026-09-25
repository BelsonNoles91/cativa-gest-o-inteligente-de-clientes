-- Harden team invitations against direct anonymous access and avoid requiring
-- authenticated sessions to read auth.users from an RLS policy.

-- Anonymous clients do not need direct access to invitation rows. Token based
-- invitation flows are handled by SECURITY DEFINER RPCs / edge functions.
REVOKE ALL PRIVILEGES ON TABLE public.team_invitations FROM anon;

-- Keep authenticated reads restricted to non-sensitive columns. The blanket
-- SELECT revoke is repeated here so this migration is safe after older grants.
REVOKE SELECT ON TABLE public.team_invitations FROM authenticated;
GRANT SELECT (
  id, tenant_id, email, role, status, invited_by, accepted_by,
  professional_id, message, expires_at, accepted_at, revoked_at,
  created_at, updated_at
) ON TABLE public.team_invitations TO authenticated;

-- Service role remains the only API role allowed to read invitation secrets.
GRANT ALL PRIVILEGES ON TABLE public.team_invitations TO service_role;

DROP POLICY IF EXISTS "team_invitations: convidado lê próprio" ON public.team_invitations;
CREATE POLICY "team_invitations: convidado lê próprio"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    AND coalesce(auth.jwt() ->> 'email', '') <> ''
  );
