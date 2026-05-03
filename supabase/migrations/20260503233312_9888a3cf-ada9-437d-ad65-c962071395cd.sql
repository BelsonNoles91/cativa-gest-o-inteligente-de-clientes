-- Replace JWT email claim trust with verified auth.users.email lookup

-- 1) RLS policy on team_invitations
DROP POLICY IF EXISTS "team_invitations: convidado lê próprio" ON public.team_invitations;
CREATE POLICY "team_invitations: convidado lê próprio"
  ON public.team_invitations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = auth.uid()
        AND lower(u.email) = lower(team_invitations.email)
    )
  );

-- 2) accept_team_invitation
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
         token = NULL,
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

-- 3) lookup_team_invitation
CREATE OR REPLACE FUNCTION public.lookup_team_invitation(_token text)
 RETURNS TABLE(id uuid, tenant_id uuid, email text, role app_role, status team_invitation_status, expires_at timestamp with time zone, message text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = auth.uid();
  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  RETURN QUERY
    SELECT i.id, i.tenant_id, i.email, i.role, i.status, i.expires_at, i.message
    FROM public.team_invitations i
    WHERE i.token_hash = v_hash
      AND lower(i.email) = v_email
    LIMIT 1;
END;
$function$;