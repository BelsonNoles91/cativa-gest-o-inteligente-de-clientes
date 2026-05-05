-- ============================================================================
-- Bloco B: Convites reais de equipe
-- ============================================================================

-- Status do convite
do $$
begin
  if not exists (select 1 from pg_type where typname = 'team_invitation_status') then
    create type public.team_invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
  end if;
end$$;

-- Tabela principal
create table if not exists public.team_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  status public.team_invitation_status not null default 'pending',
  invited_by uuid,
  accepted_by uuid,
  professional_id uuid references public.professionals(id) on delete set null,
  message text,
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_invitations_email_format check (email ~* '^.+@.+\..+$'),
  constraint team_invitations_role_not_super check (role <> 'super_admin'::public.app_role)
);

-- Único convite pendente por (tenant, email)
create unique index if not exists team_invitations_unique_pending
  on public.team_invitations (tenant_id, lower(email))
  where status = 'pending';

create index if not exists team_invitations_tenant_status_idx
  on public.team_invitations (tenant_id, status);

create index if not exists team_invitations_email_status_idx
  on public.team_invitations (lower(email), status);

-- Trigger updated_at
drop trigger if exists set_updated_at_team_invitations on public.team_invitations;
create trigger set_updated_at_team_invitations
  before update on public.team_invitations
  for each row execute function public.set_updated_at();

-- RLS
alter table public.team_invitations enable row level security;

drop policy if exists "team_invitations: gestor gerencia" on public.team_invitations;
create policy "team_invitations: gestor gerencia"
  on public.team_invitations
  for all
  to authenticated
  using (
    public.has_any_tenant_role(auth.uid(), tenant_id, array['owner'::public.app_role, 'manager'::public.app_role])
    or public.is_super_admin(auth.uid())
  )
  with check (
    public.has_any_tenant_role(auth.uid(), tenant_id, array['owner'::public.app_role, 'manager'::public.app_role])
    or public.is_super_admin(auth.uid())
  );

drop policy if exists "team_invitations: convidado lê próprio" on public.team_invitations;
create policy "team_invitations: convidado lê próprio"
  on public.team_invitations
  for select
  to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ============================================================================
-- Função: aceitar convite via token
-- ============================================================================
create or replace function public.accept_team_invitation(_token text)
returns public.tenant_memberships
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.team_invitations;
  v_existing public.tenant_memberships;
  v_inserted public.tenant_memberships;
  v_pro_count int;
  v_max_pros int;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;
  if v_email = '' then
    raise exception 'E-mail do usuário não disponível na sessão.' using errcode = '22023';
  end if;

  select * into v_invite
    from public.team_invitations
   where token = _token
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

  -- Enforcement: max_professionals quando o papel é "professional"
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

  -- Se já existe membership, apenas reativa/atualiza
  select * into v_existing
    from public.tenant_memberships
   where tenant_id = v_invite.tenant_id and user_id = v_user
   limit 1;

  if found then
    update public.tenant_memberships
       set role = v_invite.role,
           status = 'active',
           updated_at = now()
     where id = v_existing.id
     returning * into v_inserted;
  else
    insert into public.tenant_memberships (tenant_id, user_id, role, status)
    values (v_invite.tenant_id, v_user, v_invite.role, 'active')
    returning * into v_inserted;
  end if;

  -- Atualiza convite
  update public.team_invitations
     set status = 'accepted',
         accepted_by = v_user,
         accepted_at = now(),
         updated_at = now()
   where id = v_invite.id;

  -- Auditoria
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
$$;

-- ============================================================================
-- Função: revogar convite pendente
-- ============================================================================
create or replace function public.revoke_team_invitation(_invitation_id uuid)
returns public.team_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_invite public.team_invitations;
  v_updated public.team_invitations;
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
   where id = _invitation_id
   returning * into v_updated;

  begin
    insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    values (
      v_invite.tenant_id, v_user, 'team.invitation_revoked', 'team_invitation', v_invite.id,
      jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
    );
  exception when others then null;
  end;

  return v_updated;
end;
$$;

-- ============================================================================
-- Função: listar convites pendentes para o usuário corrente (claim)
-- ============================================================================
create or replace function public.list_pending_invitations_for_current_user()
returns setof public.team_invitations
language sql
stable
security definer
set search_path = public
as $$
  select i.*
    from public.team_invitations i
   where i.status = 'pending'
     and i.expires_at > now()
     and lower(i.email) = lower(coalesce(auth.jwt() ->> 'email', ''));
$$;
