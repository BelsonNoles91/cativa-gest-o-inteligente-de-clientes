-- 1) Coluna de token em plaintext marcada como obsoleta e sem acesso
COMMENT ON COLUMN public.team_invitations.token IS 'DEPRECATED: nunca preenchida; o token só existe no retorno da RPC. Use token_hash (apenas service_role).';
REVOKE ALL (token, token_hash) ON public.team_invitations FROM anon, authenticated;
UPDATE public.team_invitations SET token = NULL WHERE token IS NOT NULL;

-- 2) create_team_invitation: grava apenas o hash
CREATE OR REPLACE FUNCTION public.create_team_invitation(_tenant_id uuid, _email text, _role app_role, _message text DEFAULT NULL::text, _expires_in_days integer DEFAULT 14)
 RETURNS TABLE(id uuid, token text, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    tenant_id, email, role, invited_by, message, expires_at, token_hash
  ) VALUES (
    _tenant_id, lower(_email), _role, v_user, _message,
    now() + make_interval(days => GREATEST(_expires_in_days, 1)),
    encode(extensions.digest(v_token, 'sha256'), 'hex')
  )
  RETURNING * INTO v_invite;

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
$function$;

-- 3) admin_provision_team_invitation: idem
CREATE OR REPLACE FUNCTION public.admin_provision_team_invitation(_tenant_id uuid, _email text, _role app_role, _message text DEFAULT NULL::text, _expires_in_days integer DEFAULT 14)
 RETURNS TABLE(id uuid, token text, email text, role app_role, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT * INTO v_tenant FROM public.tenants WHERE id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant não encontrado' USING errcode = 'P0002';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  SELECT * INTO v_existing
    FROM public.team_invitations
   WHERE tenant_id = _tenant_id AND lower(email) = v_email AND status = 'pending'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.team_invitations
       SET role = _role,
           message = COALESCE(_message, message),
           expires_at = now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
           token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex'),
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_invite;
  ELSE
    INSERT INTO public.team_invitations (
      tenant_id, email, role, invited_by, message, expires_at, token_hash
    ) VALUES (
      _tenant_id, v_email, _role, auth.uid(), _message,
      now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
      encode(extensions.digest(v_token, 'sha256'), 'hex')
    )
    RETURNING * INTO v_invite;
  END IF;

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
$function$;

-- 4) accept_team_invitation: limpa o hash ao aceitar
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
 RETURNS tenant_memberships
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_email text;
  v_invite public.team_invitations;
  v_existing public.tenant_memberships;
  v_inserted public.tenant_memberships;
  v_pro_count int;
  v_max_pros int;
  v_hash text;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select lower(email) into v_email from auth.users where id = v_user;

  if v_email is null or v_email = '' then
    raise exception 'E-mail do usuário não disponível na sessão.' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  select * into v_invite
    from public.team_invitations
   where token_hash = v_hash
   limit 1;

  if not found then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'Este convite já foi aceito.' using errcode = '22023';
  elsif v_invite.status = 'revoked' then
    raise exception 'Este convite foi cancelado.' using errcode = '22023';
  elsif v_invite.status = 'expired' or v_invite.expires_at <= now() then
    update public.team_invitations
       set status = 'expired', updated_at = now()
     where id = v_invite.id and status = 'pending';
    raise exception 'Este convite expirou.' using errcode = '22023';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'O convite foi emitido para outro e-mail.' using errcode = '42501';
  end if;

  if v_invite.role = 'professional'::public.app_role then
    select coalesce((public.effective_subscription_limits(v_invite.tenant_id) ->> 'max_professionals')::int, 0)
      into v_max_pros;
    if v_max_pros > 0 then
      select count(*) into v_pro_count
        from public.tenant_memberships
       where tenant_id = v_invite.tenant_id
         and status = 'active'
         and role = 'professional'::public.app_role;
      if v_pro_count >= v_max_pros then
        raise exception 'Limite de profissionais do plano atingido (%/%).', v_pro_count, v_max_pros
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  select * into v_existing
    from public.tenant_memberships
   where tenant_id = v_invite.tenant_id and user_id = v_user
   limit 1;

  if found then
    update public.tenant_memberships
       set role = v_invite.role, status = 'active', updated_at = now()
     where id = v_existing.id
     returning * into v_inserted;
  else
    insert into public.tenant_memberships (tenant_id, user_id, role, status)
    values (v_invite.tenant_id, v_user, v_invite.role, 'active')
    returning * into v_inserted;
  end if;

  update public.team_invitations
     set status = 'accepted', accepted_by = v_user, accepted_at = now(),
         token = NULL, token_hash = NULL,
         updated_at = now()
   where id = v_invite.id;

  begin
    insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    values (
      v_invite.tenant_id, v_user, 'team.invitation_accepted', 'team_invitation', v_invite.id,
      jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
    );
  exception when others then null;
  end;

  return v_inserted;
