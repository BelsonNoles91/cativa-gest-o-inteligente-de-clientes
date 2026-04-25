--- 20260421195836_469eb6fc-b7ec-4aab-85bf-5cb0f7b24f0d.sql ---
-- =============================================================================
-- Cativa â€” Etapa 2 â€” Base multi-tenant + RLS
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

-- Auto-cria profile quando um novo usuÃ¡rio Ã© criado em auth.users
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

-- CatÃ¡logo inicial
insert into public.permissions (key, description) values
  ('tenant.read',       'Visualizar dados do estabelecimento'),
  ('tenant.update',     'Editar dados do estabelecimento'),
  ('units.manage',      'Gerenciar unidades'),
  ('team.manage',       'Gerenciar equipe e convites'),
  ('settings.update',   'Atualizar configuraÃ§Ãµes e branding'),
  ('clients.manage',    'Gerenciar clientes'),
  ('appointments.manage','Gerenciar agendamentos'),
  ('appointments.read', 'Visualizar agendamentos'),
  ('services.manage',   'Gerenciar serviÃ§os e pacotes'),
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
-- TENANT SETTINGS (branding + preferÃªncias)
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
-- SECURITY DEFINER HELPERS (evitar recursÃ£o de RLS)
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

-- Verifica se o usuÃ¡rio tem qualquer um dos papÃ©is em um tenant
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

-- Verifica se o usuÃ¡rio Ã© membro ativo de um tenant
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
create policy "profiles: ver prÃ³prio perfil"
on public.profiles for select to authenticated
using (id = auth.uid() or public.is_super_admin(auth.uid()));

create policy "profiles: atualizar prÃ³prio perfil"
on public.profiles for update to authenticated
using (id = auth.uid() or public.is_super_admin(auth.uid()))
with check (id = auth.uid() or public.is_super_admin(auth.uid()));

create policy "profiles: insert prÃ³prio perfil"
on public.profiles for insert to authenticated
with check (id = auth.uid());

-- ---------- tenants ----------
create policy "tenants: membros podem ler"
on public.tenants for select to authenticated
using (public.is_tenant_member(auth.uid(), id) or public.is_super_admin(auth.uid()));

create policy "tenants: usuÃ¡rio autenticado pode criar"
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
-- O usuÃ¡rio pode ver as prÃ³prias memberships (para descobrir seus tenants)
create policy "memberships: usuÃ¡rio vÃª as prÃ³prias"
on public.tenant_memberships for select to authenticated
using (user_id = auth.uid() or public.is_super_admin(auth.uid()));

-- Owner/manager podem ver toda a equipe do tenant
create policy "memberships: owner/manager veem equipe"
on public.tenant_memberships for select to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
);

-- CriaÃ§Ã£o inicial: o prÃ³prio usuÃ¡rio pode se inserir como owner ao criar o tenant
create policy "memberships: criar membership"
on public.tenant_memberships for insert to authenticated
with check (
  -- caso 1: usuÃ¡rio criando a si mesmo como owner do tenant que acabou de criar
  (user_id = auth.uid() and role = 'owner')
  -- caso 2: owner/manager convidando alguÃ©m
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

--- 20260421195857_d00fbf97-7bd2-48f1-95fd-c3f3784c1e8a.sql ---
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

--- 20260421200744_aa4891e2-582f-4591-b6b0-5dcc3efddcaf.sql ---
-- =============================================================================
-- Cativa â€” Etapa 3 â€” CRM (clients, tags, notes, files, photos, timeline,
-- custom fields, consent forms) + Storage bucket
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type public.client_status as enum ('active', 'inactive', 'blocked');
create type public.client_risk_level as enum ('low', 'medium', 'high');
create type public.client_photo_type as enum ('before', 'after', 'general');
create type public.timeline_event_type as enum (
  'note', 'file', 'photo', 'consent', 'manual', 'status_change', 'appointment', 'system'
);
create type public.custom_field_type as enum ('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'textarea');
create type public.consent_response_status as enum ('pending', 'signed', 'declined');

-- =============================================================================
-- CLIENTS
-- =============================================================================
create table public.clients (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  preferred_unit_id       uuid references public.units(id) on delete set null,
  preferred_professional_id uuid references public.professionals(id) on delete set null,
  referred_by_client_id   uuid references public.clients(id) on delete set null,

  full_name               text not null,
  email                   text,
  phone                   text,
  whatsapp_phone          text,
  birth_date              date,
  origin                  text,
  notes                   text,
  allergies               text,
  contraindications       text,
  preferences             text,

  status                  public.client_status not null default 'active',
  is_vip                  boolean not null default false,
  risk_level              public.client_risk_level not null default 'low',
  needs_reactivation      boolean not null default false,

  last_visit_at           timestamptz,
  next_visit_at           timestamptz,

  address_line1           text,
  address_line2           text,
  city                    text,
  state                   text,
  postal_code             text,
  country                 text default 'BR',

  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index clients_tenant_idx on public.clients(tenant_id);
create index clients_tenant_name_idx on public.clients(tenant_id, full_name);
create index clients_tenant_phone_idx on public.clients(tenant_id, phone);
create index clients_tenant_email_idx on public.clients(tenant_id, email);
create index clients_birthday_idx on public.clients(tenant_id, (extract(month from birth_date)), (extract(day from birth_date)));

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- =============================================================================
-- CLIENT TAGS
-- =============================================================================
create table public.client_tags (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create index client_tags_tenant_idx on public.client_tags(tenant_id);

create table public.client_tag_relations (
  client_id   uuid not null references public.clients(id) on delete cascade,
  tag_id      uuid not null references public.client_tags(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (client_id, tag_id)
);

create index client_tag_relations_tenant_idx on public.client_tag_relations(tenant_id);
create index client_tag_relations_tag_idx on public.client_tag_relations(tag_id);

-- =============================================================================
-- CLIENT NOTES
-- =============================================================================
create table public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  body        text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index client_notes_client_idx on public.client_notes(client_id, created_at desc);
create index client_notes_tenant_idx on public.client_notes(tenant_id);

create trigger client_notes_set_updated_at
before update on public.client_notes
for each row execute function public.set_updated_at();

-- =============================================================================
-- CLIENT FILES
-- =============================================================================
create table public.client_files (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  uploaded_by   uuid references auth.users(id) on delete set null,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    integer,
  description   text,
  created_at    timestamptz not null default now()
);

create index client_files_client_idx on public.client_files(client_id, created_at desc);
create index client_files_tenant_idx on public.client_files(tenant_id);

-- =============================================================================
-- CLIENT PHOTOS (com par antes/depois)
-- =============================================================================
create table public.client_photos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  uploaded_by   uuid references auth.users(id) on delete set null,
  storage_path  text not null,
  photo_type    public.client_photo_type not null default 'general',
  pair_id       uuid,
  caption       text,
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

create index client_photos_client_idx on public.client_photos(client_id, created_at desc);
create index client_photos_pair_idx on public.client_photos(pair_id);
create index client_photos_tenant_idx on public.client_photos(tenant_id);

-- =============================================================================
-- TIMELINE EVENTS
-- =============================================================================
create table public.client_timeline_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  actor_id      uuid references auth.users(id) on delete set null,
  event_type    public.timeline_event_type not null,
  title         text not null,
  description   text,
  reference_id  uuid,
  metadata      jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index timeline_client_idx on public.client_timeline_events(client_id, occurred_at desc);
create index timeline_tenant_idx on public.client_timeline_events(tenant_id);

-- =============================================================================
-- CUSTOM FIELDS
-- =============================================================================
create table public.custom_field_definitions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  entity        text not null default 'client',
  key           text not null,
  label         text not null,
  field_type    public.custom_field_type not null,
  options       jsonb not null default '[]'::jsonb,
  is_required   boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, entity, key)
);

create index custom_field_defs_tenant_idx on public.custom_field_definitions(tenant_id, entity, position);

create trigger custom_field_definitions_set_updated_at
before update on public.custom_field_definitions
for each row execute function public.set_updated_at();

create table public.client_custom_field_values (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  definition_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  value         jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, definition_id)
);

create index client_cfv_client_idx on public.client_custom_field_values(client_id);
create index client_cfv_tenant_idx on public.client_custom_field_values(tenant_id);

create trigger client_cfv_set_updated_at
before update on public.client_custom_field_values
for each row execute function public.set_updated_at();

-- =============================================================================
-- CONSENT FORMS
-- =============================================================================
create table public.consent_form_templates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  title         text not null,
  body          text not null,
  is_active     boolean not null default true,
  version       integer not null default 1,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index consent_templates_tenant_idx on public.consent_form_templates(tenant_id);

create trigger consent_form_templates_set_updated_at
before update on public.consent_form_templates
for each row execute function public.set_updated_at();

create table public.consent_form_responses (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  template_id     uuid not null references public.consent_form_templates(id) on delete restrict,
  template_version integer not null default 1,
  status          public.consent_response_status not null default 'pending',
  signed_text     text,
  signed_name     text,
  signed_at       timestamptz,
  signed_by       uuid references auth.users(id) on delete set null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index consent_responses_client_idx on public.consent_form_responses(client_id, created_at desc);
create index consent_responses_tenant_idx on public.consent_form_responses(tenant_id);

create trigger consent_form_responses_set_updated_at
before update on public.consent_form_responses
for each row execute function public.set_updated_at();

-- =============================================================================
-- ENABLE RLS
-- =============================================================================
alter table public.clients                     enable row level security;
alter table public.client_tags                 enable row level security;
alter table public.client_tag_relations        enable row level security;
alter table public.client_notes                enable row level security;
alter table public.client_files                enable row level security;
alter table public.client_photos               enable row level security;
alter table public.client_timeline_events      enable row level security;
alter table public.custom_field_definitions    enable row level security;
alter table public.client_custom_field_values  enable row level security;
alter table public.consent_form_templates      enable row level security;
alter table public.consent_form_responses      enable row level security;

-- -----------------------------------------------------------------------------
-- POLICIES
-- PadrÃ£o:
--   SELECT  â†’ qualquer membro ativo do tenant
--   INSERT/UPDATE/DELETE â†’ owner/manager/frontdesk/professional (operaÃ§Ã£o)
--                          owner/manager apenas (configuraÃ§Ã£o)
-- Super admin sempre passa.
-- -----------------------------------------------------------------------------

-- ---------- clients ----------
create policy "clients: membros leem"
on public.clients for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "clients: equipe gerencia"
on public.clients for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_tags ----------
create policy "client_tags: membros leem"
on public.client_tags for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_tags: equipe gerencia"
on public.client_tags for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_tag_relations ----------
create policy "client_tag_relations: membros leem"
on public.client_tag_relations for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_tag_relations: equipe gerencia"
on public.client_tag_relations for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_notes ----------
create policy "client_notes: membros leem"
on public.client_notes for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_notes: equipe escreve"
on public.client_notes for insert to authenticated
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "client_notes: autor ou gestor edita"
on public.client_notes for update to authenticated
using (
  author_id = auth.uid()
  or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  author_id = auth.uid()
  or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "client_notes: autor ou gestor remove"
on public.client_notes for delete to authenticated
using (
  author_id = auth.uid()
  or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_files ----------
create policy "client_files: membros leem"
on public.client_files for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_files: equipe gerencia"
on public.client_files for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_photos ----------
create policy "client_photos: membros leem"
on public.client_photos for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_photos: equipe gerencia"
on public.client_photos for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_timeline_events ----------
create policy "timeline: membros leem"
on public.client_timeline_events for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "timeline: equipe registra"
on public.client_timeline_events for insert to authenticated
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "timeline: gestor remove"
on public.client_timeline_events for delete to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- custom_field_definitions ----------
create policy "custom_field_defs: membros leem"
on public.custom_field_definitions for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "custom_field_defs: gestor configura"
on public.custom_field_definitions for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_custom_field_values ----------
create policy "client_cfv: membros leem"
on public.client_custom_field_values for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_cfv: equipe gerencia"
on public.client_custom_field_values for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- consent_form_templates ----------
create policy "consent_templates: membros leem"
on public.consent_form_templates for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "consent_templates: gestor configura"
on public.consent_form_templates for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- consent_form_responses ----------
create policy "consent_responses: membros leem"
on public.consent_form_responses for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "consent_responses: equipe gerencia"
on public.consent_form_responses for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- =============================================================================
-- STORAGE BUCKET (privado): client-media
-- Estrutura de path: {tenant_id}/{client_id}/{uuid}-{filename}
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('client-media', 'client-media', false)
on conflict (id) do nothing;

-- Helper: extrair tenant_id do primeiro segmento do path
-- (storage.foldername(name) retorna text[]; o primeiro elemento Ã© o tenant)

create policy "client-media: membros leem"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-media'
  and (
    public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    or public.is_super_admin(auth.uid())
  )
);

create policy "client-media: equipe envia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-media'
  and (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      array['owner','manager','frontdesk','professional']::public.app_role[]
    )
    or public.is_super_admin(auth.uid())
  )
);

create policy "client-media: equipe atualiza"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-media'
  and (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      array['owner','manager','frontdesk','professional']::public.app_role[]
    )
    or public.is_super_admin(auth.uid())
  )
);

create policy "client-media: equipe remove"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-media'
  and (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      array['owner','manager','frontdesk','professional']::public.app_role[]
    )
    or public.is_super_admin(auth.uid())
  )
);

--- 20260421201250_94deb459-58df-4ba0-b609-26433f86c7d6.sql ---
-- =============================================================================
-- Cativa â€” Etapa 4 â€” CatÃ¡logo (categorias, serviÃ§os, preÃ§os, pacotes,
-- assinaturas, protocolos, saldos, polÃ­ticas de cancelamento)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type public.package_kind as enum ('package', 'combo');
create type public.membership_billing_cycle as enum ('monthly', 'quarterly', 'yearly');
create type public.client_subscription_status as enum ('active', 'paused', 'canceled', 'expired');
create type public.client_package_status as enum ('active', 'completed', 'expired', 'canceled');

