-- =============================================================================
-- Cativa — Etapa 2 — Base multi-tenant + RLS
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type public.app_role as enum (
  'super_admin', 'owner', 'manager', 'frontdesk', 'professional', 'client'
);

create type public.tenant_segment as enum (
  'salao', 'clinica_estetica', 'lash_brow', 'barbearia', 'esmalteria', 'wellness'
);

create type public.tenant_status as enum ('trialing', 'active', 'past_due', 'canceled', 'suspended');
create type public.membership_status as enum ('active', 'invited', 'suspended');

-- -----------------------------------------------------------------------------
-- HELPER: updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- PROFILES (1:1 com auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  full_name     text,
  avatar_url    text,
  phone         text,
  is_super_admin boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Auto-cria profile quando um novo usuário é criado em auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- TENANTS
-- -----------------------------------------------------------------------------
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  segment       public.tenant_segment not null,
  status        public.tenant_status not null default 'trialing',
  timezone      text not null default 'America/Sao_Paulo',
  currency      text not null default 'BRL',
  locale        text not null default 'pt-BR',
  trial_ends_at timestamptz,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- UNITS
-- -----------------------------------------------------------------------------
create table public.units (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  name          text not null,
  is_default    boolean not null default false,
  address_line1 text,
  address_line2 text,
  city          text,
  state         text,
  postal_code   text,
  country       text default 'BR',
  phone         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index units_tenant_idx on public.units(tenant_id);

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- TENANT MEMBERSHIPS
-- -----------------------------------------------------------------------------
create table public.tenant_memberships (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          public.app_role not null,
  status        public.membership_status not null default 'active',
  invited_email text,
  invited_at    timestamptz,
  accepted_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index tenant_memberships_user_idx on public.tenant_memberships(user_id);
create index tenant_memberships_tenant_idx on public.tenant_memberships(tenant_id);

create trigger tenant_memberships_set_updated_at
before update on public.tenant_memberships
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- PERMISSIONS catalog + ROLE_PERMISSIONS map
-- -----------------------------------------------------------------------------
create table public.permissions (
  key         text primary key,
  description text not null,
  created_at  timestamptz not null default now()
);

create table public.role_permissions (
  role           public.app_role not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  primary key (role, permission_key)
);

-- Catálogo inicial
insert into public.permissions (key, description) values
  ('tenant.read',       'Visualizar dados do estabelecimento'),
  ('tenant.update',     'Editar dados do estabelecimento'),
  ('units.manage',      'Gerenciar unidades'),
  ('team.manage',       'Gerenciar equipe e convites'),
  ('settings.update',   'Atualizar configurações e branding'),
  ('clients.manage',    'Gerenciar clientes'),
  ('appointments.manage','Gerenciar agendamentos'),
  ('appointments.read', 'Visualizar agendamentos'),
  ('services.manage',   'Gerenciar serviços e pacotes'),
  ('analytics.read',    'Visualizar analytics'),
  ('audit.read',        'Visualizar logs de auditoria');

-- Mapeamento por papel
insert into public.role_permissions (role, permission_key)
select 'owner'::public.app_role, key from public.permissions;

insert into public.role_permissions (role, permission_key) values
  ('manager', 'tenant.read'),
  ('manager', 'tenant.update'),
  ('manager', 'units.manage'),
  ('manager', 'team.manage'),
  ('manager', 'settings.update'),
  ('manager', 'clients.manage'),
  ('manager', 'appointments.manage'),
  ('manager', 'appointments.read'),
  ('manager', 'services.manage'),
  ('manager', 'analytics.read'),
  ('frontdesk', 'tenant.read'),
  ('frontdesk', 'clients.manage'),
  ('frontdesk', 'appointments.manage'),
  ('frontdesk', 'appointments.read'),
  ('professional', 'tenant.read'),
  ('professional', 'appointments.read'),
  ('client', 'tenant.read');

-- -----------------------------------------------------------------------------
-- TENANT SETTINGS (branding + preferências)
-- -----------------------------------------------------------------------------
create table public.tenant_settings (
  tenant_id           uuid primary key references public.tenants(id) on delete cascade,
  logo_url            text,
  brand_primary       text,
  brand_secondary     text,
  brand_accent        text,
  whatsapp_phone      text,
  default_unit_id     uuid references public.units(id) on delete set null,
  appointment_buffer_minutes integer not null default 0,
  cancellation_policy text,
  preferences         jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger tenant_settings_set_updated_at
before update on public.tenant_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- UNIT SETTINGS
-- -----------------------------------------------------------------------------
create table public.unit_settings (
  unit_id     uuid primary key references public.units(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  opening_hours jsonb not null default '{}'::jsonb,
  preferences   jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger unit_settings_set_updated_at
before update on public.unit_settings
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- PROFESSIONALS
-- -----------------------------------------------------------------------------
create table public.professionals (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  unit_id       uuid references public.units(id) on delete set null,
  user_id       uuid references auth.users(id) on delete set null,
  display_name  text not null,
  role_title    text,
  bio           text,
  color         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index professionals_tenant_idx on public.professionals(tenant_id);
create index professionals_unit_idx on public.professionals(unit_id);

create trigger professionals_set_updated_at
before update on public.professionals
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- AUDIT LOGS
-- -----------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid references public.tenants(id) on delete cascade,
  actor_id    uuid references auth.users(id) on delete set null,
  action      text not null,
  entity      text,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_tenant_idx on public.audit_logs(tenant_id, created_at desc);

-- =============================================================================
-- SECURITY DEFINER HELPERS (evitar recursão de RLS)
-- =============================================================================

create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_super_admin from public.profiles where id = _user_id), false);
$$;

create or replace function public.has_tenant_role(_user_id uuid, _tenant_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where user_id = _user_id
      and tenant_id = _tenant_id
      and status = 'active'
      and role = _role
  );
$$;

-- Verifica se o usuário tem qualquer um dos papéis em um tenant
create or replace function public.has_any_tenant_role(_user_id uuid, _tenant_id uuid, _roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where user_id = _user_id
      and tenant_id = _tenant_id
      and status = 'active'
      and role = any(_roles)
  );
$$;

-- Verifica se o usuário é membro ativo de um tenant
create or replace function public.is_tenant_member(_user_id uuid, _tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_memberships
    where user_id = _user_id
      and tenant_id = _tenant_id
      and status = 'active'
  );
$$;

-- =============================================================================
-- ENABLE RLS + POLICIES
-- =============================================================================
alter table public.profiles            enable row level security;
alter table public.tenants             enable row level security;
alter table public.units               enable row level security;
alter table public.tenant_memberships  enable row level security;
alter table public.permissions         enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.tenant_settings     enable row level security;
alter table public.unit_settings       enable row level security;
alter table public.professionals       enable row level security;
alter table public.audit_logs          enable row level security;

-- ---------- profiles ----------
create policy "profiles: ver próprio perfil"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_super_admin(auth.uid()));

create policy "profiles: atualizar próprio perfil"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_super_admin(auth.uid()))
with check (id = auth.uid() or public.is_super_admin(auth.uid()));

create policy "profiles: insert próprio perfil"
on public.profiles for insert to authenticated
with check (id = auth.uid());

-- ---------- tenants ----------
create policy "tenants: membros podem ler"
on public.tenants for select to authenticated
using (public.is_tenant_member(auth.uid(), id) or public.is_super_admin(auth.uid()));

create policy "tenants: usuário autenticado pode criar"
on public.tenants for insert to authenticated
with check (created_by = auth.uid());

create policy "tenants: owner/manager podem atualizar"
on public.tenants for update to authenticated
using (
  public.has_any_tenant_role(auth.uid(), id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "tenants: super admin pode deletar"
on public.tenants for delete to authenticated
using (public.is_super_admin(auth.uid()));

-- ---------- units ----------
create policy "units: membros leem"
on public.units for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "units: owner/manager gerenciam"
on public.units for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- tenant_memberships ----------
-- O usuário pode ver as próprias memberships (para descobrir seus tenants)
create policy "memberships: usuário vê as próprias"
on public.tenant_memberships for select to authenticated
using (user_id = auth.uid() or public.is_super_admin(auth.uid()));

-- Owner/manager podem ver toda a equipe do tenant
create policy "memberships: owner/manager veem equipe"
on public.tenant_memberships for select to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
);

-- Criação inicial: o próprio usuário pode se inserir como owner ao criar o tenant
create policy "memberships: criar membership"
on public.tenant_memberships for insert to authenticated
with check (
  -- caso 1: usuário criando a si mesmo como owner do tenant que acabou de criar
  (user_id = auth.uid() and role = 'owner')
  -- caso 2: owner/manager convidando alguém
  or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "memberships: owner/manager atualizam"
on public.tenant_memberships for update to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "memberships: owner/manager removem"
on public.tenant_memberships for delete to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- permissions / role_permissions ----------
create policy "permissions: leitura para autenticados"
on public.permissions for select to authenticated using (true);

create policy "role_permissions: leitura para autenticados"
on public.role_permissions for select to authenticated using (true);

-- ---------- tenant_settings ----------
create policy "tenant_settings: membros leem"
on public.tenant_settings for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "tenant_settings: owner/manager gerenciam"
on public.tenant_settings for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- unit_settings ----------
create policy "unit_settings: membros leem"
on public.unit_settings for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "unit_settings: owner/manager gerenciam"
on public.unit_settings for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- professionals ----------
create policy "professionals: membros leem"
on public.professionals for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "professionals: owner/manager gerenciam"
on public.professionals for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- audit_logs ----------
create policy "audit_logs: owner/manager leem"
on public.audit_logs for select to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "audit_logs: membros podem registrar"
on public.audit_logs for insert to authenticated
with check (
  public.is_tenant_member(auth.uid(), tenant_id)
  or public.is_super_admin(auth.uid())
);
