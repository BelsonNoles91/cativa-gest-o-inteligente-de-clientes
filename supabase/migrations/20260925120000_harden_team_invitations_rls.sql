-- Harden team invitations end-to-end:
--   * no anonymous table/RPC access;
--   * authenticated clients can only SELECT non-secret columns;
--   * token/token_hash never leave list/admin/revoke RPCs;
--   * plaintext tokens exist only in the immediate create/provision response;
--   * invitation UUID may be used as a non-secret continuation handle only by
--     the authenticated user whose auth.users e-mail matches the invitation.

-- ---------------------------------------------------------------------------
-- Table privileges and RLS
-- ---------------------------------------------------------------------------

REVOKE ALL PRIVILEGES ON TABLE public.team_invitations FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.team_invitations FROM authenticated;

GRANT SELECT (
  id, tenant_id, email, role, status, invited_by, accepted_by,
  professional_id, message, expires_at, accepted_at, revoked_at,
  created_at, updated_at
) ON TABLE public.team_invitations TO authenticated;

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

-- ---------------------------------------------------------------------------
-- Invitation lookup / acceptance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.lookup_team_invitation(_token text)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  email text,
  role public.app_role,
  status public.team_invitation_status,
  expires_at timestamptz,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_email text;
  v_hash text;
BEGIN
  IF v_user IS NULL OR _token IS NULL OR btrim(_token) = '' THEN
    RETURN;
  END IF;

  SELECT lower(u.email::text)
    INTO v_user_email
    FROM auth.users u
   WHERE u.id = v_user;

  IF v_user_email IS NULL OR v_user_email = '' THEN
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.email, i.role, i.status, i.expires_at, i.message
    FROM public.team_invitations i
   WHERE lower(i.email) = v_user_email
     AND (
       i.token_hash = v_hash
       OR i.id::text = _token
     )
   LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS public.tenant_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_email text;
  v_invite public.team_invitations;
  v_existing public.tenant_memberships;
  v_inserted public.tenant_memberships;
  v_pro_count int;
  v_max_pros int;
  v_hash text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;
  IF _token IS NULL OR btrim(_token) = '' THEN
    RAISE EXCEPTION 'Convite não encontrado.' USING errcode = 'P0002';
  END IF;

  SELECT lower(u.email::text)
    INTO v_email
    FROM auth.users u
   WHERE u.id = v_user;

  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'E-mail do usuário não disponível na sessão.' USING errcode = '22023';
  END IF;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  SELECT i.*
    INTO v_invite
    FROM public.team_invitations i
   WHERE lower(i.email) = v_email
     AND (
       i.token_hash = v_hash
       OR i.id::text = _token
     )
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.' USING errcode = 'P0002';
  END IF;

  IF v_invite.status = 'accepted' THEN
    RAISE EXCEPTION 'Este convite já foi aceito.' USING errcode = '22023';
  ELSIF v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'Este convite foi cancelado.' USING errcode = '22023';
  ELSIF v_invite.status = 'expired' OR v_invite.expires_at <= now() THEN
    UPDATE public.team_invitations
       SET status = 'expired', updated_at = now()
     WHERE id = v_invite.id AND status = 'pending';
    RAISE EXCEPTION 'Este convite expirou.' USING errcode = '22023';
  END IF;

  IF v_invite.role = 'professional'::public.app_role THEN
    SELECT coalesce((public.effective_subscription_limits(v_invite.tenant_id) ->> 'max_professionals')::int, 0)
      INTO v_max_pros;
    IF v_max_pros > 0 THEN
      SELECT count(*)
        INTO v_pro_count
        FROM public.tenant_memberships
       WHERE tenant_id = v_invite.tenant_id
         AND status = 'active'
         AND role = 'professional'::public.app_role;
      IF v_pro_count >= v_max_pros THEN
        RAISE EXCEPTION 'Limite de profissionais do plano atingido (%/%).', v_pro_count, v_max_pros
          USING errcode = 'P0001';
      END IF;
    END IF;
  END IF;

  SELECT tm.*
    INTO v_existing
    FROM public.tenant_memberships tm
   WHERE tm.tenant_id = v_invite.tenant_id
     AND tm.user_id = v_user
   LIMIT 1;

  IF FOUND THEN
    UPDATE public.tenant_memberships
       SET role = v_invite.role, status = 'active', updated_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_inserted;
  ELSE
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
    VALUES (v_invite.tenant_id, v_user, v_invite.role, 'active')
    RETURNING * INTO v_inserted;
  END IF;

  UPDATE public.team_invitations
     SET status = 'accepted',
         accepted_by = v_user,
         accepted_at = now(),
         token = NULL,
         updated_at = now()
   WHERE id = v_invite.id;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
      v_invite.tenant_id,
      v_user,
      'team.invitation_accepted',
      'team_invitation',
      v_invite.id,
      jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_inserted;