-- =============================================================================
-- CANCELLATION POLICIES (reutilizÃ¡veis)
-- =============================================================================
create table public.cancellation_policies (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  name                     text not null,
  description              text,
  hours_before_no_charge   integer not null default 24,
  late_cancel_fee_pct      integer not null default 0,
  no_show_fee_pct          integer not null default 100,
  is_default               boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index cancellation_policies_tenant_idx on public.cancellation_policies(tenant_id);
create trigger cancellation_policies_set_updated_at
  before update on public.cancellation_policies
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SERVICE CATEGORIES (com sub via parent_id)
-- =============================================================================
create table public.service_categories (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  parent_id     uuid references public.service_categories(id) on delete cascade,
  name          text not null,
  description   text,
  color         text,
  icon          text,
  position      integer not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index service_categories_tenant_idx on public.service_categories(tenant_id, position);
create index service_categories_parent_idx on public.service_categories(parent_id);
create trigger service_categories_set_updated_at
  before update on public.service_categories
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SERVICES
-- =============================================================================
create table public.services (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  category_id                 uuid references public.service_categories(id) on delete set null,
  cancellation_policy_id      uuid references public.cancellation_policies(id) on delete set null,

  name                        text not null,
  description                 text,
  internal_code               text,
  -- duraÃ§Ã£o e buffers (minutos)
  duration_minutes            integer not null default 30,
  buffer_before_minutes       integer not null default 0,
  buffer_after_minutes        integer not null default 0,
  processing_minutes          integer not null default 0,
  -- janelas de agendamento
  min_advance_hours           integer not null default 0,
  max_advance_days            integer not null default 60,
  ideal_return_window_days    integer,
  -- recursos
  requires_resource           boolean not null default false,
  resource_label              text,
  -- elegibilidade comercial
  eligible_for_package        boolean not null default true,
  eligible_for_membership     boolean not null default true,
  -- conteÃºdo
  pre_appointment_instructions text,
  post_appointment_instructions text,
  -- estado
  is_active                   boolean not null default true,
  is_featured                 boolean not null default false,
  position                    integer not null default 0,

  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index services_tenant_idx on public.services(tenant_id, is_active, position);
create index services_category_idx on public.services(category_id);
create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SERVICE PRICES (lista base por moeda â€” preparado para mÃºltiplas tabelas)
-- =============================================================================
create table public.service_prices (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  service_id    uuid not null references public.services(id) on delete cascade,
  currency      text not null default 'BRL',
  amount_cents  integer not null default 0,
  is_default    boolean not null default true,
  valid_from    timestamptz,
  valid_until   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index service_prices_service_idx on public.service_prices(service_id);
create index service_prices_tenant_idx on public.service_prices(tenant_id);
create trigger service_prices_set_updated_at
  before update on public.service_prices
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SERVICE UNIT PRICES (preÃ§o por unidade)
-- =============================================================================
create table public.service_unit_prices (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  service_id    uuid not null references public.services(id) on delete cascade,
  unit_id       uuid not null references public.units(id) on delete cascade,
  amount_cents  integer not null,
  duration_minutes integer,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (service_id, unit_id)
);
create index service_unit_prices_tenant_idx on public.service_unit_prices(tenant_id);
create trigger service_unit_prices_set_updated_at
  before update on public.service_unit_prices
  for each row execute function public.set_updated_at();

-- =============================================================================
-- SERVICE PROFESSIONAL PRICES (preÃ§o por profissional)
-- =============================================================================
create table public.service_professional_prices (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  service_id      uuid not null references public.services(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  amount_cents    integer not null,
  duration_minutes integer,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (service_id, professional_id)
);
create index service_pro_prices_tenant_idx on public.service_professional_prices(tenant_id);
create trigger service_professional_prices_set_updated_at
  before update on public.service_professional_prices
  for each row execute function public.set_updated_at();

-- =============================================================================
-- PACKAGES (pacotes e combos)
-- =============================================================================
create table public.packages (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  kind                        public.package_kind not null default 'package',
  name                        text not null,
  description                 text,
  price_cents                 integer not null default 0,
  validity_days               integer,                -- nulo = sem validade
  recommended_interval_days   integer,                -- janela entre sessÃµes
  usage_rules                 text,
  notes                       text,
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index packages_tenant_idx on public.packages(tenant_id, is_active);
create trigger packages_set_updated_at
  before update on public.packages
  for each row execute function public.set_updated_at();

create table public.package_items (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  package_id    uuid not null references public.packages(id) on delete cascade,
  service_id    uuid not null references public.services(id) on delete cascade,
  sessions      integer not null default 1,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index package_items_package_idx on public.package_items(package_id);
create index package_items_tenant_idx on public.package_items(tenant_id);

-- =============================================================================
-- MEMBERSHIPS (assinaturas mensais)
-- =============================================================================
create table public.memberships (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  name               text not null,
  description        text,
  price_cents        integer not null default 0,
  billing_cycle      public.membership_billing_cycle not null default 'monthly',
  is_active          boolean not null default true,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index memberships_tenant_idx on public.memberships(tenant_id, is_active);
create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

create table public.membership_benefits (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  membership_id       uuid not null references public.memberships(id) on delete cascade,
  service_id          uuid not null references public.services(id) on delete cascade,
  sessions_per_cycle  integer not null default 1,
  discount_pct        integer not null default 0,
  created_at          timestamptz not null default now()
);
create index membership_benefits_idx on public.membership_benefits(membership_id);
create index membership_benefits_tenant_idx on public.membership_benefits(tenant_id);

-- =============================================================================
-- PROTOCOLS (sÃ©ries de tratamento)
-- =============================================================================
create table public.protocols (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  name                        text not null,
  description                 text,
  total_sessions              integer not null default 1,
  recommended_interval_days   integer,
  total_price_cents           integer,
  pre_instructions            text,
  post_instructions           text,
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index protocols_tenant_idx on public.protocols(tenant_id, is_active);
create trigger protocols_set_updated_at
  before update on public.protocols
  for each row execute function public.set_updated_at();

create table public.protocol_sessions (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  protocol_id         uuid not null references public.protocols(id) on delete cascade,
  service_id          uuid not null references public.services(id) on delete cascade,
  step                integer not null default 1,
  interval_days       integer,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (protocol_id, step)
);
create index protocol_sessions_protocol_idx on public.protocol_sessions(protocol_id, step);
create index protocol_sessions_tenant_idx on public.protocol_sessions(tenant_id);

-- =============================================================================
-- CLIENT BALANCES (preparado para uso futuro pela agenda)
-- =============================================================================
create table public.client_package_balances (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  package_id      uuid not null references public.packages(id) on delete restrict,
  service_id      uuid references public.services(id) on delete set null,
  sessions_total  integer not null default 0,
  sessions_used   integer not null default 0,
  status          public.client_package_status not null default 'active',
  purchased_at    timestamptz not null default now(),
  expires_at      timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index cpb_tenant_idx on public.client_package_balances(tenant_id);
create index cpb_client_idx on public.client_package_balances(client_id, status);
create trigger cpb_set_updated_at
  before update on public.client_package_balances
  for each row execute function public.set_updated_at();

create table public.client_membership_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  membership_id   uuid not null references public.memberships(id) on delete restrict,
  status          public.client_subscription_status not null default 'active',
  started_at      timestamptz not null default now(),
  current_cycle_start timestamptz not null default now(),
  current_cycle_end   timestamptz,
  canceled_at     timestamptz,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index cms_tenant_idx on public.client_membership_subscriptions(tenant_id);
create index cms_client_idx on public.client_membership_subscriptions(client_id, status);
create trigger cms_set_updated_at
  before update on public.client_membership_subscriptions
  for each row execute function public.set_updated_at();

create table public.client_membership_balances (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  subscription_id   uuid not null references public.client_membership_subscriptions(id) on delete cascade,
  service_id        uuid not null references public.services(id) on delete cascade,
  sessions_total    integer not null default 0,
  sessions_used     integer not null default 0,
  cycle_start       timestamptz not null default now(),
  cycle_end         timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index cmb_tenant_idx on public.client_membership_balances(tenant_id);
create index cmb_sub_idx on public.client_membership_balances(subscription_id);
create trigger cmb_set_updated_at
  before update on public.client_membership_balances
  for each row execute function public.set_updated_at();

-- =============================================================================
-- ENABLE RLS
-- =============================================================================
alter table public.cancellation_policies            enable row level security;
alter table public.service_categories               enable row level security;
alter table public.services                         enable row level security;
alter table public.service_prices                   enable row level security;
alter table public.service_unit_prices              enable row level security;
alter table public.service_professional_prices      enable row level security;
alter table public.packages                         enable row level security;
alter table public.package_items                    enable row level security;
alter table public.memberships                      enable row level security;
alter table public.membership_benefits              enable row level security;
alter table public.protocols                        enable row level security;
alter table public.protocol_sessions                enable row level security;
alter table public.client_package_balances          enable row level security;
alter table public.client_membership_subscriptions  enable row level security;
alter table public.client_membership_balances       enable row level security;

-- -----------------------------------------------------------------------------
-- Helper macro de policies:
--   SELECT  â†’ membros do tenant
--   ALL     â†’ owner/manager (configuraÃ§Ã£o do catÃ¡logo)
--   Saldos de cliente â†’ SELECT membros, ALL owner/manager/frontdesk
-- Super admin sempre passa.
-- -----------------------------------------------------------------------------

-- ---------- cancellation_policies ----------
create policy "cancellation_policies: membros leem"
on public.cancellation_policies for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "cancellation_policies: gestor configura"
on public.cancellation_policies for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- service_categories ----------
create policy "service_categories: membros leem"
on public.service_categories for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "service_categories: gestor configura"
on public.service_categories for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- services ----------
create policy "services: membros leem"
on public.services for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "services: gestor configura"
on public.services for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- service_prices ----------
create policy "service_prices: membros leem"
on public.service_prices for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "service_prices: gestor configura"
on public.service_prices for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- service_unit_prices ----------
create policy "service_unit_prices: membros leem"
on public.service_unit_prices for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "service_unit_prices: gestor configura"
on public.service_unit_prices for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- service_professional_prices ----------
create policy "service_professional_prices: membros leem"
on public.service_professional_prices for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "service_professional_prices: gestor configura"
on public.service_professional_prices for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- packages ----------
create policy "packages: membros leem"
on public.packages for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "packages: gestor configura"
on public.packages for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- package_items ----------
create policy "package_items: membros leem"
on public.package_items for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "package_items: gestor configura"
on public.package_items for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- memberships ----------
create policy "memberships: membros leem"
on public.memberships for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "memberships: gestor configura"
on public.memberships for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- membership_benefits ----------
create policy "membership_benefits: membros leem"
on public.membership_benefits for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "membership_benefits: gestor configura"
on public.membership_benefits for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- protocols ----------
create policy "protocols: membros leem"
on public.protocols for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "protocols: gestor configura"
on public.protocols for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- protocol_sessions ----------
create policy "protocol_sessions: membros leem"
on public.protocol_sessions for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "protocol_sessions: gestor configura"
on public.protocol_sessions for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- client_package_balances ----------
create policy "client_package_balances: membros leem"
on public.client_package_balances for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_package_balances: equipe gerencia"
on public.client_package_balances for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- client_membership_subscriptions ----------
create policy "client_membership_subs: membros leem"
on public.client_membership_subscriptions for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_membership_subs: equipe gerencia"
on public.client_membership_subscriptions for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- client_membership_balances ----------
create policy "client_membership_balances: membros leem"
on public.client_membership_balances for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_membership_balances: equipe gerencia"
on public.client_membership_balances for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[]) or public.is_super_admin(auth.uid()));

--- 20260421201900_dc32b939-ee04-453d-b7a5-4b746c63f58b.sql ---
-- =============================================================================
-- Cativa â€” Etapa 5 â€” Agenda (resources, disponibilidade, bloqueios,
-- appointments, items, status, logs, waitlist) + funÃ§Ã£o de slots
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type public.appointment_status as enum (
  'requested',
  'pending',
  'confirmed',
  'reminded',
  'arrived',
  'in_service',
  'completed',
  'canceled',
  'no_show'
);

create type public.appointment_source as enum (
  'frontdesk',
  'professional',
  'client_portal',
  'walk_in',
  'phone',
  'whatsapp',
  'recurring',
  'system'
);

create type public.resource_type as enum (
  'room',
  'equipment',
  'chair',
  'station',
  'other'
);

create type public.time_off_scope as enum (
  'professional',
  'unit'
);

create type public.waitlist_status as enum (
  'open',
  'contacted',
  'scheduled',
  'expired',
  'canceled'
);

-- =============================================================================
-- RESOURCES (salas/equipamentos)
-- =============================================================================
create table public.resources (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  unit_id       uuid references public.units(id) on delete cascade,
  name          text not null,
  resource_type public.resource_type not null default 'room',
  color         text,
  notes         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index resources_tenant_idx on public.resources(tenant_id, unit_id);
create trigger resources_set_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

-- =============================================================================
-- UNIT BUSINESS HOURS
-- =============================================================================
create table public.unit_business_hours (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  unit_id       uuid not null references public.units(id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6), -- 0 = domingo
  opens_at      time not null,
  closes_at     time not null,
  is_closed     boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index unit_business_hours_unit_idx on public.unit_business_hours(unit_id, weekday);
create index unit_business_hours_tenant_idx on public.unit_business_hours(tenant_id);
create trigger unit_business_hours_set_updated_at
  before update on public.unit_business_hours
  for each row execute function public.set_updated_at();

-- =============================================================================
-- PROFESSIONAL AVAILABILITY (janelas semanais)
-- =============================================================================
create table public.professional_availability (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid not null references public.professionals(id) on delete cascade,
  unit_id         uuid references public.units(id) on delete cascade,
  weekday         smallint not null check (weekday between 0 and 6),
  starts_at       time not null,
  ends_at         time not null,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index pro_avail_pro_idx on public.professional_availability(professional_id, weekday);
create index pro_avail_tenant_idx on public.professional_availability(tenant_id);
create trigger professional_availability_set_updated_at
  before update on public.professional_availability
  for each row execute function public.set_updated_at();

-- =============================================================================
-- TIME OFF BLOCKS (bloqueios pontuais)
-- =============================================================================
create table public.time_off_blocks (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  scope           public.time_off_scope not null,
  professional_id uuid references public.professionals(id) on delete cascade,
  unit_id         uuid references public.units(id) on delete cascade,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  reason          text,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  check (
    (scope = 'professional' and professional_id is not null) or
    (scope = 'unit' and unit_id is not null)
  )
);
create index time_off_pro_idx on public.time_off_blocks(professional_id, starts_at, ends_at);
create index time_off_unit_idx on public.time_off_blocks(unit_id, starts_at, ends_at);
create index time_off_tenant_idx on public.time_off_blocks(tenant_id);
create trigger time_off_blocks_set_updated_at
  before update on public.time_off_blocks
  for each row execute function public.set_updated_at();

-- =============================================================================
-- RECURRING BLOCKS (bloqueios semanais recorrentes)
-- =============================================================================
create table public.recurring_blocks (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete cascade,
  unit_id         uuid references public.units(id) on delete cascade,
  weekday         smallint not null check (weekday between 0 and 6),
  starts_at       time not null,
  ends_at         time not null,
  reason          text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index recurring_blocks_pro_idx on public.recurring_blocks(professional_id, weekday);
create index recurring_blocks_unit_idx on public.recurring_blocks(unit_id, weekday);
create index recurring_blocks_tenant_idx on public.recurring_blocks(tenant_id);
create trigger recurring_blocks_set_updated_at
  before update on public.recurring_blocks
  for each row execute function public.set_updated_at();

-- =============================================================================
-- APPOINTMENTS
-- =============================================================================
create table public.appointments (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  unit_id                uuid not null references public.units(id) on delete restrict,
  client_id              uuid not null references public.clients(id) on delete restrict,
  professional_id        uuid not null references public.professionals(id) on delete restrict,
  resource_id            uuid references public.resources(id) on delete set null,
  cancellation_policy_id uuid references public.cancellation_policies(id) on delete set null,

  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  duration_minutes       integer not null,
  buffer_before_minutes  integer not null default 0,
  buffer_after_minutes   integer not null default 0,

  status                 public.appointment_status not null default 'pending',
  source                 public.appointment_source not null default 'frontdesk',
  is_walk_in             boolean not null default false,
  is_overbooked          boolean not null default false,

  notes                  text,
  internal_notes         text,
  total_price_cents      integer not null default 0,

  -- timestamps de fluxo
  confirmed_at           timestamptz,
  reminded_at            timestamptz,
  arrived_at             timestamptz,
  started_at             timestamptz,
  completed_at           timestamptz,
  canceled_at            timestamptz,
  canceled_reason        text,
  no_show_at             timestamptz,

  created_by             uuid,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index appointments_tenant_idx       on public.appointments(tenant_id);
create index appointments_unit_starts_idx  on public.appointments(unit_id, starts_at);
create index appointments_pro_starts_idx   on public.appointments(professional_id, starts_at);
create index appointments_client_idx       on public.appointments(client_id, starts_at desc);
create index appointments_status_idx       on public.appointments(tenant_id, status, starts_at);
create index appointments_resource_idx     on public.appointments(resource_id, starts_at);
create trigger appointments_set_updated_at
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- =============================================================================
-- APPOINTMENT ITEMS (1..N serviÃ§os por agendamento)
-- =============================================================================
create table public.appointment_items (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  appointment_id      uuid not null references public.appointments(id) on delete cascade,
  service_id          uuid not null references public.services(id) on delete restrict,
  duration_minutes    integer not null,
  price_cents         integer not null default 0,
  position            integer not null default 0,
  notes               text,
  package_balance_id  uuid references public.client_package_balances(id) on delete set null,
  membership_balance_id uuid references public.client_membership_balances(id) on delete set null,
  created_at          timestamptz not null default now()
);
create index appointment_items_appt_idx on public.appointment_items(appointment_id, position);
create index appointment_items_tenant_idx on public.appointment_items(tenant_id);

-- =============================================================================
-- APPOINTMENT STATUS HISTORY
-- =============================================================================
create table public.appointment_status_history (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  from_status     public.appointment_status,
  to_status       public.appointment_status not null,
  actor_id        uuid,
  reason          text,
  created_at      timestamptz not null default now()
);
create index appt_status_history_appt_idx on public.appointment_status_history(appointment_id, created_at);
create index appt_status_history_tenant_idx on public.appointment_status_history(tenant_id);

-- =============================================================================
-- APPOINTMENT LOGS (eventos operacionais)
-- =============================================================================
create table public.appointment_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  actor_id        uuid,
  action          text not null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index appt_logs_appt_idx on public.appointment_logs(appointment_id, created_at);
create index appt_logs_tenant_idx on public.appointment_logs(tenant_id);

-- =============================================================================
-- WAITLIST
-- =============================================================================
create table public.waitlist_entries (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  client_id                uuid not null references public.clients(id) on delete cascade,
  service_id               uuid references public.services(id) on delete set null,
  preferred_professional_id uuid references public.professionals(id) on delete set null,
  preferred_unit_id        uuid references public.units(id) on delete set null,
  desired_window_start     timestamptz,
  desired_window_end       timestamptz,
  notes                    text,
  status                   public.waitlist_status not null default 'open',
  priority                 smallint not null default 0,
  created_by               uuid,
  contacted_at             timestamptz,
  scheduled_appointment_id uuid references public.appointments(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index waitlist_tenant_idx on public.waitlist_entries(tenant_id, status, priority desc);
create index waitlist_client_idx on public.waitlist_entries(client_id);
create trigger waitlist_entries_set_updated_at
  before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

-- =============================================================================
-- TRIGGERS DE HISTÃ“RICO DE STATUS
-- =============================================================================
create or replace function public.log_appointment_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into public.appointment_status_history
      (tenant_id, appointment_id, from_status, to_status, actor_id)
    values
      (new.tenant_id, new.id, null, new.status, new.created_by);
    return new;
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into public.appointment_status_history
      (tenant_id, appointment_id, from_status, to_status, actor_id)
    values
      (new.tenant_id, new.id, old.status, new.status, auth.uid());
    return new;
  end if;
  return new;
end;
$$;

create trigger appointments_status_history_trg
  after insert or update on public.appointments
  for each row execute function public.log_appointment_status_change();

-- =============================================================================
-- FUNÃ‡ÃƒO DE DISPONIBILIDADE (slots livres)
-- =============================================================================
create or replace function public.get_available_slots(
  _tenant_id        uuid,
  _professional_id  uuid,
  _unit_id          uuid,
  _service_id       uuid,
  _day              date,
  _slot_step_minutes integer default 15
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql
stable security definer
set search_path = public
as $$
declare
  svc                services%rowtype;
  total_minutes      integer;
  weekday_int        smallint;
  unit_open          time;
  unit_close         time;
  pro_start          time;
  pro_end            time;
  cursor_ts          timestamptz;
  end_ts             timestamptz;
  candidate_end      timestamptz;
  has_conflict       boolean;
begin
  -- carrega serviÃ§o (duraÃ§Ã£o + buffers + processamento)
  select * into svc from public.services where id = _service_id and tenant_id = _tenant_id;
  if not found then
    return;
  end if;
  total_minutes := svc.duration_minutes
                 + coalesce(svc.buffer_before_minutes, 0)
                 + coalesce(svc.buffer_after_minutes, 0)
                 + coalesce(svc.processing_minutes, 0);

  weekday_int := extract(dow from _day)::smallint;

  -- horÃ¡rio da unidade
  select opens_at, closes_at into unit_open, unit_close
  from public.unit_business_hours
  where tenant_id = _tenant_id
    and unit_id = _unit_id
    and weekday = weekday_int
    and is_closed = false
  limit 1;
  if unit_open is null then
    return;
  end if;

  -- janela do profissional (se houver, restringe ainda mais)
  select starts_at, ends_at into pro_start, pro_end
  from public.professional_availability
  where tenant_id = _tenant_id
    and professional_id = _professional_id
    and weekday = weekday_int
    and is_active = true
    and (unit_id is null or unit_id = _unit_id)
  order by starts_at
  limit 1;

  if pro_start is not null then
    unit_open  := greatest(unit_open, pro_start);
    unit_close := least(unit_close, pro_end);
  end if;

  if unit_open >= unit_close then
    return;
  end if;

  cursor_ts := (_day::timestamp + unit_open)::timestamptz;
  end_ts    := (_day::timestamp + unit_close)::timestamptz;

  while cursor_ts + (total_minutes || ' minutes')::interval <= end_ts loop
    candidate_end := cursor_ts + (total_minutes || ' minutes')::interval;

    -- conflitos: appointments ativos
    select exists (
      select 1 from public.appointments a
      where a.tenant_id = _tenant_id
        and a.professional_id = _professional_id
        and a.status not in ('canceled','no_show')
        and a.starts_at < candidate_end
        and a.ends_at   > cursor_ts
    ) into has_conflict;

    if not has_conflict then
      -- bloqueios pontuais do profissional
      select exists (
        select 1 from public.time_off_blocks t
        where t.tenant_id = _tenant_id
          and t.scope = 'professional'
          and t.professional_id = _professional_id
          and t.starts_at < candidate_end
          and t.ends_at   > cursor_ts
      ) into has_conflict;
    end if;

    if not has_conflict then
      -- bloqueios pontuais da unidade
      select exists (
        select 1 from public.time_off_blocks t
        where t.tenant_id = _tenant_id
          and t.scope = 'unit'
          and t.unit_id = _unit_id
          and t.starts_at < candidate_end
          and t.ends_at   > cursor_ts
      ) into has_conflict;
    end if;

    if not has_conflict then
      -- bloqueios recorrentes
      select exists (
        select 1 from public.recurring_blocks r
        where r.tenant_id = _tenant_id
          and r.is_active = true
          and r.weekday = weekday_int
          and (r.professional_id is null or r.professional_id = _professional_id)
          and (r.unit_id is null or r.unit_id = _unit_id)
          and (
            (cursor_ts::time     < r.ends_at) and
            (candidate_end::time > r.starts_at)
          )
      ) into has_conflict;
    end if;

    if not has_conflict then
      slot_start := cursor_ts;
      slot_end   := cursor_ts + (svc.duration_minutes || ' minutes')::interval;
      return next;
    end if;

    cursor_ts := cursor_ts + (_slot_step_minutes || ' minutes')::interval;
  end loop;

  return;
end;
$$;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================
alter table public.resources                    enable row level security;
alter table public.unit_business_hours          enable row level security;
alter table public.professional_availability    enable row level security;
alter table public.time_off_blocks              enable row level security;
alter table public.recurring_blocks             enable row level security;
alter table public.appointments                 enable row level security;
alter table public.appointment_items            enable row level security;
alter table public.appointment_status_history   enable row level security;
alter table public.appointment_logs             enable row level security;
alter table public.waitlist_entries             enable row level security;

-- ---------- resources ----------
create policy "resources: membros leem"
on public.resources for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "resources: gestor configura"
on public.resources for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- unit_business_hours ----------
create policy "unit_business_hours: membros leem"
on public.unit_business_hours for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "unit_business_hours: gestor configura"
on public.unit_business_hours for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- professional_availability ----------
create policy "pro_availability: membros leem"
on public.professional_availability for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "pro_availability: gestor configura"
on public.professional_availability for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- time_off_blocks ----------
create policy "time_off: membros leem"
on public.time_off_blocks for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "time_off: equipe gerencia"
on public.time_off_blocks for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- recurring_blocks ----------
create policy "recurring_blocks: membros leem"
on public.recurring_blocks for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "recurring_blocks: gestor configura"
on public.recurring_blocks for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- appointments ----------
create policy "appointments: membros leem"
on public.appointments for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "appointments: equipe gerencia"
on public.appointments for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- appointment_items ----------
create policy "appointment_items: membros leem"
on public.appointment_items for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "appointment_items: equipe gerencia"
on public.appointment_items for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- appointment_status_history ----------
create policy "appt_status_history: membros leem"
on public.appointment_status_history for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "appt_status_history: equipe registra"
on public.appointment_status_history for insert to authenticated
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- appointment_logs ----------
create policy "appt_logs: membros leem"
on public.appointment_logs for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "appt_logs: equipe registra"
on public.appointment_logs for insert to authenticated
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- waitlist_entries ----------
create policy "waitlist: membros leem"
on public.waitlist_entries for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "waitlist: equipe gerencia"
on public.waitlist_entries for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

--- 20260421213332_c6862d91-c1eb-47d9-8b08-f0c4fbd1091a.sql ---
-- ============================================================================
-- ENUMS
-- ============================================================================
do $$ begin
  create type public.plan_billing_period as enum ('monthly','quarterly','semiannual','annual','custom');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_status as enum ('public','private','archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_status as enum ('trialing','active','overdue','suspended','canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.subscription_event_type as enum (
    'created','trial_started','trial_extended','activated','renewed',
    'upgraded','downgraded','suspended','reactivated','canceled','overdue','note'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.feature_flag_value_type as enum ('boolean','number','string','json');
exception when duplicate_object then null; end $$;

-- ============================================================================
-- PLANS
-- ============================================================================
create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  billing_period public.plan_billing_period not null default 'monthly',
  price_cents integer not null default 0,
  currency text not null default 'BRL',
  trial_days integer not null default 14,
  grace_period_days integer not null default 7,
  max_units integer,
  max_professionals integer,
  max_active_clients integer,
  max_storage_mb integer,
  status public.plan_status not null default 'public',
  is_default boolean not null default false,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_plans_status on public.plans(status);
create index if not exists idx_plans_order on public.plans(display_order);

alter table public.plans enable row level security;

drop policy if exists "plans: pÃºblico lÃª" on public.plans;
create policy "plans: pÃºblico lÃª" on public.plans
  for select to authenticated using (status = 'public' or is_super_admin(auth.uid()));

drop policy if exists "plans: super admin gerencia" on public.plans;
create policy "plans: super admin gerencia" on public.plans
  for all to authenticated using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

drop trigger if exists trg_plans_updated on public.plans;
create trigger trg_plans_updated before update on public.plans
  for each row execute function public.set_updated_at();

-- ============================================================================
-- PLAN FEATURES
-- ============================================================================
create table if not exists public.plan_features (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  feature_key text not null,
  label text not null,
  value_type public.feature_flag_value_type not null default 'boolean',
  value jsonb not null default 'true'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (plan_id, feature_key)
);
create index if not exists idx_plan_features_plan on public.plan_features(plan_id);

alter table public.plan_features enable row level security;

drop policy if exists "plan_features: pÃºblico lÃª" on public.plan_features;
create policy "plan_features: pÃºblico lÃª" on public.plan_features
  for select to authenticated using (
    exists (select 1 from public.plans p where p.id = plan_features.plan_id and (p.status = 'public' or is_super_admin(auth.uid())))
  );

drop policy if exists "plan_features: super admin gerencia" on public.plan_features;
create policy "plan_features: super admin gerencia" on public.plan_features
  for all to authenticated using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

-- ============================================================================
-- TENANT SUBSCRIPTIONS
-- ============================================================================
create table if not exists public.tenant_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique,
  plan_id uuid not null references public.plans(id),
  status public.subscription_status not null default 'trialing',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  canceled_at timestamptz,
  suspended_at timestamptz,
  overdue_since timestamptz,
  discount_cents integer not null default 0,
  discount_reason text,
  override_limits jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subs_tenant on public.tenant_subscriptions(tenant_id);
create index if not exists idx_subs_status on public.tenant_subscriptions(status);

alter table public.tenant_subscriptions enable row level security;

drop policy if exists "tenant_subs: super admin gerencia" on public.tenant_subscriptions;
create policy "tenant_subs: super admin gerencia" on public.tenant_subscriptions
  for all to authenticated using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

drop policy if exists "tenant_subs: owner/manager lÃª o prÃ³prio" on public.tenant_subscriptions;
create policy "tenant_subs: owner/manager lÃª o prÃ³prio" on public.tenant_subscriptions
  for select to authenticated using (
    has_any_tenant_role(auth.uid(), tenant_id, array['owner'::app_role, 'manager'::app_role])
  );

drop trigger if exists trg_subs_updated on public.tenant_subscriptions;
create trigger trg_subs_updated before update on public.tenant_subscriptions
  for each row execute function public.set_updated_at();

-- ============================================================================
-- SUBSCRIPTION EVENTS
-- ============================================================================
create table if not exists public.subscription_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  subscription_id uuid references public.tenant_subscriptions(id) on delete cascade,
  event_type public.subscription_event_type not null,
  from_plan_id uuid references public.plans(id),
  to_plan_id uuid references public.plans(id),
  from_status public.subscription_status,
  to_status public.subscription_status,
  actor_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_sub_events_tenant on public.subscription_events(tenant_id);
create index if not exists idx_sub_events_sub on public.subscription_events(subscription_id);

alter table public.subscription_events enable row level security;

drop policy if exists "sub_events: super admin gerencia" on public.subscription_events;
create policy "sub_events: super admin gerencia" on public.subscription_events
  for all to authenticated using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

drop policy if exists "sub_events: owner/manager lÃª" on public.subscription_events;
create policy "sub_events: owner/manager lÃª" on public.subscription_events
  for select to authenticated using (
    has_any_tenant_role(auth.uid(), tenant_id, array['owner'::app_role, 'manager'::app_role])
  );

-- ============================================================================
-- FEATURE FLAGS
-- ============================================================================
create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid,
  flag_key text not null,
  label text not null,
  description text,
  value_type public.feature_flag_value_type not null default 'boolean',
  value jsonb not null default 'false'::jsonb,
  is_global boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, flag_key)
);
create index if not exists idx_flags_tenant on public.feature_flags(tenant_id);
create index if not exists idx_flags_key on public.feature_flags(flag_key);

alter table public.feature_flags enable row level security;

drop policy if exists "feature_flags: super admin gerencia" on public.feature_flags;
create policy "feature_flags: super admin gerencia" on public.feature_flags
  for all to authenticated using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

drop policy if exists "feature_flags: tenant lÃª prÃ³prio + globais" on public.feature_flags;
create policy "feature_flags: tenant lÃª prÃ³prio + globais" on public.feature_flags
  for select to authenticated using (
    is_global = true
    or (tenant_id is not null and is_tenant_member(auth.uid(), tenant_id))
  );

drop trigger if exists trg_flags_updated on public.feature_flags;
create trigger trg_flags_updated before update on public.feature_flags
  for each row execute function public.set_updated_at();

-- ============================================================================
-- USAGE SNAPSHOTS
-- ============================================================================
create table if not exists public.usage_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  captured_at timestamptz not null default now(),
  units_count integer not null default 0,
  professionals_count integer not null default 0,
  active_clients_count integer not null default 0,
  storage_mb numeric not null default 0,
  appointments_last_30d integer not null default 0,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_usage_tenant_time on public.usage_snapshots(tenant_id, captured_at desc);

alter table public.usage_snapshots enable row level security;

drop policy if exists "usage: super admin gerencia" on public.usage_snapshots;
create policy "usage: super admin gerencia" on public.usage_snapshots
  for all to authenticated using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

drop policy if exists "usage: owner/manager lÃª prÃ³prio" on public.usage_snapshots;
create policy "usage: owner/manager lÃª prÃ³prio" on public.usage_snapshots
  for select to authenticated using (
    has_any_tenant_role(auth.uid(), tenant_id, array['owner'::app_role, 'manager'::app_role])
  );

-- ============================================================================
-- SEGMENT TEMPLATES
-- ============================================================================
create table if not exists public.segment_templates (
  id uuid primary key default gen_random_uuid(),
  segment text not null,
  name text not null,
  description text,
  payload jsonb not null default '{}'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_seg_templates_segment on public.segment_templates(segment);

alter table public.segment_templates enable row level security;

drop policy if exists "segment_templates: autenticado lÃª ativos" on public.segment_templates;
create policy "segment_templates: autenticado lÃª ativos" on public.segment_templates
  for select to authenticated using (is_active = true or is_super_admin(auth.uid()));

drop policy if exists "segment_templates: super admin gerencia" on public.segment_templates;
create policy "segment_templates: super admin gerencia" on public.segment_templates
  for all to authenticated using (is_super_admin(auth.uid())) with check (is_super_admin(auth.uid()));

drop trigger if exists trg_seg_templates_updated on public.segment_templates;
create trigger trg_seg_templates_updated before update on public.segment_templates
  for each row execute function public.set_updated_at();

-- ============================================================================
-- HELPER: efetivar limites considerando override do tenant
-- ============================================================================
create or replace function public.effective_subscription_limits(_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with sub as (
    select s.*, p.max_units, p.max_professionals, p.max_active_clients, p.max_storage_mb,
           p.code as plan_code, p.name as plan_name, p.trial_days, p.grace_period_days
    from public.tenant_subscriptions s
    join public.plans p on p.id = s.plan_id
    where s.tenant_id = _tenant_id
  )
  select jsonb_build_object(
    'plan_code', plan_code,
    'plan_name', plan_name,
    'status', status,
    'trial_ends_at', trial_ends_at,
    'current_period_end', current_period_end,
    'max_units', coalesce((override_limits->>'max_units')::int, max_units),
    'max_professionals', coalesce((override_limits->>'max_professionals')::int, max_professionals),
    'max_active_clients', coalesce((override_limits->>'max_active_clients')::int, max_active_clients),
    'max_storage_mb', coalesce((override_limits->>'max_storage_mb')::int, max_storage_mb)
  )
  from sub;
$$;

-- ============================================================================
-- SEED: planos default + features padrÃ£o
-- ============================================================================
insert into public.plans (code, name, description, billing_period, price_cents, trial_days, grace_period_days,
  max_units, max_professionals, max_active_clients, max_storage_mb, status, is_default, display_order)
values
  ('starter','Starter','Para comeÃ§ar pequeno','monthly', 9900, 14, 7, 1, 3, 500, 1024, 'public', false, 1),
  ('studio','Studio','Para o salÃ£o em crescimento','monthly', 19900, 14, 7, 2, 8, 2000, 5120, 'public', true, 2),
  ('pro','Pro','OperaÃ§Ã£o multiunidade','monthly', 39900, 14, 7, 5, 25, 10000, 20480, 'public', false, 3),
  ('enterprise','Enterprise','Sob medida','custom', 0, 30, 14, null, null, null, null, 'public', false, 4)
on conflict (code) do nothing;

insert into public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
select p.id, f.feature_key, f.label, f.value_type::public.feature_flag_value_type, f.value::jsonb, f.display_order
from public.plans p,
lateral (values
  ('agenda', 'Agenda completa', 'boolean', 'true', 1),
  ('confirmation_center', 'Central de ConfirmaÃ§Ã£o', 'boolean', 'true', 2),
  ('client_portal', 'Portal do cliente', 'boolean', case when p.code in ('studio','pro','enterprise') then 'true' else 'false' end, 3),
  ('analytics', 'Analytics + Ãndice Cativa', 'boolean', case when p.code in ('studio','pro','enterprise') then 'true' else 'false' end, 4),
  ('multi_unit', 'Multi-unidade', 'boolean', case when p.code in ('pro','enterprise') then 'true' else 'false' end, 5),
  ('packages_memberships', 'Pacotes & Memberships', 'boolean', 'true', 6),
  ('custom_branding', 'Branding customizado', 'boolean', case when p.code in ('pro','enterprise') then 'true' else 'false' end, 7)
) as f(feature_key, label, value_type, value, display_order)
where not exists (
  select 1 from public.plan_features pf where pf.plan_id = p.id and pf.feature_key = f.feature_key
);

-- ============================================================================
-- SEED: feature flags globais
-- ============================================================================
insert into public.feature_flags (tenant_id, flag_key, label, description, value_type, value, is_global)
values
  (null, 'enable_signups', 'Permitir novos cadastros', 'Controla se novos tenants podem se cadastrar', 'boolean', 'true', true),
  (null, 'maintenance_mode', 'Modo manutenÃ§Ã£o', 'Bloqueia acesso temporariamente', 'boolean', 'false', true),
  (null, 'show_cativa_index', 'Exibir Ãndice Cativa', 'Mostra a mÃ©trica proprietÃ¡ria', 'boolean', 'true', true)
on conflict (tenant_id, flag_key) do nothing;

-- ============================================================================
-- SEED: segment templates bÃ¡sicos
-- ============================================================================
insert into public.segment_templates (segment, name, description, payload, is_default, display_order)
values
  ('salao','SalÃ£o completo','Categorias: cabelo, coloraÃ§Ã£o, tratamentos. ServiÃ§os base.',
    '{"categories":["Cabelo","ColoraÃ§Ã£o","Tratamentos","Manicure"],"services":[{"name":"Corte feminino","duration":60,"price_cents":8000},{"name":"Escova","duration":45,"price_cents":6000}]}'::jsonb,
    true, 1),
  ('barbearia','Barbearia clÃ¡ssica','Cortes, barba, combo.',
    '{"categories":["Cortes","Barba"],"services":[{"name":"Corte masculino","duration":30,"price_cents":5000},{"name":"Barba","duration":30,"price_cents":4000},{"name":"Combo","duration":60,"price_cents":8000}]}'::jsonb,
    true, 1),
  ('clinica_estetica','ClÃ­nica de estÃ©tica','Protocolos e pacotes.',
    '{"categories":["Faciais","Corporais","DepilaÃ§Ã£o"],"services":[{"name":"Limpeza de pele","duration":60,"price_cents":15000}]}'::jsonb,
    true, 1),
  ('lash_brow','Lash & Brow','CÃ­lios e sobrancelhas.',
    '{"categories":["CÃ­lios","Sobrancelhas"],"services":[{"name":"Volume russo","duration":120,"price_cents":18000},{"name":"Design de sobrancelhas","duration":30,"price_cents":5000}]}'::jsonb,
    true, 1),
  ('esmalteria','Esmalteria','Manicure, pedicure, alongamento.',
    '{"categories":["MÃ£os","PÃ©s","Alongamento"],"services":[{"name":"Manicure","duration":45,"price_cents":4500}]}'::jsonb,
    true, 1),
  ('wellness','Massagem & Wellness','Relaxamento e terapias.',
    '{"categories":["Massagens","Terapias"],"services":[{"name":"Massagem relaxante","duration":60,"price_cents":15000}]}'::jsonb,
    true, 1)
on conflict do nothing;

--- 20260421223000_fase0_confirmation_portal_foundation.sql ---
-- =============================================================================
-- Cativa â€” Fase 0 â€” Fechamento estrutural para Central de ConfirmaÃ§Ã£o
-- e Portal do Cliente
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.confirmation_stage as enum (
    'today', 'tomorrow', 'upcoming', 'high_risk', 'premium', 'reschedule', 'recovery'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.confirmation_queue_status as enum (
    'pending', 'in_progress', 'confirmed', 'reschedule_requested',
    'canceled', 'no_response', 'follow_up_scheduled', 'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.contact_attempt_result as enum (
    'pending', 'sent', 'confirmed', 'reschedule_requested',
    'canceled', 'no_response', 'call_made', 'follow_up_scheduled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_channel as enum (
    'whatsapp', 'phone', 'email', 'sms', 'in_person'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_template_stage as enum (
    'confirmation', 'reminder', 'reschedule', 'cancellation',
    'recovery', 'reactivation', 'thanks', 'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.call_outcome as enum (
    'answered', 'no_answer', 'voicemail', 'wrong_number', 'busy', 'callback_requested'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.client_user_status as enum ('active', 'pending', 'blocked');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- MESSAGE TEMPLATES
-- -----------------------------------------------------------------------------
create table if not exists public.message_templates (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  unit_id     uuid references public.units(id) on delete cascade,
  service_id  uuid references public.services(id) on delete cascade,
  stage       public.message_template_stage not null,
  channel     public.message_channel not null default 'whatsapp',
  name        text not null,
  body        text not null,
  variables   jsonb not null default '[]'::jsonb,
  is_default  boolean not null default false,
  is_active   boolean not null default true,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_message_templates_tenant on public.message_templates(tenant_id, stage, is_active);
create index if not exists idx_message_templates_unit on public.message_templates(unit_id);
create index if not exists idx_message_templates_service on public.message_templates(service_id);

drop trigger if exists trg_message_templates_updated on public.message_templates;
create trigger trg_message_templates_updated
before update on public.message_templates
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- CONFIRMATION RULES
-- -----------------------------------------------------------------------------
create table if not exists public.confirmation_rules (
  id                            uuid primary key default gen_random_uuid(),
  tenant_id                     uuid not null references public.tenants(id) on delete cascade,
  unit_id                       uuid references public.units(id) on delete cascade,
  name                          text not null,
  stage                         public.confirmation_stage not null,
  hours_before_appointment      integer not null default 24,
  base_priority                 integer not null default 50,
  applies_to_vip                boolean not null default false,
  applies_to_protocol           boolean not null default false,
  applies_to_high_risk          boolean not null default false,
  min_appointment_value_cents   integer,
  skip_if_already_confirmed     boolean not null default true,
  is_active                     boolean not null default true,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);

create index if not exists idx_confirmation_rules_tenant on public.confirmation_rules(tenant_id, stage, is_active);
create index if not exists idx_confirmation_rules_unit on public.confirmation_rules(unit_id);

drop trigger if exists trg_confirmation_rules_updated on public.confirmation_rules;
create trigger trg_confirmation_rules_updated
before update on public.confirmation_rules
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- CONFIRMATION QUEUE
-- -----------------------------------------------------------------------------
create table if not exists public.confirmation_queue (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,
  appointment_id         uuid not null references public.appointments(id) on delete cascade,
  client_id              uuid not null references public.clients(id) on delete cascade,
  rule_id                uuid references public.confirmation_rules(id) on delete set null,
  stage                  public.confirmation_stage not null,
  status                 public.confirmation_queue_status not null default 'pending',
  priority               integer not null default 50,
  scheduled_for          timestamptz not null default now(),
  appointment_starts_at  timestamptz not null,
  assigned_to            uuid references auth.users(id) on delete set null,
  last_attempt_at        timestamptz,
  attempts_count         integer not null default 0,
  follow_up_at           timestamptz,
  closed_at              timestamptz,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_confirmation_queue_tenant on public.confirmation_queue(tenant_id, stage, status, priority desc);
create index if not exists idx_confirmation_queue_appt on public.confirmation_queue(appointment_id, stage);
create index if not exists idx_confirmation_queue_client on public.confirmation_queue(client_id);
create index if not exists idx_confirmation_queue_scheduled on public.confirmation_queue(scheduled_for);

drop trigger if exists trg_confirmation_queue_updated on public.confirmation_queue;
create trigger trg_confirmation_queue_updated
before update on public.confirmation_queue
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- CONTACT ATTEMPTS
-- -----------------------------------------------------------------------------
create table if not exists public.contact_attempts (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  queue_id         uuid references public.confirmation_queue(id) on delete set null,
  appointment_id   uuid references public.appointments(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete cascade,
  template_id      uuid references public.message_templates(id) on delete set null,
  channel          public.message_channel not null,
  result           public.contact_attempt_result not null default 'pending',
  message_preview  text,
  notes            text,
  attempted_by     uuid references auth.users(id) on delete set null,
  attempted_at     timestamptz not null default now(),
  follow_up_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists idx_contact_attempts_tenant on public.contact_attempts(tenant_id, attempted_at desc);
create index if not exists idx_contact_attempts_queue on public.contact_attempts(queue_id, attempted_at desc);
create index if not exists idx_contact_attempts_client on public.contact_attempts(client_id, attempted_at desc);

-- -----------------------------------------------------------------------------
-- CALL LOGS
-- -----------------------------------------------------------------------------
create table if not exists public.call_logs (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,
  appointment_id    uuid references public.appointments(id) on delete cascade,
  queue_id          uuid references public.confirmation_queue(id) on delete set null,
  outcome           public.call_outcome not null,
  duration_seconds  integer,
  notes             text,
  called_by         uuid references auth.users(id) on delete set null,
  called_at         timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists idx_call_logs_tenant on public.call_logs(tenant_id, called_at desc);
create index if not exists idx_call_logs_queue on public.call_logs(queue_id, called_at desc);
create index if not exists idx_call_logs_client on public.call_logs(client_id, called_at desc);

-- -----------------------------------------------------------------------------
-- CHANNEL PREFERENCES
-- -----------------------------------------------------------------------------
create table if not exists public.channel_preferences (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  client_id               uuid not null references public.clients(id) on delete cascade,
  preferred_channel       public.message_channel not null default 'whatsapp',
  fallback_channel        public.message_channel,
  preferred_window_start  time,
  preferred_window_end    time,
  do_not_disturb          boolean not null default false,
  notes                   text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (tenant_id, client_id)
);

create index if not exists idx_channel_preferences_tenant on public.channel_preferences(tenant_id);

drop trigger if exists trg_channel_preferences_updated on public.channel_preferences;
create trigger trg_channel_preferences_updated
before update on public.channel_preferences
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- CLIENT USERS (vÃ­nculo auth.user â†” client)
-- -----------------------------------------------------------------------------
create table if not exists public.client_users (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  status        public.client_user_status not null default 'active',
  linked_at     timestamptz not null default now(),
  last_seen_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists idx_client_users_client on public.client_users(client_id);
create index if not exists idx_client_users_user on public.client_users(user_id);

drop trigger if exists trg_client_users_updated on public.client_users;
create trigger trg_client_users_updated
before update on public.client_users
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- CLIENT REVIEWS
-- -----------------------------------------------------------------------------
create table if not exists public.client_reviews (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  client_id         uuid not null references public.clients(id) on delete cascade,
  appointment_id    uuid not null unique references public.appointments(id) on delete cascade,
  professional_id   uuid references public.professionals(id) on delete set null,
  rating            integer not null check (rating between 1 and 5),
  comment           text,
  would_recommend   boolean,
  is_public         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_client_reviews_tenant on public.client_reviews(tenant_id, created_at desc);
create index if not exists idx_client_reviews_client on public.client_reviews(client_id, created_at desc);
create index if not exists idx_client_reviews_pro on public.client_reviews(professional_id, created_at desc);

drop trigger if exists trg_client_reviews_updated on public.client_reviews;
create trigger trg_client_reviews_updated
before update on public.client_reviews
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- HELPERS DO PORTAL
-- -----------------------------------------------------------------------------
create or replace function public.client_user_tenant(_tenant_id uuid, _user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select cu.client_id
  from public.client_users cu
  where cu.tenant_id = _tenant_id
    and cu.user_id = _user_id
    and cu.status = 'active'
  limit 1;
$$;

create or replace function public.is_portal_client_of(_client_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.client_users cu
    where cu.client_id = _client_id
      and cu.user_id = _user_id
      and cu.status = 'active'
  );
$$;

create or replace function public.client_owns_appointment(_appointment_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    join public.client_users cu
      on cu.client_id = a.client_id
     and cu.tenant_id = a.tenant_id
     and cu.status = 'active'
    where a.id = _appointment_id
      and cu.user_id = _user_id
  );
$$;

create or replace function public.calculate_queue_priority(
  _tenant_id uuid,
  _client_id uuid,
  _appointment_id uuid,
  _stage public.confirmation_stage,
  _base_priority integer default 50
)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _priority integer := coalesce(_base_priority, 50);
  _risk public.client_risk_level;
  _is_vip boolean := false;
  _starts_at timestamptz;
  _value_cents integer := 0;
  _hours_to_appt numeric := 0;
begin
  select c.risk_level, c.is_vip
    into _risk, _is_vip
  from public.clients c
  where c.id = _client_id
    and c.tenant_id = _tenant_id;

  select a.starts_at, a.total_price_cents
    into _starts_at, _value_cents
  from public.appointments a
  where a.id = _appointment_id
    and a.tenant_id = _tenant_id;

  if _starts_at is not null then
    _hours_to_appt := extract(epoch from (_starts_at - now())) / 3600.0;
  end if;

  case _stage
    when 'today' then _priority := _priority + 20;
    when 'tomorrow' then _priority := _priority + 12;
    when 'upcoming' then _priority := _priority + 5;
    when 'high_risk' then _priority := _priority + 25;
    when 'premium' then _priority := _priority + 18;
    when 'reschedule' then _priority := _priority + 22;
    when 'recovery' then _priority := _priority + 16;
  end case;

  if _risk = 'high' then
    _priority := _priority + 22;
  elsif _risk = 'medium' then
    _priority := _priority + 10;
  end if;

  if coalesce(_is_vip, false) then
    _priority := _priority + 15;
  end if;

  if coalesce(_value_cents, 0) >= 50000 then
    _priority := _priority + 15;
  elsif coalesce(_value_cents, 0) >= 30000 then
    _priority := _priority + 8;
  end if;

  if _hours_to_appt <= 4 then
    _priority := _priority + 18;
  elsif _hours_to_appt <= 24 then
    _priority := _priority + 10;
  elsif _hours_to_appt <= 48 then
    _priority := _priority + 4;
  end if;

  return least(greatest(_priority, 0), 100);
end;
$$;

-- -----------------------------------------------------------------------------
-- ENABLE RLS
-- -----------------------------------------------------------------------------
alter table public.message_templates      enable row level security;
alter table public.confirmation_rules     enable row level security;
alter table public.confirmation_queue     enable row level security;
alter table public.contact_attempts       enable row level security;
alter table public.call_logs              enable row level security;
alter table public.channel_preferences    enable row level security;
alter table public.client_users           enable row level security;
alter table public.client_reviews         enable row level security;

-- -----------------------------------------------------------------------------
-- POLICIES â€” NOVAS TABELAS
-- -----------------------------------------------------------------------------
drop policy if exists "message_templates: membros leem" on public.message_templates;
create policy "message_templates: membros leem"
on public.message_templates for select to authenticated
using (
  public.is_tenant_member(auth.uid(), tenant_id)
  or public.is_super_admin(auth.uid())
);

drop policy if exists "message_templates: gestor configura" on public.message_templates;
create policy "message_templates: gestor configura"
on public.message_templates for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "confirmation_rules: membros leem" on public.confirmation_rules;
create policy "confirmation_rules: membros leem"
on public.confirmation_rules for select to authenticated
using (
  public.is_tenant_member(auth.uid(), tenant_id)
  or public.is_super_admin(auth.uid())
);

drop policy if exists "confirmation_rules: gestor configura" on public.confirmation_rules;
create policy "confirmation_rules: gestor configura"
on public.confirmation_rules for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "confirmation_queue: equipe le" on public.confirmation_queue;
create policy "confirmation_queue: equipe le"
on public.confirmation_queue for select to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "confirmation_queue: equipe gerencia" on public.confirmation_queue;
create policy "confirmation_queue: equipe gerencia"
on public.confirmation_queue for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "contact_attempts: equipe le" on public.contact_attempts;
create policy "contact_attempts: equipe le"
on public.contact_attempts for select to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "contact_attempts: equipe registra" on public.contact_attempts;
create policy "contact_attempts: equipe registra"
on public.contact_attempts for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "call_logs: equipe le" on public.call_logs;
create policy "call_logs: equipe le"
on public.call_logs for select to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "call_logs: equipe registra" on public.call_logs;
create policy "call_logs: equipe registra"
on public.call_logs for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "channel_preferences: equipe le" on public.channel_preferences;
create policy "channel_preferences: equipe le"
on public.channel_preferences for select to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "channel_preferences: equipe gerencia" on public.channel_preferences;
create policy "channel_preferences: equipe gerencia"
on public.channel_preferences for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "channel_preferences: cliente le o proprio" on public.channel_preferences;
create policy "channel_preferences: cliente le o proprio"
on public.channel_preferences for select to authenticated
using (public.is_portal_client_of(client_id, auth.uid()));

drop policy if exists "channel_preferences: cliente gerencia o proprio" on public.channel_preferences;
create policy "channel_preferences: cliente gerencia o proprio"
on public.channel_preferences for all to authenticated
using (public.is_portal_client_of(client_id, auth.uid()))
with check (public.is_portal_client_of(client_id, auth.uid()));

drop policy if exists "client_users: proprio le" on public.client_users;
create policy "client_users: proprio le"
on public.client_users for select to authenticated
using (
  user_id = auth.uid()
  or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "client_users: proprio cria por email" on public.client_users;
create policy "client_users: proprio cria por email"
on public.client_users for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.clients c
    where c.id = client_id
      and c.tenant_id = tenant_id
      and c.email is not null
      and lower(c.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
);

drop policy if exists "client_users: equipe gerencia" on public.client_users;
create policy "client_users: equipe gerencia"
on public.client_users for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "client_reviews: equipe le" on public.client_reviews;
create policy "client_reviews: equipe le"
on public.client_reviews for select to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

drop policy if exists "client_reviews: cliente le o proprio" on public.client_reviews;
create policy "client_reviews: cliente le o proprio"
on public.client_reviews for select to authenticated
using (public.is_portal_client_of(client_id, auth.uid()));

drop policy if exists "client_reviews: cliente cria o proprio" on public.client_reviews;
create policy "client_reviews: cliente cria o proprio"
on public.client_reviews for insert to authenticated
with check (
  public.is_portal_client_of(client_id, auth.uid())
  and public.client_owns_appointment(appointment_id, auth.uid())
);

drop policy if exists "client_reviews: cliente atualiza o proprio" on public.client_reviews;
create policy "client_reviews: cliente atualiza o proprio"
on public.client_reviews for update to authenticated
using (public.is_portal_client_of(client_id, auth.uid()))
with check (public.is_portal_client_of(client_id, auth.uid()));

-- -----------------------------------------------------------------------------
-- POLICIES â€” PORTAL DO CLIENTE EM TABELAS JÃ EXISTENTES
-- -----------------------------------------------------------------------------
drop policy if exists "tenants: portal cliente le o proprio tenant" on public.tenants;
create policy "tenants: portal cliente le o proprio tenant"
on public.tenants for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.tenant_id = id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "units: portal cliente le unidades do tenant" on public.units;
create policy "units: portal cliente le unidades do tenant"
on public.units for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.tenant_id = units.tenant_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "services: portal cliente le servicos ativos do tenant" on public.services;
create policy "services: portal cliente le servicos ativos do tenant"
on public.services for select to authenticated
using (
  is_active = true
  and exists (
    select 1 from public.client_users cu
    where cu.tenant_id = services.tenant_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "professionals: portal cliente le profissionais ativos do tenant" on public.professionals;
create policy "professionals: portal cliente le profissionais ativos do tenant"
on public.professionals for select to authenticated
using (
  is_active = true
  and exists (
    select 1 from public.client_users cu
    where cu.tenant_id = professionals.tenant_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "cancellation_policies: portal cliente le" on public.cancellation_policies;
create policy "cancellation_policies: portal cliente le"
on public.cancellation_policies for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.tenant_id = cancellation_policies.tenant_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "packages: portal cliente le" on public.packages;
create policy "packages: portal cliente le"
on public.packages for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.tenant_id = packages.tenant_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "memberships: portal cliente le" on public.memberships;
create policy "memberships: portal cliente le"
on public.memberships for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.tenant_id = memberships.tenant_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "membership_benefits: portal cliente le" on public.membership_benefits;
create policy "membership_benefits: portal cliente le"
on public.membership_benefits for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.tenant_id = membership_benefits.tenant_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "client_package_balances: portal cliente le o proprio" on public.client_package_balances;
create policy "client_package_balances: portal cliente le o proprio"
on public.client_package_balances for select to authenticated
using (public.is_portal_client_of(client_id, auth.uid()));

drop policy if exists "client_membership_subs: portal cliente le o proprio" on public.client_membership_subscriptions;
create policy "client_membership_subs: portal cliente le o proprio"
on public.client_membership_subscriptions for select to authenticated
using (public.is_portal_client_of(client_id, auth.uid()));

drop policy if exists "clients: portal cliente le o proprio" on public.clients;
create policy "clients: portal cliente le o proprio"
on public.clients for select to authenticated
using (public.is_portal_client_of(id, auth.uid()));

drop policy if exists "clients: portal cliente atualiza o proprio" on public.clients;
create policy "clients: portal cliente atualiza o proprio"
on public.clients for update to authenticated
using (public.is_portal_client_of(id, auth.uid()))
with check (public.is_portal_client_of(id, auth.uid()));

drop policy if exists "appointments: portal cliente le os proprios" on public.appointments;
create policy "appointments: portal cliente le os proprios"
on public.appointments for select to authenticated
using (public.client_owns_appointment(id, auth.uid()));

drop policy if exists "appointments: portal cliente cria os proprios" on public.appointments;
create policy "appointments: portal cliente cria os proprios"
on public.appointments for insert to authenticated
with check (
  client_id = public.client_user_tenant(tenant_id, auth.uid())
);

drop policy if exists "appointments: portal cliente atualiza os proprios" on public.appointments;
create policy "appointments: portal cliente atualiza os proprios"
on public.appointments for update to authenticated
using (public.client_owns_appointment(id, auth.uid()))
with check (
  client_id = public.client_user_tenant(tenant_id, auth.uid())
);

drop policy if exists "appointment_items: portal cliente le os proprios" on public.appointment_items;
create policy "appointment_items: portal cliente le os proprios"
on public.appointment_items for select to authenticated
using (
  public.client_owns_appointment(appointment_id, auth.uid())
);

drop policy if exists "consent_templates: portal cliente le" on public.consent_form_templates;
create policy "consent_templates: portal cliente le"
on public.consent_form_templates for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.tenant_id = consent_form_templates.tenant_id
      and cu.user_id = auth.uid()
      and cu.status = 'active'
  )
);

drop policy if exists "consent_responses: portal cliente le o proprio" on public.consent_form_responses;
create policy "consent_responses: portal cliente le o proprio"
on public.consent_form_responses for select to authenticated
using (public.is_portal_client_of(client_id, auth.uid()));

drop policy if exists "consent_responses: portal cliente assina o proprio" on public.consent_form_responses;
create policy "consent_responses: portal cliente assina o proprio"
on public.consent_form_responses for update to authenticated
using (public.is_portal_client_of(client_id, auth.uid()))
with check (public.is_portal_client_of(client_id, auth.uid()));

--- 20260421235500_fase5_portal_access_claims.sql ---
-- =============================================================================
-- Cativa â€” Fase 5 â€” Auto-vinculo do Portal do Cliente por e-mail autenticado
-- =============================================================================

create or replace function public.claim_portal_links_for_current_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _count integer := 0;
begin
  if _uid is null or _email = '' then
    return 0;
  end if;

  insert into public.client_users (
    tenant_id,
    client_id,
    user_id,
    status,
    linked_at,
    last_seen_at
  )
  select distinct on (c.tenant_id)
    c.tenant_id,
    c.id,
    _uid,
    'active'::public.client_user_status,
    now(),
    now()
  from public.clients c
  where c.email is not null
    and lower(c.email) = _email
  order by c.tenant_id, c.updated_at desc, c.created_at desc
  on conflict (tenant_id, user_id) do update
  set
    client_id = excluded.client_id,
    status = 'active',
    last_seen_at = now(),
    updated_at = now();

  get diagnostics _count = row_count;
  return coalesce(_count, 0);
end;
$$;

grant execute on function public.claim_portal_links_for_current_user() to authenticated;

create or replace function public.touch_portal_last_seen(_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.client_users
  set
    last_seen_at = now(),
    updated_at = now()
  where id = _link_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.touch_portal_last_seen(uuid) to authenticated;

--- 20260422062833_05a6d97b-03cf-4796-8ea0-8becc7f02f38.sql ---
create or replace function public.claim_portal_links_for_current_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _count integer := 0;
begin
  if _uid is null or _email = '' then
    return 0;
  end if;

  insert into public.client_users (
    tenant_id,
    client_id,
    user_id,
    status,
    linked_at,
    last_seen_at
  )
  select distinct on (c.tenant_id)
    c.tenant_id,
    c.id,
    _uid,
    'active'::public.client_user_status,
    now(),
    now()
  from public.clients c
  where c.email is not null
    and lower(c.email) = _email
  order by c.tenant_id, c.updated_at desc, c.created_at desc
  on conflict (tenant_id, user_id) do update
  set
    client_id = excluded.client_id,
    status = 'active',
    last_seen_at = now(),
    updated_at = now();

  get diagnostics _count = row_count;
  return coalesce(_count, 0);
end;
$$;

grant execute on function public.claim_portal_links_for_current_user() to authenticated;

create or replace function public.touch_portal_last_seen(_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.client_users
  set
    last_seen_at = now(),
    updated_at = now()
  where id = _link_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.touch_portal_last_seen(uuid) to authenticated;

--- 20260422100919_a2fc1bac-a3f7-4e57-957d-8c9501bdb5a0.sql ---
CREATE OR REPLACE FUNCTION public.start_default_trial(_tenant_id uuid)
RETURNS public.tenant_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing public.tenant_subscriptions;
  v_plan public.plans;
  v_now timestamptz := now();
  v_trial_end timestamptz;
  v_inserted public.tenant_subscriptions;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'UsuÃ¡rio nÃ£o autenticado.' USING ERRCODE = '42501';
  END IF;

  IF NOT (
    public.has_any_tenant_role(v_user, _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissÃ£o para ativar trial neste tenant.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
    FROM public.tenant_subscriptions
   WHERE tenant_id = _tenant_id
   LIMIT 1;
  IF FOUND THEN
    RETURN v_existing;
  END IF;

  SELECT * INTO v_plan
    FROM public.plans
   WHERE is_default = true AND status = 'public'
   ORDER BY display_order
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_plan
      FROM public.plans
     WHERE status = 'public'
     ORDER BY display_order
     LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    SELECT * INTO v_plan FROM public.plans ORDER BY display_order LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum plano disponÃ­vel para iniciar o trial.' USING ERRCODE = 'P0002';
  END IF;

  v_trial_end := v_now + (COALESCE(v_plan.trial_days, 14) || ' days')::interval;

  INSERT INTO public.tenant_subscriptions (
    tenant_id,
    plan_id,
    status,
    trial_started_at,
    trial_ends_at,
    current_period_start,
    current_period_end
  )
  VALUES (
    _tenant_id,
    v_plan.id,
    'trialing',
    v_now,
    v_trial_end,
    v_now,
    v_trial_end
  )
  RETURNING * INTO v_inserted;

  BEGIN
    INSERT INTO public.subscription_events (
      tenant_id, subscription_id, event_type, to_status, to_plan_id, notes
    ) VALUES (
      _tenant_id,
      v_inserted.id,
      'trial_started',
      'trialing',
      v_plan.id,
      'Trial padrÃ£o de ' || COALESCE(v_plan.trial_days, 14) || ' dias iniciado pelo prÃ³prio tenant.'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.start_default_trial(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_default_trial(uuid) TO authenticated;

COMMENT ON FUNCTION public.start_default_trial(uuid) IS
  'Ativa idempotentemente o trial padrÃ£o para o tenant. Requer owner/manager do tenant ou super_admin.';

--- 20260422101123_b3153323-4f35-42cc-b436-c04292f5e811.sql ---
ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2);

COMMENT ON COLUMN public.professionals.email IS 'E-mail de contato profissional (uso interno).';
COMMENT ON COLUMN public.professionals.phone IS 'Telefone de contato profissional (uso interno).';
COMMENT ON COLUMN public.professionals.specialty IS 'Especialidade/Ã¡rea de atuaÃ§Ã£o principal.';
COMMENT ON COLUMN public.professionals.commission_pct IS 'ComissÃ£o padrÃ£o em % (0-100). Pode ser sobrescrita por regra futura.';

ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_commission_pct_range;

ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_commission_pct_range
  CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100));

--- 20260422101742_d5e08407-48dd-41f1-a916-83789d1baced.sql ---
-- Bucket pÃºblico para logos dos tenants
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pÃºblica (a UI exibe o logo no portal e em links externos)
DROP POLICY IF EXISTS "tenant-logos: public read" ON storage.objects;
CREATE POLICY "tenant-logos: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos');

-- Upload: apenas owner/manager do tenant cuja UUID Ã© a primeira pasta do path
DROP POLICY IF EXISTS "tenant-logos: managers upload" ON storage.objects;
CREATE POLICY "tenant-logos: managers upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::app_role, 'manager'::app_role]
    )
    OR public.is_super_admin(auth.uid())
  )
);

-- Update: idem
DROP POLICY IF EXISTS "tenant-logos: managers update" ON storage.objects;
CREATE POLICY "tenant-logos: managers update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::app_role, 'manager'::app_role]
    )
    OR public.is_super_admin(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::app_role, 'manager'::app_role]
    )
    OR public.is_super_admin(auth.uid())
  )
);

-- Delete: idem
DROP POLICY IF EXISTS "tenant-logos: managers delete" ON storage.objects;
CREATE POLICY "tenant-logos: managers delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::app_role, 'manager'::app_role]
    )
    OR public.is_super_admin(auth.uid())
  )
);

--- 20260422140233_8a781012-c660-47e7-b141-abc145616ff6.sql ---
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
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
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

-- Ãšnico convite pendente por (tenant, email)
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

drop policy if exists "team_invitations: convidado lÃª prÃ³prio" on public.team_invitations;
create policy "team_invitations: convidado lÃª prÃ³prio"
  on public.team_invitations
  for select
  to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- ============================================================================
-- FunÃ§Ã£o: aceitar convite via token
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
    raise exception 'UsuÃ¡rio nÃ£o autenticado.' using errcode = '42501';
  end if;
  if v_email = '' then
    raise exception 'E-mail do usuÃ¡rio nÃ£o disponÃ­vel na sessÃ£o.' using errcode = '22023';
  end if;

  select * into v_invite
    from public.team_invitations
   where token = _token
   limit 1;

  if not found then
    raise exception 'Convite nÃ£o encontrado.' using errcode = 'P0002';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'Este convite jÃ¡ foi aceito.' using errcode = '22023';
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

  -- Enforcement: max_professionals quando o papel Ã© "professional"
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

  -- Se jÃ¡ existe membership, apenas reativa/atualiza
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
-- FunÃ§Ã£o: revogar convite pendente
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
    raise exception 'UsuÃ¡rio nÃ£o autenticado.' using errcode = '42501';
  end if;

  select * into v_invite from public.team_invitations where id = _invitation_id;
  if not found then
    raise exception 'Convite nÃ£o encontrado.' using errcode = 'P0002';
  end if;

  if not (
    public.has_any_tenant_role(v_user, v_invite.tenant_id, array['owner'::public.app_role, 'manager'::public.app_role])
    or public.is_super_admin(v_user)
  ) then
    raise exception 'Sem permissÃ£o para revogar este convite.' using errcode = '42501';
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
-- FunÃ§Ã£o: listar convites pendentes para o usuÃ¡rio corrente (claim)
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

--- 20260422180552_d74cc2d2-8ddf-462d-a33f-9a35c77e8464.sql ---
-- Lista todos os memberships do sistema com dados denormalizados (super admin only)
CREATE OR REPLACE FUNCTION public.admin_list_tenant_memberships()
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  role public.app_role,
  status public.membership_status,
  user_full_name text,
  user_email text,
  user_is_super_admin boolean,
  invited_email text,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tm.id,
    tm.user_id,
    tm.tenant_id,
    t.name,
    t.slug,
    tm.role,
    tm.status,
    p.full_name,
    u.email::text,
    COALESCE(p.is_super_admin, false),
    tm.invited_email,
    tm.invited_at,
    tm.accepted_at,
    tm.created_at,
    tm.updated_at
  FROM public.tenant_memberships tm
  LEFT JOIN public.tenants t ON t.id = tm.tenant_id
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  LEFT JOIN auth.users u ON u.id = tm.user_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY t.name NULLS LAST, p.full_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_list_tenant_memberships() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_tenant_memberships() TO authenticated;

-- Atualiza papel de um membro (super admin only)
CREATE OR REPLACE FUNCTION public.admin_update_membership_role(
  p_membership_id uuid,
  p_new_role public.app_role
)
RETURNS public.tenant_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.tenant_memberships;
  v_new public.tenant_memberships;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode alterar papÃ©is' USING errcode = '42501';
  END IF;

  SELECT * INTO v_old FROM public.tenant_memberships WHERE id = p_membership_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'VÃ­nculo nÃ£o encontrado' USING errcode = 'P0002';
  END IF;

  UPDATE public.tenant_memberships
    SET role = p_new_role, updated_at = now()
    WHERE id = p_membership_id
    RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_new.tenant_id,
    auth.uid(),
    'admin.membership.role_changed',
    'tenant_membership',
    v_new.id,
    jsonb_build_object(
      'user_id', v_new.user_id,
      'from_role', v_old.role,
      'to_role', v_new.role
    )
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_membership_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_membership_role(uuid, public.app_role) TO authenticated;

-- Atualiza status de um membro (super admin only)
CREATE OR REPLACE FUNCTION public.admin_update_membership_status(
  p_membership_id uuid,
  p_new_status public.membership_status
)
RETURNS public.tenant_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.tenant_memberships;
  v_new public.tenant_memberships;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode alterar status' USING errcode = '42501';
  END IF;

  SELECT * INTO v_old FROM public.tenant_memberships WHERE id = p_membership_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'VÃ­nculo nÃ£o encontrado' USING errcode = 'P0002';
  END IF;

  UPDATE public.tenant_memberships
    SET status = p_new_status,
        accepted_at = CASE
          WHEN p_new_status = 'active' AND v_old.accepted_at IS NULL THEN now()
          ELSE v_old.accepted_at
        END,
        updated_at = now()
    WHERE id = p_membership_id
    RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_new.tenant_id,
    auth.uid(),
    'admin.membership.status_changed',
    'tenant_membership',
    v_new.id,
    jsonb_build_object(
      'user_id', v_new.user_id,
      'from_status', v_old.status,
      'to_status', v_new.status
    )
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_membership_status(uuid, public.membership_status) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_membership_status(uuid, public.membership_status) TO authenticated;

-- Promove/remove super admin (super admin only) â€” nÃ£o permite remover a si mesmo
CREATE OR REPLACE FUNCTION public.admin_set_super_admin(
  p_user_id uuid,
  p_is_super boolean
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old boolean;
  v_new public.profiles;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode alterar super admins' USING errcode = '42501';
  END IF;

  IF p_user_id = auth.uid() AND p_is_super = false THEN
    RAISE EXCEPTION 'NÃ£o Ã© possÃ­vel remover seu prÃ³prio acesso de super admin' USING errcode = 'P0001';
  END IF;

  SELECT is_super_admin INTO v_old FROM public.profiles WHERE id = p_user_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Perfil nÃ£o encontrado' USING errcode = 'P0002';
  END IF;

  UPDATE public.profiles
    SET is_super_admin = p_is_super, updated_at = now()
    WHERE id = p_user_id
    RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    NULL,
    auth.uid(),
    CASE WHEN p_is_super THEN 'admin.super_admin.granted' ELSE 'admin.super_admin.revoked' END,
    'profile',
    p_user_id,
    jsonb_build_object('from', v_old, 'to', p_is_super)
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_super_admin(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_super_admin(uuid, boolean) TO authenticated;

--- 20260422182209_4709701f-8f45-4a7d-baba-45f527e350dd.sql ---
-- 1) Lista global de tenants (com contagens) para super admin
CREATE OR REPLACE FUNCTION public.admin_list_all_tenants()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  segment public.tenant_segment,
  created_at timestamptz,
  updated_at timestamptz,
  member_count bigint,
  unit_count bigint,
  client_count bigint,
  subscription_status public.subscription_status,
  plan_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.name,
    t.slug,
    t.segment,
    t.created_at,
    t.updated_at,
    (SELECT count(*) FROM public.tenant_memberships m WHERE m.tenant_id = t.id AND m.status = 'active') AS member_count,
    (SELECT count(*) FROM public.units u WHERE u.tenant_id = t.id) AS unit_count,
    (SELECT count(*) FROM public.clients c WHERE c.tenant_id = t.id) AS client_count,
    s.status,
    p.name
  FROM public.tenants t
  LEFT JOIN public.tenant_subscriptions s ON s.tenant_id = t.id
  LEFT JOIN public.plans p ON p.id = s.plan_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY t.name NULLS LAST;
$$;

-- 2) Auditoria global navegÃ¡vel
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(
  _tenant_id uuid DEFAULT NULL,
  _actor_id uuid DEFAULT NULL,
  _action_prefix text DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL,
  _limit int DEFAULT 200
)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  tenant_name text,
  actor_id uuid,
  actor_name text,
  actor_email text,
  action text,
  entity text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.tenant_id,
    t.name,
    a.actor_id,
    p.full_name,
    u.email::text,
    a.action,
    a.entity,
    a.entity_id,
    a.metadata,
    a.created_at
  FROM public.audit_logs a
  LEFT JOIN public.tenants t ON t.id = a.tenant_id
  LEFT JOIN public.profiles p ON p.id = a.actor_id
  LEFT JOIN auth.users u ON u.id = a.actor_id
  WHERE public.is_super_admin(auth.uid())
    AND (_tenant_id IS NULL OR a.tenant_id = _tenant_id)
    AND (_actor_id IS NULL OR a.actor_id = _actor_id)
    AND (_action_prefix IS NULL OR a.action ILIKE (_action_prefix || '%'))
    AND (_from IS NULL OR a.created_at >= _from)
    AND (_to IS NULL OR a.created_at <= _to)
  ORDER BY a.created_at DESC
  LIMIT GREATEST(LEAST(COALESCE(_limit, 200), 1000), 1);
$$;

-- 3) ImpersonaÃ§Ã£o: log de inÃ­cio e fim
CREATE OR REPLACE FUNCTION public.admin_log_impersonation_start(
  _tenant_id uuid,
  _reason text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_tenant public.tenants;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode impersonar tenants' USING errcode = '42501';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant nÃ£o encontrado' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id,
    auth.uid(),
    'admin.impersonation.started',
    'tenant',
    _tenant_id,
    jsonb_build_object('tenant_name', v_tenant.name, 'reason', _reason)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_log_impersonation_end(_tenant_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode encerrar impersonaÃ§Ã£o' USING errcode = '42501';
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id,
    auth.uid(),
    'admin.impersonation.ended',
    'tenant',
    _tenant_id,
    jsonb_build_object()
  );
END;
$$;

-- 4) Editar tenant (nome, slug, segmento) â€” somente super admin
CREATE OR REPLACE FUNCTION public.admin_update_tenant(
  _tenant_id uuid,
  _name text DEFAULT NULL,
  _slug text DEFAULT NULL,
  _segment public.tenant_segment DEFAULT NULL
)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.tenants;
  v_new public.tenants;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode editar tenants' USING errcode = '42501';
  END IF;

  SELECT * INTO v_old FROM public.tenants WHERE id = _tenant_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Tenant nÃ£o encontrado' USING errcode = 'P0002';
  END IF;

  UPDATE public.tenants
     SET name = COALESCE(_name, name),
         slug = COALESCE(_slug, slug),
         segment = COALESCE(_segment, segment),
         updated_at = now()
   WHERE id = _tenant_id
   RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id,
    auth.uid(),
    'admin.tenant.updated',
    'tenant',
    _tenant_id,
    jsonb_build_object(
      'from', jsonb_build_object('name', v_old.name, 'slug', v_old.slug, 'segment', v_old.segment),
      'to',   jsonb_build_object('name', v_new.name, 'slug', v_new.slug, 'segment', v_new.segment)
    )
  );

  RETURN v_new;
END;
$$;

--- 20260422190104_dd45fa86-d6f2-427f-968d-63c2fb852699.sql ---
-- =====================================================================
-- Super Admin: provisionar usuÃ¡rios (convite) + gerenciar memberships
-- de clientes (pacotes e assinaturas recorrentes) em qualquer tenant.
-- Tudo com SECURITY DEFINER + auditoria em audit_logs.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Provisionar usuÃ¡rio em qualquer tenant via convite (token)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_provision_team_invitation(
  _tenant_id uuid,
  _email text,
  _role app_role,
  _message text DEFAULT NULL,
  _expires_in_days integer DEFAULT 14
)
RETURNS public.team_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(_email));
  v_invite public.team_invitations;
  v_existing public.team_invitations;
  v_tenant public.tenants;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode provisionar usuÃ¡rios' USING errcode = '42501';
  END IF;

  IF v_email IS NULL OR v_email !~ '^.+@.+\..+$' THEN
    RAISE EXCEPTION 'E-mail invÃ¡lido' USING errcode = '22023';
  END IF;

  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel invÃ¡lido para convite de equipe' USING errcode = '22023';
  END IF;

  SELECT * INTO v_tenant FROM public.tenants WHERE id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant nÃ£o encontrado' USING errcode = 'P0002';
  END IF;

  -- Reaproveita convite pendente em vez de duplicar
  SELECT * INTO v_existing
    FROM public.team_invitations
   WHERE tenant_id = _tenant_id AND lower(email) = v_email AND status = 'pending'
   LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.team_invitations
       SET role = _role,
           message = COALESCE(_message, message),
           expires_at = now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1)),
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING * INTO v_invite;
  ELSE
    INSERT INTO public.team_invitations (
      tenant_id, email, role, invited_by, message, expires_at
    ) VALUES (
      _tenant_id, v_email, _role, auth.uid(), _message,
      now() + make_interval(days => GREATEST(COALESCE(_expires_in_days, 14), 1))
    )
    RETURNING * INTO v_invite;
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id, auth.uid(),
    'admin.team.invitation_created',
    'team_invitation', v_invite.id,
    jsonb_build_object('email', v_email, 'role', _role, 'reused', v_existing.id IS NOT NULL)
  );

  RETURN v_invite;
END;
$$;

-- ---------------------------------------------------------------------
-- 2) Listar convites pendentes de um tenant (para o painel)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_team_invitations(_tenant_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  tenant_name text,
  email text,
  role app_role,
  status text,
  token text,
  invited_by uuid,
  inviter_name text,
  message text,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.tenant_id,
    t.name,
    i.email,
    i.role,
    i.status::text,
    i.token,
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
$$;

-- ---------------------------------------------------------------------
-- 3) Listar memberships (planos recorrentes) por tenant
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_client_memberships(_tenant_id uuid)
RETURNS TABLE(
  subscription_id uuid,
  tenant_id uuid,
  client_id uuid,
  client_name text,
  client_email text,
  membership_id uuid,
  membership_name text,
  billing_cycle membership_billing_cycle,
  price_cents integer,
  status client_subscription_status,
  started_at timestamptz,
  current_cycle_start timestamptz,
  current_cycle_end timestamptz,
  canceled_at timestamptz,
  notes text,
  total_sessions_total integer,
  total_sessions_used integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.tenant_id,
    s.client_id,
    c.full_name,
    c.email,
    m.id,
    m.name,
    m.billing_cycle,
    m.price_cents,
    s.status,
    s.started_at,
    s.current_cycle_start,
    s.current_cycle_end,
    s.canceled_at,
    s.notes,
    COALESCE((SELECT SUM(b.sessions_total)::int FROM public.client_membership_balances b WHERE b.subscription_id = s.id), 0),
    COALESCE((SELECT SUM(b.sessions_used)::int  FROM public.client_membership_balances b WHERE b.subscription_id = s.id), 0)
  FROM public.client_membership_subscriptions s
  JOIN public.clients c     ON c.id = s.client_id
  JOIN public.memberships m ON m.id = s.membership_id
  WHERE public.is_super_admin(auth.uid())
    AND s.tenant_id = _tenant_id
  ORDER BY s.status, c.full_name;
$$;

-- ---------------------------------------------------------------------
-- 4) Conceder membership a cliente (com ciclo + saldos por benefÃ­cio)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grant_client_membership(
  _tenant_id uuid,
  _client_id uuid,
  _membership_id uuid,
  _notes text DEFAULT NULL
)
RETURNS public.client_membership_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.memberships;
  v_client public.clients;
  v_sub public.client_membership_subscriptions;
  v_cycle_end timestamptz;
  v_benefit RECORD;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode conceder memberships' USING errcode = '42501';
  END IF;

  SELECT * INTO v_membership FROM public.memberships WHERE id = _membership_id AND tenant_id = _tenant_id;
  IF v_membership.id IS NULL THEN
    RAISE EXCEPTION 'Plano de membership nÃ£o encontrado neste tenant' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = _client_id AND tenant_id = _tenant_id;
  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Cliente nÃ£o encontrado neste tenant' USING errcode = 'P0002';
  END IF;

  v_cycle_end := CASE v_membership.billing_cycle
    WHEN 'monthly'   THEN now() + interval '1 month'
    WHEN 'quarterly' THEN now() + interval '3 months'
    WHEN 'biannual'  THEN now() + interval '6 months'
    WHEN 'yearly'    THEN now() + interval '1 year'
    ELSE now() + interval '1 month'
  END;

  INSERT INTO public.client_membership_subscriptions (
    tenant_id, client_id, membership_id, status,
    started_at, current_cycle_start, current_cycle_end, notes
  ) VALUES (
    _tenant_id, _client_id, _membership_id, 'active',
    now(), now(), v_cycle_end, _notes
  )
  RETURNING * INTO v_sub;

  -- Cria saldo por benefÃ­cio
  FOR v_benefit IN
    SELECT b.service_id, b.sessions_per_cycle
    FROM public.membership_benefits b
    WHERE b.membership_id = _membership_id AND b.tenant_id = _tenant_id
  LOOP
    INSERT INTO public.client_membership_balances (
      tenant_id, subscription_id, service_id,
      sessions_total, sessions_used, cycle_start, cycle_end
    ) VALUES (
      _tenant_id, v_sub.id, v_benefit.service_id,
      v_benefit.sessions_per_cycle, 0, now(), v_cycle_end
    );
  END LOOP;

  -- Timeline + audit
  INSERT INTO public.client_timeline_events (
    tenant_id, client_id, actor_id, event_type, title, description, reference_id, metadata
  ) VALUES (
    _tenant_id, _client_id, auth.uid(),
    'membership_started'::timeline_event_type,
    'Membership concedida via super admin',
    v_membership.name, v_sub.id,
    jsonb_build_object('membership_id', _membership_id, 'price_cents', v_membership.price_cents)
  );

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id, auth.uid(), 'admin.client_membership.granted',
    'client_membership_subscription', v_sub.id,
    jsonb_build_object('client_id', _client_id, 'membership_id', _membership_id, 'membership_name', v_membership.name)
  );

  RETURN v_sub;
END;
$$;

-- ---------------------------------------------------------------------
-- 5) Cancelar membership do cliente (mantÃ©m histÃ³rico)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_cancel_client_membership(
  _subscription_id uuid,
  _reason text DEFAULT NULL
)
RETURNS public.client_membership_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.client_membership_subscriptions;
  v_new public.client_membership_subscriptions;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode cancelar memberships' USING errcode = '42501';
  END IF;

  SELECT * INTO v_old FROM public.client_membership_subscriptions WHERE id = _subscription_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Assinatura nÃ£o encontrada' USING errcode = 'P0002';
  END IF;

  UPDATE public.client_membership_subscriptions
     SET status = 'canceled'::client_subscription_status,
         canceled_at = now(),
         notes = COALESCE(_reason, notes),
         updated_at = now()
   WHERE id = _subscription_id
   RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_new.tenant_id, auth.uid(), 'admin.client_membership.canceled',
    'client_membership_subscription', v_new.id,
    jsonb_build_object('client_id', v_new.client_id, 'reason', _reason)
  );

  RETURN v_new;
END;
$$;

-- ---------------------------------------------------------------------
-- 6) Reativar membership cancelada
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_reactivate_client_membership(
  _subscription_id uuid
)
RETURNS public.client_membership_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new public.client_membership_subscriptions;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode reativar memberships' USING errcode = '42501';
  END IF;

  UPDATE public.client_membership_subscriptions
     SET status = 'active'::client_subscription_status,
         canceled_at = NULL,
         updated_at = now()
   WHERE id = _subscription_id
   RETURNING * INTO v_new;

  IF v_new.id IS NULL THEN
    RAISE EXCEPTION 'Assinatura nÃ£o encontrada' USING errcode = 'P0002';
  END IF;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_new.tenant_id, auth.uid(), 'admin.client_membership.reactivated',
    'client_membership_subscription', v_new.id,
    jsonb_build_object('client_id', v_new.client_id)
  );

  RETURN v_new;
END;
$$;

-- ---------------------------------------------------------------------
-- 7) Snapshot leve para popular o painel (clientes + memberships do tenant)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_get_tenant_membership_dashboard(_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clients jsonb;
  v_memberships jsonb;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin' USING errcode = '42501';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'full_name', full_name, 'email', email)
                            ORDER BY full_name), '[]'::jsonb)
    INTO v_clients
    FROM public.clients
   WHERE tenant_id = _tenant_id AND status = 'active'::client_status;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', id, 'name', name, 'billing_cycle', billing_cycle,
            'price_cents', price_cents, 'is_active', is_active
          ) ORDER BY name), '[]'::jsonb)
    INTO v_memberships
    FROM public.memberships
   WHERE tenant_id = _tenant_id;

  RETURN jsonb_build_object('clients', v_clients, 'memberships', v_memberships);
END;
$$;

--- 20260422190340_9cac0dfa-b481-4f32-94a3-1c578540e45f.sql ---
CREATE OR REPLACE FUNCTION public.admin_grant_client_membership(
  _tenant_id uuid,
  _client_id uuid,
  _membership_id uuid,
  _notes text DEFAULT NULL
)
RETURNS public.client_membership_subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership public.memberships;
  v_client public.clients;
  v_sub public.client_membership_subscriptions;
  v_cycle_end timestamptz;
  v_benefit RECORD;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode conceder memberships' USING errcode = '42501';
  END IF;

  SELECT * INTO v_membership FROM public.memberships WHERE id = _membership_id AND tenant_id = _tenant_id;
  IF v_membership.id IS NULL THEN
    RAISE EXCEPTION 'Plano de membership nÃ£o encontrado neste tenant' USING errcode = 'P0002';
  END IF;

  SELECT * INTO v_client FROM public.clients WHERE id = _client_id AND tenant_id = _tenant_id;
  IF v_client.id IS NULL THEN
    RAISE EXCEPTION 'Cliente nÃ£o encontrado neste tenant' USING errcode = 'P0002';
  END IF;

  v_cycle_end := CASE v_membership.billing_cycle
    WHEN 'monthly'   THEN now() + interval '1 month'
    WHEN 'quarterly' THEN now() + interval '3 months'
    WHEN 'yearly'    THEN now() + interval '1 year'
    ELSE now() + interval '1 month'
  END;

  INSERT INTO public.client_membership_subscriptions (
    tenant_id, client_id, membership_id, status,
    started_at, current_cycle_start, current_cycle_end, notes
  ) VALUES (
    _tenant_id, _client_id, _membership_id, 'active',
    now(), now(), v_cycle_end, _notes
  )
  RETURNING * INTO v_sub;

  FOR v_benefit IN
    SELECT b.service_id, b.sessions_per_cycle
    FROM public.membership_benefits b
    WHERE b.membership_id = _membership_id AND b.tenant_id = _tenant_id
  LOOP
    INSERT INTO public.client_membership_balances (
      tenant_id, subscription_id, service_id,
      sessions_total, sessions_used, cycle_start, cycle_end
    ) VALUES (
      _tenant_id, v_sub.id, v_benefit.service_id,
      v_benefit.sessions_per_cycle, 0, now(), v_cycle_end
    );
  END LOOP;

  INSERT INTO public.client_timeline_events (
    tenant_id, client_id, actor_id, event_type, title, description, reference_id, metadata
  ) VALUES (
    _tenant_id, _client_id, auth.uid(),
    'system'::timeline_event_type,
    'Membership concedida via super admin',
    v_membership.name, v_sub.id,
    jsonb_build_object('membership_id', _membership_id, 'price_cents', v_membership.price_cents)
  );

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    _tenant_id, auth.uid(), 'admin.client_membership.granted',
    'client_membership_subscription', v_sub.id,
    jsonb_build_object('client_id', _client_id, 'membership_id', _membership_id, 'membership_name', v_membership.name)
  );

  RETURN v_sub;
END;
$$;

--- 20260422190721_a30dd0a6-bf94-4305-b556-58d37932dd52.sql ---
-- Drop antes para permitir mudanÃ§a no shape de retorno
DROP FUNCTION IF EXISTS public.admin_list_tenant_memberships();
DROP FUNCTION IF EXISTS public.admin_update_membership_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.admin_update_membership_status(uuid, text);
DROP FUNCTION IF EXISTS public.admin_set_super_admin(uuid, boolean);

-- ---------- Helpers ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_active_owners(_tenant_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.tenant_memberships
  WHERE tenant_id = _tenant_id
    AND role = 'owner'::app_role
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.count_active_super_admins()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.profiles WHERE is_super_admin = true;
$$;

-- ---------- RPC: listar memberships -----------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_tenant_memberships()
RETURNS TABLE (
  membership_id uuid,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  user_id uuid,
  role app_role,
  status text,
  user_full_name text,
  user_email text,
  user_is_super_admin boolean,
  invited_email text,
  invited_at timestamptz,
  accepted_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    tm.id, tm.tenant_id, t.name, t.slug,
    tm.user_id, tm.role, tm.status::text,
    p.full_name, p.email,
    COALESCE(p.is_super_admin, false),
    tm.invited_email, tm.invited_at, tm.accepted_at, tm.updated_at
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  ORDER BY t.name ASC, tm.updated_at DESC;
END;
$$;

-- ---------- RPC: alterar papel ----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_membership_role(
  p_membership_id uuid,
  p_new_role app_role
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_m public.tenant_memberships%ROWTYPE;
  v_owners int;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  IF p_new_role IS NULL THEN
    RAISE EXCEPTION 'Novo papel obrigatÃ³rio';
  END IF;
  IF p_new_role = 'super_admin' THEN
    RAISE EXCEPTION 'Use admin_set_super_admin para conceder super admin';
  END IF;
  IF p_new_role = 'client' THEN
    RAISE EXCEPTION 'Papel "client" nÃ£o pode ser atribuÃ­do a um membership da equipe';
  END IF;

  SELECT * INTO v_m FROM public.tenant_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership nÃ£o encontrado'; END IF;

  -- Anti auto-rebaixamento de owner
  IF v_m.user_id = v_actor AND v_m.role = 'owner' AND p_new_role <> 'owner' THEN
    RAISE EXCEPTION 'VocÃª nÃ£o pode rebaixar seu prÃ³prio papel de owner neste tenant';
  END IF;

  -- NÃ£o deixar tenant sem owner ativo
  IF v_m.role = 'owner' AND v_m.status = 'active' AND p_new_role <> 'owner' THEN
    SELECT public.count_active_owners(v_m.tenant_id) INTO v_owners;
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'NÃ£o Ã© possÃ­vel alterar â€” este Ã© o Ãºltimo owner ativo do tenant';
    END IF;
  END IF;

  IF v_m.role = p_new_role THEN RETURN; END IF;

  UPDATE public.tenant_memberships
  SET role = p_new_role, updated_at = now()
  WHERE id = p_membership_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, entity, entity_id, action, metadata)
  VALUES (
    v_m.tenant_id, v_actor, 'tenant_membership', p_membership_id, 'role_changed',
    jsonb_build_object(
      'from_role', v_m.role, 'to_role', p_new_role,
      'user_id', v_m.user_id, 'changed_by_super_admin', true
    )
  );
END;
$$;

-- ---------- RPC: alterar status ---------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_membership_status(
  p_membership_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_m public.tenant_memberships%ROWTYPE;
  v_owners int;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  IF p_new_status NOT IN ('active','invited','suspended') THEN
    RAISE EXCEPTION 'Status invÃ¡lido: %', p_new_status;
  END IF;

  SELECT * INTO v_m FROM public.tenant_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership nÃ£o encontrado'; END IF;

  -- Anti auto-suspensÃ£o
  IF v_m.user_id = v_actor AND v_m.status = 'active' AND p_new_status <> 'active' THEN
    RAISE EXCEPTION 'VocÃª nÃ£o pode suspender ou desativar seu prÃ³prio acesso a este tenant';
  END IF;

  -- NÃ£o suspender o Ãºltimo owner ativo
  IF v_m.role = 'owner' AND v_m.status = 'active' AND p_new_status <> 'active' THEN
    SELECT public.count_active_owners(v_m.tenant_id) INTO v_owners;
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'NÃ£o Ã© possÃ­vel suspender â€” este Ã© o Ãºltimo owner ativo do tenant';
    END IF;
  END IF;

  IF v_m.status::text = p_new_status THEN RETURN; END IF;

  UPDATE public.tenant_memberships
  SET status = p_new_status::membership_status,
      accepted_at = CASE
        WHEN p_new_status = 'active' AND accepted_at IS NULL THEN now()
        ELSE accepted_at
      END,
      updated_at = now()
  WHERE id = p_membership_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, entity, entity_id, action, metadata)
  VALUES (
    v_m.tenant_id, v_actor, 'tenant_membership', p_membership_id, 'status_changed',
    jsonb_build_object(
      'from_status', v_m.status, 'to_status', p_new_status,
      'user_id', v_m.user_id, 'changed_by_super_admin', true
    )
  );
END;
$$;

-- ---------- RPC: super admin -----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_super_admin(
  p_user_id uuid,
  p_is_super boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_current boolean;
  v_total int;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id obrigatÃ³rio'; END IF;

  IF p_user_id = v_actor AND p_is_super = false THEN
    RAISE EXCEPTION 'VocÃª nÃ£o pode remover seu prÃ³prio acesso de super admin';
  END IF;

  SELECT COALESCE(is_super_admin, false) INTO v_current
  FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'UsuÃ¡rio sem profile â€” peÃ§a que ele faÃ§a login uma vez antes';
  END IF;

  IF v_current = true AND p_is_super = false THEN
    SELECT public.count_active_super_admins() INTO v_total;
    IF v_total <= 1 THEN
      RAISE EXCEPTION 'NÃ£o Ã© possÃ­vel remover â€” este Ã© o Ãºltimo super admin do sistema';
    END IF;
  END IF;

  IF v_current = p_is_super THEN RETURN; END IF;

  UPDATE public.profiles
  SET is_super_admin = p_is_super, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, entity, entity_id, action, metadata)
  VALUES (
    NULL, v_actor, 'profile', p_user_id,
    CASE WHEN p_is_super THEN 'super_admin_granted' ELSE 'super_admin_revoked' END,
    jsonb_build_object('user_id', p_user_id, 'is_super_admin', p_is_super)
  );
END;
$$;

-- ---------- PermissÃµes ------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_list_tenant_memberships()              FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_update_membership_role(uuid, app_role) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_update_membership_status(uuid, text)   FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_set_super_admin(uuid, boolean)         FROM public, anon;
REVOKE ALL ON FUNCTION public.count_active_owners(uuid)                    FROM public, anon;
REVOKE ALL ON FUNCTION public.count_active_super_admins()                  FROM public, anon;

GRANT EXECUTE ON FUNCTION public.admin_list_tenant_memberships()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_membership_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_membership_status(uuid, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_super_admin(uuid, boolean)         TO authenticated;

--- 20260422191035_70aed957-d99d-498d-91ad-ca213df72bd5.sql ---

-- ============================================================================
-- Feature Flags & Limits Management RPCs (Super Admin)
-- ============================================================================

-- 1) Upsert / criar feature flag (global se _tenant_id IS NULL)
CREATE OR REPLACE FUNCTION public.admin_upsert_feature_flag(
  _flag_key text,
  _label text,
  _value jsonb,
  _value_type feature_flag_value_type DEFAULT 'boolean',
  _description text DEFAULT NULL,
  _tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_existing public.feature_flags%ROWTYPE;
  v_id uuid;
  v_is_global boolean := (_tenant_id IS NULL);
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode gerenciar feature flags';
  END IF;

  IF _flag_key IS NULL OR length(trim(_flag_key)) = 0 THEN
    RAISE EXCEPTION 'flag_key Ã© obrigatÃ³rio';
  END IF;

  SELECT * INTO v_existing
  FROM public.feature_flags
  WHERE flag_key = _flag_key
    AND (
      (_tenant_id IS NULL AND tenant_id IS NULL)
      OR (tenant_id = _tenant_id)
    )
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    UPDATE public.feature_flags
       SET label = _label,
           value = _value,
           value_type = _value_type,
           description = COALESCE(_description, description),
           updated_at = now()
     WHERE id = v_existing.id
     RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, v_caller, 'feature_flag.updated', 'feature_flag', v_id,
            jsonb_build_object(
              'flag_key', _flag_key,
              'is_global', v_is_global,
              'before', to_jsonb(v_existing),
              'after', jsonb_build_object('label', _label, 'value', _value, 'value_type', _value_type)
            ));
  ELSE
    INSERT INTO public.feature_flags (tenant_id, flag_key, label, description, value, value_type, is_global)
    VALUES (_tenant_id, _flag_key, _label, _description, _value, _value_type, v_is_global)
    RETURNING id INTO v_id;

    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, v_caller, 'feature_flag.created', 'feature_flag', v_id,
            jsonb_build_object(
              'flag_key', _flag_key,
              'is_global', v_is_global,
              'value', _value,
              'value_type', _value_type
            ));
  END IF;

  RETURN v_id;
END;
$$;

-- 2) Alternar boolean de uma flag
CREATE OR REPLACE FUNCTION public.admin_toggle_feature_flag(
  _flag_id uuid,
  _enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_flag public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode alternar feature flags';
  END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE id = _flag_id;
  IF v_flag.id IS NULL THEN
    RAISE EXCEPTION 'Flag nÃ£o encontrada';
  END IF;

  UPDATE public.feature_flags
     SET value = to_jsonb(_enabled),
         value_type = 'boolean',
         updated_at = now()
   WHERE id = _flag_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_flag.tenant_id, v_caller, 'feature_flag.toggled', 'feature_flag', _flag_id,
          jsonb_build_object(
            'flag_key', v_flag.flag_key,
            'is_global', v_flag.is_global,
            'before', v_flag.value,
            'after', to_jsonb(_enabled)
          ));
END;
$$;

-- 3) Remover feature flag
CREATE OR REPLACE FUNCTION public.admin_delete_feature_flag(_flag_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_flag public.feature_flags%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode remover feature flags';
  END IF;

  SELECT * INTO v_flag FROM public.feature_flags WHERE id = _flag_id;
  IF v_flag.id IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.feature_flags WHERE id = _flag_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_flag.tenant_id, v_caller, 'feature_flag.deleted', 'feature_flag', _flag_id,
          jsonb_build_object(
            'flag_key', v_flag.flag_key,
            'is_global', v_flag.is_global,
            'value', v_flag.value
          ));
END;
$$;

-- 4) Atualizar limites de um plano
CREATE OR REPLACE FUNCTION public.admin_update_plan_limits(
  _plan_id uuid,
  _max_units integer DEFAULT NULL,
  _max_professionals integer DEFAULT NULL,
  _max_active_clients integer DEFAULT NULL,
  _max_storage_mb integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_before public.plans%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode alterar limites de planos';
  END IF;

  SELECT * INTO v_before FROM public.plans WHERE id = _plan_id;
  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'Plano nÃ£o encontrado';
  END IF;

  UPDATE public.plans
     SET max_units = _max_units,
         max_professionals = _max_professionals,
         max_active_clients = _max_active_clients,
         max_storage_mb = _max_storage_mb,
         updated_at = now()
   WHERE id = _plan_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (NULL, v_caller, 'plan.limits_updated', 'plan', _plan_id,
          jsonb_build_object(
            'plan_code', v_before.code,
            'before', jsonb_build_object(
              'max_units', v_before.max_units,
              'max_professionals', v_before.max_professionals,
              'max_active_clients', v_before.max_active_clients,
              'max_storage_mb', v_before.max_storage_mb
            ),
            'after', jsonb_build_object(
              'max_units', _max_units,
              'max_professionals', _max_professionals,
              'max_active_clients', _max_active_clients,
              'max_storage_mb', _max_storage_mb
            )
          ));
END;
$$;

-- 5) Atualizar override de limites por tenant (assinatura)
CREATE OR REPLACE FUNCTION public.admin_update_subscription_overrides(
  _subscription_id uuid,
  _override_limits jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_before public.tenant_subscriptions%ROWTYPE;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode alterar overrides de assinatura';
  END IF;

  SELECT * INTO v_before FROM public.tenant_subscriptions WHERE id = _subscription_id;
  IF v_before.id IS NULL THEN
    RAISE EXCEPTION 'Assinatura nÃ£o encontrada';
  END IF;

  UPDATE public.tenant_subscriptions
     SET override_limits = COALESCE(_override_limits, '{}'::jsonb),
         updated_at = now()
   WHERE id = _subscription_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (v_before.tenant_id, v_caller, 'subscription.overrides_updated', 'tenant_subscription', _subscription_id,
          jsonb_build_object(
            'before', v_before.override_limits,
            'after', _override_limits
          ));
END;
$$;

-- 6) Calcular impacto de alteraÃ§Ã£o (quantos tenants/usuÃ¡rios afetados)
CREATE OR REPLACE FUNCTION public.admin_feature_flag_impact(_flag_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_global_count integer;
  v_tenant_count integer;
  v_affected_tenants integer;
  v_affected_users integer;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode consultar impacto';
  END IF;

  SELECT COUNT(*) INTO v_global_count
  FROM public.feature_flags
  WHERE flag_key = _flag_key AND tenant_id IS NULL;

  SELECT COUNT(*) INTO v_tenant_count
  FROM public.feature_flags
  WHERE flag_key = _flag_key AND tenant_id IS NOT NULL;

  -- Tenants ativos (tÃªm assinatura)
  SELECT COUNT(DISTINCT t.id) INTO v_affected_tenants
  FROM public.tenants t
  WHERE EXISTS (SELECT 1 FROM public.tenant_subscriptions ts WHERE ts.tenant_id = t.id);

  -- UsuÃ¡rios ativos nesses tenants
  SELECT COUNT(DISTINCT tm.user_id) INTO v_affected_users
  FROM public.tenant_memberships tm
  WHERE tm.status = 'active';

  RETURN jsonb_build_object(
    'flag_key', _flag_key,
    'has_global_flag', v_global_count > 0,
    'tenant_overrides_count', v_tenant_count,
    'estimated_affected_tenants', v_affected_tenants,
    'estimated_affected_users', v_affected_users
  );
END;
$$;

-- 7) Calcular impacto de mudanÃ§a de limite de plano
CREATE OR REPLACE FUNCTION public.admin_plan_limit_impact(_plan_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_subscriptions integer;
  v_active_subs integer;
  v_tenants_with_override integer;
BEGIN
  IF NOT public.is_super_admin(v_caller) THEN
    RAISE EXCEPTION 'Apenas super_admin pode consultar impacto';
  END IF;

  SELECT COUNT(*) INTO v_subscriptions
  FROM public.tenant_subscriptions WHERE plan_id = _plan_id;

  SELECT COUNT(*) INTO v_active_subs
  FROM public.tenant_subscriptions
  WHERE plan_id = _plan_id AND status IN ('active','trialing');

  SELECT COUNT(*) INTO v_tenants_with_override
  FROM public.tenant_subscriptions
  WHERE plan_id = _plan_id AND override_limits <> '{}'::jsonb;

  RETURN jsonb_build_object(
    'plan_id', _plan_id,
    'total_subscriptions', v_subscriptions,
    'active_or_trial', v_active_subs,
    'tenants_with_override', v_tenants_with_override
  );
END;
$$;

--- 20260422192928_824e7eab-5b03-44a4-91c6-d268d9946a45.sql ---
-- =========================================================================
-- FASE 1 â€” CORREÃ‡Ã•ES DE SEGURANÃ‡A CRÃTICAS
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) PROFILES: bloquear auto-promoÃ§Ã£o a super_admin
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_block_self_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF COALESCE(NEW.is_super_admin, false) IS NOT DISTINCT FROM COALESCE(OLD.is_super_admin, false) THEN
    RETURN NEW;
  END IF;
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_super_admin(v_actor) THEN
    RETURN NEW;
  END IF;
  NEW.is_super_admin := OLD.is_super_admin;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_super_admin ON public.profiles;
CREATE TRIGGER profiles_block_self_super_admin
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_block_self_super_admin();

-- -------------------------------------------------------------------------
-- 2) CLIENT_USERS: remover self-insert sem validaÃ§Ã£o
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_users: usuÃ¡rio cria seu prÃ³prio vÃ­nculo" ON public.client_users;

-- -------------------------------------------------------------------------
-- 3) PROFESSIONALS: restringir leitura de commission_pct
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "professionals: membros leem" ON public.professionals;
DROP POLICY IF EXISTS "professionals: dono lÃª do tenant" ON public.professionals;

CREATE POLICY "professionals: owner manager leem tudo"
ON public.professionals
FOR SELECT
TO authenticated
USING (
  has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
  OR is_super_admin(auth.uid())
);

CREATE POLICY "professionals: vÃª o prÃ³prio registro"
ON public.professionals
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RPC para qualquer membro do tenant listar profissionais SEM commission_pct.
CREATE OR REPLACE FUNCTION public.list_team_professionals(_tenant_id uuid)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  unit_id uuid,
  user_id uuid,
  display_name text,
  role_title text,
  specialty text,
  color text,
  bio text,
  email text,
  phone text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.tenant_id, p.unit_id, p.user_id,
    p.display_name, p.role_title, p.specialty,
    p.color, p.bio, p.email, p.phone,
    p.is_active, p.created_at, p.updated_at
  FROM public.professionals p
  WHERE p.tenant_id = _tenant_id
    AND (
      public.is_tenant_member(auth.uid(), _tenant_id)
      OR public.is_super_admin(auth.uid())
    )
  ORDER BY p.display_name;
$$;

-- RPC para o prÃ³prio profissional consultar a SUA comissÃ£o.
CREATE OR REPLACE FUNCTION public.get_my_commission(_professional_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT commission_pct
  FROM public.professionals
  WHERE id = _professional_id
    AND user_id = auth.uid();
$$;

-- -------------------------------------------------------------------------
-- 4) AUDIT_LOGS: remover do Realtime
-- -------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs;

-- -------------------------------------------------------------------------
-- 5) SEGMENT_TEMPLATES: exigir membership ativa em algum tenant
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "segment_templates: autenticado lÃª ativos" ON public.segment_templates;

CREATE POLICY "segment_templates: equipe lÃª ativos"
ON public.segment_templates
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  )
);

-- -------------------------------------------------------------------------
-- 6) FEATURE_FLAGS: globais visÃ­veis sÃ³ a quem tem membership ativa
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "feature_flags: tenant lÃª prÃ³prio + globais" ON public.feature_flags;

