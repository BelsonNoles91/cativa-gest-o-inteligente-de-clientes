-- A policy "team_invitations: convidado lê próprio" consultava auth.users
-- diretamente, o que faz qualquer SELECT em team_invitations falhar com
-- "permission denied for table users" para o papel authenticated.
-- Trocamos por uma função SECURITY DEFINER dedicada.

CREATE OR REPLACE FUNCTION public.current_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(u.email::text)
  FROM auth.users u
  WHERE u.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.current_auth_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_auth_email() TO authenticated, service_role;

DROP POLICY IF EXISTS "team_invitations: convidado lê próprio" ON public.team_invitations;

CREATE POLICY "team_invitations: convidado lê próprio"
ON public.team_invitations
FOR SELECT
TO authenticated
USING (lower(email) = public.current_auth_email());
