-- Corrige ambiguidade entre a coluna team_invitations.id e o parâmetro de
-- saída id em funções RETURNS TABLE.

CREATE OR REPLACE FUNCTION public.create_team_invitation(
  _tenant_id uuid,
  _email text,
  _role app_role,
  _message text DEFAULT NULL,
  _expires_in_days int DEFAULT 14
)
RETURNS TABLE (
  id uuid,
  token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_token text;
  v_invite public.team_invitations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;
  IF NOT (
    public.has_any_tenant_role(v_user, _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para convidar nesta loja' USING errcode = '42501';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel inválido para convite' USING errcode = '22023';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.team_invitations (
    tenant_id, email, role, invited_by, message, expires_at, token
  ) VALUES (
    _tenant_id, lower(_email), _role, v_user, _message,
    now() + make_interval(days => GREATEST(_expires_in_days, 1)),
    v_token
  )
  RETURNING * INTO v_invite;

  UPDATE public.team_invitations
     SET token = NULL
   WHERE public.team_invitations.id = v_invite.id;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, v_user, 'team.invitation_created', 'team_invitation', v_invite.id,
            jsonb_build_object('email', lower(_email), 'role', _role));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  id := v_invite.id;
  token := v_token;
  expires_at := v_invite.expires_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_team_invitation(uuid, text, app_role, text, int) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_provision_team_invitation(
  _tenant_id uuid,
  _email text,
  _role app_role,
  _message text DEFAULT NULL,
  _expires_in_days int DEFAULT 14
)
RETURNS TABLE (
  id uuid,
  token text,
  email text,
  role app_role,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_invite public.team_invitations;
  v_existing public.team_invitations;
  v_tenant public.tenants;
  v_token text;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode provisionar usuários' USING errcode = '42501';
  END IF;
  IF v_email IS NULL OR v_email !~ '^.+@.+\..+$' THEN
    RAISE EXCEPTION 'E-mail inválido' USING errcode = '22023';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel inválido para convite de equipe' USING errcode = '22023';
  END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE public.tenants.id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING errcode = 'P0002';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  SELECT * INTO v_existing
    FROM public.team_invitations
   WHERE public.team_invitations.tenant_id = _tenant_id
     AND lower(public.team_invitations.email) = v_email
     AND public.team_invitations.status = 'pending'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.team_invitations
       SET role = _role,
           message = COALESCE(_message, public.team_invitations.message),
           expires_at = now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
           token = v_token,
           updated_at = now()
     WHERE public.team_invitations.id = v_existing.id
     RETURNING * INTO v_invite;
  ELSE
    INSERT INTO public.team_invitations (
      tenant_id, email, role, invited_by, message, expires_at, token
    ) VALUES (
      _tenant_id, v_email, _role, auth.uid(), _message,
      now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
      v_token
    )
    RETURNING * INTO v_invite;
  END IF;

  UPDATE public.team_invitations
     SET token = NULL
   WHERE public.team_invitations.id = v_invite.id;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, auth.uid(),
            'admin.team.invitation_provisioned', 'team_invitation', v_invite.id,
            jsonb_build_object('email', v_email, 'role', _role));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  id := v_invite.id;
  token := v_token;
  email := v_invite.email;
  role := v_invite.role;
  expires_at := v_invite.expires_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_provision_team_invitation(uuid, text, app_role, text, integer) TO authenticated;