CREATE POLICY "feature_flags: equipe lÃª prÃ³prio + globais"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id IS NOT NULL AND is_tenant_member(auth.uid(), tenant_id)
  )
  OR (
    is_global = true
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  )
);

-- -------------------------------------------------------------------------
-- 7) STORAGE: garantir leitura pÃºblica APENAS do bucket de logos
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='tenant-logos: leitura pÃºblica'
  ) THEN
    CREATE POLICY "tenant-logos: leitura pÃºblica"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'tenant-logos');
  END IF;
END $$;

--- 20260422193012_4ab9e72d-4523-47be-a35e-d3fba2c8d9cf.sql ---
-- Reabrir SELECT para membros do tenant e usar GRANT por coluna para
-- proteger commission_pct. Postgres suporta GRANT SELECT (col1, col2, ...).

-- Reativar leitura por membros
CREATE POLICY "professionals: membros leem"
ON public.professionals
FOR SELECT
TO authenticated
USING (
  is_tenant_member(auth.uid(), tenant_id)
  OR is_super_admin(auth.uid())
);

-- Reativar leitura para clientes ativos do portal (igual ao comportamento antigo)
CREATE POLICY "professionals: portal client lÃª ativos do tenant"
ON public.professionals
FOR SELECT
TO authenticated
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.tenant_id = professionals.tenant_id
      AND cu.status = 'active'
  )
);