end;
$function$;

-- 5) admin_list_team_invitations: nunca devolve token
CREATE OR REPLACE FUNCTION public.admin_list_team_invitations(_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, tenant_name text, email text, role app_role, status text, token text, invited_by uuid, inviter_name text, message text, expires_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    i.id,
    i.tenant_id,
    t.name,
    i.email,
    i.role,
    i.status::text,
    NULL::text AS token,
    i.invited_by,
    p.full_name,
    i.message,
    i.expires_at,
    i.created_at,
    i.updated_at
  FROM public.team_invitations i
  LEFT JOIN public.tenants t ON t.id = i.tenant_id
  LEFT JOIN public.profiles p ON p.id = i.invited_by
  WHERE public.is_super_admin(auth.uid())
    AND (_tenant_id IS NULL OR i.tenant_id = _tenant_id)
  ORDER BY i.created_at DESC;
$function$;

-- 6) list_pending_invitations_for_current_user: colunas explícitas (sem token/token_hash)
DROP FUNCTION IF EXISTS public.list_pending_invitations_for_current_user();
CREATE FUNCTION public.list_pending_invitations_for_current_user()
 RETURNS TABLE(id uuid, tenant_id uuid, email text, role app_role, status team_invitation_status, message text, expires_at timestamp with time zone, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select i.id, i.tenant_id, i.email, i.role, i.status, i.message, i.expires_at, i.created_at
    from public.team_invitations i
   where i.status = 'pending'
     and i.expires_at > now()
     and lower(i.email) = public.current_auth_email();
$function$;
GRANT EXECUTE ON FUNCTION public.list_pending_invitations_for_current_user() TO authenticated;

-- 7) revoke_team_invitation: não devolve a linha completa (evita expor token_hash)
DROP FUNCTION IF EXISTS public.revoke_team_invitation(uuid);
CREATE FUNCTION public.revoke_team_invitation(_invitation_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_invite public.team_invitations;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;

  select * into v_invite from public.team_invitations where id = _invitation_id;
  if not found then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;

  if not (
    public.has_any_tenant_role(v_user, v_invite.tenant_id, array['owner'::public.app_role, 'manager'::public.app_role])
    or public.is_super_admin(v_user)
  ) then
    raise exception 'Sem permissão para revogar este convite.' using errcode = '42501';
  end if;

  if v_invite.status <> 'pending' then
    raise exception 'Apenas convites pendentes podem ser revogados.' using errcode = '22023';
  end if;

  update public.team_invitations
     set status = 'revoked', revoked_at = now(), updated_at = now()
   where id = _invitation_id;

  begin
    insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    values (
      v_invite.tenant_id, v_user, 'team.invitation_revoked', 'team_invitation', v_invite.id,
      jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
    );
  exception when others then null;
  end;

  return _invitation_id;
end;
$function$;
GRANT EXECUTE ON FUNCTION public.revoke_team_invitation(uuid) TO authenticated;