END;
$$;

-- ---------------------------------------------------------------------------
-- Safe list / revoke results
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.list_pending_invitations_for_current_user();
CREATE FUNCTION public.list_pending_invitations_for_current_user()
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  email text,
  role public.app_role,
  status public.team_invitation_status,
  message text,
  expires_at timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_user_email text;
BEGIN
  IF v_user IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(u.email::text)
    INTO v_user_email
    FROM auth.users u
   WHERE u.id = v_user;

  IF v_user_email IS NULL OR v_user_email = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT i.id, i.tenant_id, i.email, i.role, i.status, i.message, i.expires_at, i.created_at
    FROM public.team_invitations i
   WHERE i.status = 'pending'
     AND i.expires_at > now()
     AND lower(i.email) = v_user_email
   ORDER BY i.created_at DESC;
END;
$$;

DROP FUNCTION IF EXISTS public.revoke_team_invitation(uuid);
CREATE FUNCTION public.revoke_team_invitation(_invitation_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_invite public.team_invitations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.' USING errcode = '42501';
  END IF;

  SELECT i.*
    INTO v_invite
    FROM public.team_invitations i
   WHERE i.id = _invitation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado.' USING errcode = 'P0002';
  END IF;

  IF NOT (
    public.has_any_tenant_role(
      v_user,
      v_invite.tenant_id,
      ARRAY['owner'::public.app_role, 'manager'::public.app_role]
    )
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para revogar este convite.' USING errcode = '42501';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'Apenas convites pendentes podem ser revogados.' USING errcode = '22023';
  END IF;

  UPDATE public.team_invitations
     SET status = 'revoked', revoked_at = now(), updated_at = now()
   WHERE id = _invitation_id;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
      v_invite.tenant_id,
      v_user,
      'team.invitation_revoked',
      'team_invitation',
      v_invite.id,
      jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN _invitation_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Super-admin list without persisted invitation secrets
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.admin_list_team_invitations(uuid);
CREATE FUNCTION public.admin_list_team_invitations(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  tenant_name text,
  email text,
  role public.app_role,
  status text,
  invited_by uuid,
  inviter_name text,
  message text,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin' USING errcode = '42501';
  END IF;

  RETURN QUERY
  SELECT
    i.id,
    i.tenant_id,
    t.name,
    i.email,
    i.role,
    i.status::text,
    i.invited_by,
    p.full_name,
    i.message,
    i.expires_at,
    i.created_at,
    i.updated_at
  FROM public.team_invitations i
  LEFT JOIN public.tenants t ON t.id = i.tenant_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE _tenant_id IS NULL OR i.tenant_id = _tenant_id
  ORDER BY i.created_at DESC;
END;
$$;

-- ---------------------------------------------------------------------------
-- RPC execution privileges
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.accept_team_invitation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lookup_team_invitation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_pending_invitations_for_current_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_team_invitation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_team_invitation(uuid, text, public.app_role, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_provision_team_invitation(uuid, text, public.app_role, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_team_invitations(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.team_invitations_hash_token() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.accept_team_invitation(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lookup_team_invitation(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_pending_invitations_for_current_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_team_invitation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_team_invitation(uuid, text, public.app_role, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_provision_team_invitation(uuid, text, public.app_role, text, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_team_invitations(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.team_invitations_hash_token() TO service_role;