-- Bloquear leitura da coluna commission_pct para o role 'authenticated'
-- (e portanto para qualquer cliente/serviÃ§o que use anon key + JWT do usuÃ¡rio).
-- Em seguida concedemos novamente SELECT em todas as outras colunas.
REVOKE SELECT ON public.professionals FROM authenticated;
GRANT SELECT (
  id, tenant_id, unit_id, user_id,
  display_name, role_title, bio, color, specialty,
  email, phone, is_active, created_at, updated_at
) ON public.professionals TO authenticated;

-- A RPC get_my_commission(...) usa SECURITY DEFINER e ignora o GRANT,
-- entÃ£o o prÃ³prio profissional continua conseguindo ler a sua comissÃ£o.
-- A RPC admin_*/security definer e os roles owner/manager continuam podendo
-- atualizar o valor via UPDATE/INSERT (a coluna nÃ£o foi removida do GRANT
-- de write â€” apenas SELECT foi restrito). Confirmamos:
GRANT INSERT, UPDATE, DELETE ON public.professionals TO authenticated;

--- 20260422224034_47e93108-33cd-48eb-9718-aa6e0e3eaf7e.sql ---
-- =============================================================
-- 1. PROTEGER commission_pct (owner/manager/prÃ³prio profissional)
-- =============================================================

