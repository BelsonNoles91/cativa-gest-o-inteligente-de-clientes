-- Fix: column reference "email" ambiguity in lookup_team_invitation
-- The RETURNS TABLE(email text) conflicts with the local SELECT lower(email)
-- from auth.users. We alias the user email variable to avoid ambiguity.

CREATE OR REPLACE FUNCTION public.lookup_team_invitation(_token text)
 RETURNS TABLE(id uuid, tenant_id uuid, email text, role app_role, status team_invitation_status, expires_at timestamp with time zone, message text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_email text;
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(u.email) INTO v_user_email FROM auth.users u WHERE u.id = auth.uid();
  IF v_user_email IS NULL OR v_user_email = '' THEN
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  RETURN QUERY
    SELECT i.id, i.tenant_id, i.email, i.role, i.status, i.expires_at, i.message
    FROM public.team_invitations i
    WHERE i.token_hash = v_hash
      AND lower(i.email) = v_user_email
    LIMIT 1;
END;
$function$;
