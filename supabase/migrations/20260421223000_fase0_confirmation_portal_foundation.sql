-- =============================================================================
-- Cativa — Fase 0 — Fechamento estrutural para Central de Confirmação
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
-- CLIENT USERS (vínculo auth.user ↔ client)
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
-- POLICIES — NOVAS TABELAS
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
-- POLICIES — PORTAL DO CLIENTE EM TABELAS JÁ EXISTENTES
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