-- Remove a policy genÃ©rica que expÃµe commission_pct a todos os membros
DROP POLICY IF EXISTS "professionals: membros leem" ON public.professionals;

-- Substitui por uma policy "membros leem dados pÃºblicos" via security definer
-- Para isso usamos uma view "professionals_public" que esconde commission_pct
CREATE OR REPLACE VIEW public.professionals_public
WITH (security_invoker = true) AS
SELECT
  id, tenant_id, unit_id, user_id,
  display_name, role_title, specialty,
  color, bio, email, phone,
  is_active, created_at, updated_at,
  -- commission_pct intencionalmente omitido
  NULL::numeric AS commission_pct_hidden
FROM public.professionals;

GRANT SELECT ON public.professionals_public TO authenticated, anon;

-- Recria policy de leitura para membros, MAS sem expor commission_pct.
-- Como Postgres RLS Ã© por linha, nÃ£o por coluna, criamos uma policy
-- restritiva por coluna usando uma policy de SELECT que cobre membros
-- e uma policy adicional baseada em funÃ§Ã£o SECURITY DEFINER para permitir
-- a leitura ampla â€” o frontend jÃ¡ trata o caso onde a coluna Ã© NULL.
--
-- EstratÃ©gia: revoga SELECT da coluna commission_pct para `authenticated`
-- e concede apenas via funÃ§Ã£o RPC security definer que valida o role.
CREATE POLICY "professionals: membros leem (sem commission)"
  ON public.professionals
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
  );

-- Revoga acesso direto Ã  coluna sensÃ­vel e concede apenas a roles privilegiados
REVOKE SELECT (commission_pct) ON public.professionals FROM authenticated, anon, public;

-- FunÃ§Ã£o para owner/manager lerem comissÃµes do tenant
CREATE OR REPLACE FUNCTION public.list_professionals_with_commission(_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  commission_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.commission_pct
  FROM public.professionals p
  WHERE p.tenant_id = _tenant_id
    AND (
      public.has_any_tenant_role(auth.uid(), _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
      OR public.is_super_admin(auth.uid())
      OR p.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.list_professionals_with_commission(uuid) TO authenticated;

-- =============================================================
-- 2. BLOQUEAR ESCALAÃ‡ÃƒO is_super_admin
-- =============================================================
-- O trigger profiles_block_self_super_admin jÃ¡ existe, mas sÃ³ roda em UPDATE.
-- Garantimos que tambÃ©m rode em INSERT, e que NÃƒO permita o usuÃ¡rio marcar
-- a si mesmo como super_admin no INSERT inicial via handle_new_user.

CREATE OR REPLACE FUNCTION public.profiles_block_super_admin_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  -- INSERT: novo perfil
  IF TG_OP = 'INSERT' THEN
    -- Se o ator nÃ£o Ã© super admin, forÃ§a is_super_admin = false
    IF v_actor IS NOT NULL AND NOT public.is_super_admin(v_actor) THEN
      NEW.is_super_admin := false;
    END IF;
    -- Caso especial: handle_new_user roda como SECURITY DEFINER (sem auth.uid())
    -- Mantemos false por padrÃ£o nesse caso tambÃ©m.
    IF v_actor IS NULL THEN
      NEW.is_super_admin := COALESCE(NEW.is_super_admin, false);
      -- Bloqueia handle_new_user de definir true (nÃ£o hÃ¡ caso legÃ­timo)
      IF NEW.is_super_admin = true THEN
        NEW.is_super_admin := false;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: campo mudou?
  IF COALESCE(NEW.is_super_admin, false) IS NOT DISTINCT FROM COALESCE(OLD.is_super_admin, false) THEN
    RETURN NEW;
  END IF;

  -- Apenas super admin pode alterar
  IF v_actor IS NULL OR NOT public.is_super_admin(v_actor) THEN
    NEW.is_super_admin := OLD.is_super_admin;
    RETURN NEW;
  END IF;

  -- Auditoria da mudanÃ§a
  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
      NULL, v_actor,
      CASE WHEN NEW.is_super_admin THEN 'profile.super_admin_granted' ELSE 'profile.super_admin_revoked' END,
      'profile', NEW.id,
      jsonb_build_object('from', OLD.is_super_admin, 'to', NEW.is_super_admin)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_super_admin_trg ON public.profiles;
DROP TRIGGER IF EXISTS profiles_block_super_admin_changes_trg ON public.profiles;

CREATE TRIGGER profiles_block_super_admin_changes_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_super_admin_changes();

-- =============================================================
-- 3. HASHEAR team_invitations.token
-- =============================================================

-- Adiciona coluna token_hash
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS token_hash text;

-- Backfill: popula token_hash a partir do token atual e marca pendentes como expirados
UPDATE public.team_invitations
   SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL;

-- Invalida convites pendentes anteriores (sem hash original confiÃ¡vel)
UPDATE public.team_invitations
   SET status = 'expired',
       updated_at = now()
 WHERE status = 'pending';

-- Index para lookup por hash
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_token_hash_idx
  ON public.team_invitations (token_hash);

-- Trigger BEFORE INSERT/UPDATE: garante token_hash sempre populado
CREATE OR REPLACE FUNCTION public.team_invitations_hash_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Se token foi setado/alterado, recalcula hash
  IF TG_OP = 'INSERT' OR NEW.token IS DISTINCT FROM OLD.token THEN
    IF NEW.token IS NOT NULL THEN
      NEW.token_hash := encode(extensions.digest(NEW.token, 'sha256'), 'hex');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_invitations_hash_token_trg ON public.team_invitations;
CREATE TRIGGER team_invitations_hash_token_trg
  BEFORE INSERT OR UPDATE OF token ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.team_invitations_hash_token();

-- Garante NOT NULL apÃ³s backfill
ALTER TABLE public.team_invitations
  ALTER COLUMN token_hash SET NOT NULL;

-- Atualiza accept_team_invitation para aceitar token PLAIN e comparar via hash
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS public.tenant_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.team_invitations;
  v_existing public.tenant_memberships;
  v_inserted public.tenant_memberships;
  v_pro_count int;
  v_max_pros int;
  v_hash text;
begin
  if v_user is null then
    raise exception 'UsuÃ¡rio nÃ£o autenticado.' using errcode = '42501';
  end if;
  if v_email = '' then
    raise exception 'E-mail do usuÃ¡rio nÃ£o disponÃ­vel na sessÃ£o.' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  select * into v_invite
    from public.team_invitations
   where token_hash = v_hash
   limit 1;

  if not found then
    raise exception 'Convite nÃ£o encontrado.' using errcode = 'P0002';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'Este convite jÃ¡ foi aceito.' using errcode = '22023';
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
         token = NULL,  -- limpa o plaintext apÃ³s aceite
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
$$;

-- RPC para o convidado verificar/visualizar um convite por token (hash internamente)
CREATE OR REPLACE FUNCTION public.lookup_team_invitation(_token text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  email text,
  role app_role,
  status team_invitation_status,
  expires_at timestamptz,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
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
$$;
GRANT EXECUTE ON FUNCTION public.lookup_team_invitation(text) TO authenticated;

-- Revoga acesso direto Ã  coluna token (plaintext) â€” agora apenas o criador
-- vÃª na resposta do INSERT via RETURNING (RLS de gestor ainda permite).
-- Para reforÃ§ar: criamos RPC que cria o convite e devolve token plaintext apenas uma vez.
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
    RAISE EXCEPTION 'NÃ£o autenticado' USING errcode = '42501';
  END IF;
  IF NOT (
    public.has_any_tenant_role(v_user, _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissÃ£o para convidar nesta loja' USING errcode = '42501';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel invÃ¡lido para convite' USING errcode = '22023';
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

  -- Limpa o plaintext apÃ³s retornar (mantÃ©m apenas o hash)
  UPDATE public.team_invitations
     SET token = NULL
   WHERE id = v_invite.id;

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

-- =============================================================
-- 4. RESTRINGIR audit_logs INSERT
-- =============================================================
-- Apenas funÃ§Ãµes SECURITY DEFINER (que rodam como postgres/owner) podem inserir.
-- Para isso: revoga INSERT direto de authenticated.

DROP POLICY IF EXISTS "audit_logs: membros podem registrar" ON public.audit_logs;

-- MantÃ©m SELECT existente (owner/manager/super_admin)
-- Cria policy de INSERT bloqueada para clientes diretos
CREATE POLICY "audit_logs: bloqueado para clientes"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Functions SECURITY DEFINER continuam funcionando (rodam como owner do schema)

-- =============================================================
-- 5. STORAGE: tenant-logos (mantÃ©m pÃºblico para landing/portal,
--    mas refina policies de UPLOAD/UPDATE para garantir folder=tenantId)
-- =============================================================

-- A policy de UPLOAD atualmente nÃ£o tem WITH CHECK. Corrigimos.
DROP POLICY IF EXISTS "tenant-logos: managers upload" ON storage.objects;

CREATE POLICY "tenant-logos: managers upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.has_any_tenant_role(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        ARRAY['owner'::app_role, 'manager'::app_role]
      )
      OR public.is_super_admin(auth.uid())
    )
  );

-- Remove duplicata de SELECT pÃºblica (deixamos apenas uma)
DROP POLICY IF EXISTS "tenant-logos: leitura pÃºblica" ON storage.objects;
-- "tenant-logos: public read" mantÃ©m leitura pÃºblica (necessÃ¡ria para landing)

-- =============================================================
-- 6. STORAGE HARD-LIMIT (max_storage_mb)
-- =============================================================

-- FunÃ§Ã£o: calcula bytes usados pelo tenant em todos os buckets
CREATE OR REPLACE FUNCTION public.tenant_storage_bytes_used(_tenant_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(SUM(
    COALESCE((metadata->>'size')::bigint, 0)
  ), 0)::bigint
  FROM storage.objects
  WHERE bucket_id IN ('tenant-logos','client-media')
    AND (storage.foldername(name))[1] = _tenant_id::text;
$$;
GRANT EXECUTE ON FUNCTION public.tenant_storage_bytes_used(uuid) TO authenticated;

-- Trigger BEFORE INSERT em storage.objects: bloqueia se exceder limite
CREATE OR REPLACE FUNCTION public.enforce_tenant_storage_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_tenant_id uuid;
  v_max_mb int;
  v_used_bytes bigint;
  v_new_bytes bigint;
  v_limit_bytes bigint;
BEGIN
  -- SÃ³ atua nos buckets de tenant
  IF NEW.bucket_id NOT IN ('tenant-logos','client-media') THEN
    RETURN NEW;
  END IF;

  -- Extrai tenant_id da primeira pasta
  BEGIN
    v_tenant_id := ((storage.foldername(NEW.name))[1])::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- Path malformado: bloqueia
    RAISE EXCEPTION 'Caminho invÃ¡lido para upload (esperado tenantId/...).' USING ERRCODE = '22023';
  END;

  -- Resolve limite efetivo
  SELECT (public.effective_subscription_limits(v_tenant_id) ->> 'max_storage_mb')::int
    INTO v_max_mb;

  -- Sem limite definido = sem enforcement
  IF v_max_mb IS NULL OR v_max_mb <= 0 THEN
    RETURN NEW;
  END IF;

  v_limit_bytes := v_max_mb::bigint * 1024 * 1024;
  v_new_bytes := COALESCE((NEW.metadata->>'size')::bigint, 0);
  SELECT public.tenant_storage_bytes_used(v_tenant_id) INTO v_used_bytes;

  IF (v_used_bytes + v_new_bytes) > v_limit_bytes THEN
    RAISE EXCEPTION 'Limite de armazenamento do plano atingido (% MB). FaÃ§a upgrade para continuar enviando arquivos.', v_max_mb
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tenant_storage_limit_trg ON storage.objects;
CREATE TRIGGER enforce_tenant_storage_limit_trg
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_storage_limit();

--- 20260422224223_75222a05-37e1-47eb-bdae-a1b4b4d34fc6.sql ---
DROP FUNCTION IF EXISTS public.admin_provision_team_invitation(uuid, text, app_role, text, integer);

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
    RAISE EXCEPTION 'Apenas super admin pode provisionar usuÃ¡rios' USING errcode = '42501';
  END IF;
  IF v_email IS NULL OR v_email !~ '^.+@.+\..+$' THEN
    RAISE EXCEPTION 'E-mail invÃ¡lido' USING errcode = '22023';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel invÃ¡lido para convite de equipe' USING errcode = '22023';
  END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant nÃ£o encontrado' USING errcode = 'P0002';
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
           token = v_token,
           updated_at = now()
     WHERE id = v_existing.id
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

  UPDATE public.team_invitations SET token = NULL WHERE id = v_invite.id;

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

UPDATE public.team_invitations SET token = NULL WHERE token IS NOT NULL;

--- 20260422232202_66abac34-c062-4cea-a209-da79c208e0f0.sql ---
CREATE OR REPLACE FUNCTION public.admin_list_tenant_memberships()
 RETURNS TABLE(membership_id uuid, tenant_id uuid, tenant_name text, tenant_slug text, user_id uuid, role app_role, status text, user_full_name text, user_email text, user_is_super_admin boolean, invited_email text, invited_at timestamp with time zone, accepted_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    tm.id, tm.tenant_id, t.name, t.slug,
    tm.user_id, tm.role, tm.status::text,
    p.full_name,
    u.email::text AS user_email,
    COALESCE(p.is_super_admin, false),
    tm.invited_email, tm.invited_at, tm.accepted_at, tm.updated_at
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  LEFT JOIN auth.users u ON u.id = tm.user_id
  ORDER BY t.name ASC, tm.updated_at DESC;
END;
$function$;

--- 20260424090000_fix_team_invitation_ambiguous_id.sql ---
-- Corrige ambiguidade entre a coluna team_invitations.id e o parÃ¢metro de
-- saÃ­da id em funÃ§Ãµes RETURNS TABLE.

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
    RAISE EXCEPTION 'NÃ£o autenticado' USING errcode = '42501';
  END IF;
  IF NOT (
    public.has_any_tenant_role(v_user, _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissÃ£o para convidar nesta loja' USING errcode = '42501';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel invÃ¡lido para convite' USING errcode = '22023';
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
    RAISE EXCEPTION 'Apenas super admin pode provisionar usuÃ¡rios' USING errcode = '42501';
  END IF;
  IF v_email IS NULL OR v_email !~ '^.+@.+\..+$' THEN
    RAISE EXCEPTION 'E-mail invÃ¡lido' USING errcode = '22023';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel invÃ¡lido para convite de equipe' USING errcode = '22023';
  END IF;
  SELECT * INTO v_tenant FROM public.tenants WHERE public.tenants.id = _tenant_id;
  IF v_tenant.id IS NULL THEN
    RAISE EXCEPTION 'Tenant nÃ£o encontrado' USING errcode = 'P0002';
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

