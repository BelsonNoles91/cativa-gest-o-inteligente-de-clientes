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

drop policy if exists "plans: público lê" on public.plans;
create policy "plans: público lê" on public.plans
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

drop policy if exists "plan_features: público lê" on public.plan_features;
create policy "plan_features: público lê" on public.plan_features
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

drop policy if exists "tenant_subs: owner/manager lê o próprio" on public.tenant_subscriptions;
create policy "tenant_subs: owner/manager lê o próprio" on public.tenant_subscriptions
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

drop policy if exists "sub_events: owner/manager lê" on public.subscription_events;
create policy "sub_events: owner/manager lê" on public.subscription_events
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

drop policy if exists "feature_flags: tenant lê próprio + globais" on public.feature_flags;
create policy "feature_flags: tenant lê próprio + globais" on public.feature_flags
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

drop policy if exists "usage: owner/manager lê próprio" on public.usage_snapshots;
create policy "usage: owner/manager lê próprio" on public.usage_snapshots
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

drop policy if exists "segment_templates: autenticado lê ativos" on public.segment_templates;
create policy "segment_templates: autenticado lê ativos" on public.segment_templates
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
-- SEED: planos default + features padrão
-- ============================================================================
insert into public.plans (code, name, description, billing_period, price_cents, trial_days, grace_period_days,
  max_units, max_professionals, max_active_clients, max_storage_mb, status, is_default, display_order)
values
  ('starter','Starter','Para começar pequeno','monthly', 9900, 14, 7, 1, 3, 500, 1024, 'public', false, 1),
  ('studio','Studio','Para o salão em crescimento','monthly', 19900, 14, 7, 2, 8, 2000, 5120, 'public', true, 2),
  ('pro','Pro','Operação multiunidade','monthly', 39900, 14, 7, 5, 25, 10000, 20480, 'public', false, 3),
  ('enterprise','Enterprise','Sob medida','custom', 0, 30, 14, null, null, null, null, 'public', false, 4)
on conflict (code) do nothing;

insert into public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
select p.id, f.feature_key, f.label, f.value_type::public.feature_flag_value_type, f.value::jsonb, f.display_order
from public.plans p,
lateral (values
  ('agenda', 'Agenda completa', 'boolean', 'true', 1),
  ('confirmation_center', 'Central de Confirmação', 'boolean', 'true', 2),
  ('client_portal', 'Portal do cliente', 'boolean', case when p.code in ('studio','pro','enterprise') then 'true' else 'false' end, 3),
  ('analytics', 'Analytics + Índice Cativa', 'boolean', case when p.code in ('studio','pro','enterprise') then 'true' else 'false' end, 4),
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
  (null, 'maintenance_mode', 'Modo manutenção', 'Bloqueia acesso temporariamente', 'boolean', 'false', true),
  (null, 'show_cativa_index', 'Exibir Índice Cativa', 'Mostra a métrica proprietária', 'boolean', 'true', true)
on conflict (tenant_id, flag_key) do nothing;

-- ============================================================================
-- SEED: segment templates básicos
-- ============================================================================
insert into public.segment_templates (segment, name, description, payload, is_default, display_order)
values
  ('salao','Salão completo','Categorias: cabelo, coloração, tratamentos. Serviços base.',
    '{"categories":["Cabelo","Coloração","Tratamentos","Manicure"],"services":[{"name":"Corte feminino","duration":60,"price_cents":8000},{"name":"Escova","duration":45,"price_cents":6000}]}'::jsonb,
    true, 1),
  ('barbearia','Barbearia clássica','Cortes, barba, combo.',
    '{"categories":["Cortes","Barba"],"services":[{"name":"Corte masculino","duration":30,"price_cents":5000},{"name":"Barba","duration":30,"price_cents":4000},{"name":"Combo","duration":60,"price_cents":8000}]}'::jsonb,
    true, 1),
  ('clinica_estetica','Clínica de estética','Protocolos e pacotes.',
    '{"categories":["Faciais","Corporais","Depilação"],"services":[{"name":"Limpeza de pele","duration":60,"price_cents":15000}]}'::jsonb,
    true, 1),
  ('lash_brow','Lash & Brow','Cílios e sobrancelhas.',
    '{"categories":["Cílios","Sobrancelhas"],"services":[{"name":"Volume russo","duration":120,"price_cents":18000},{"name":"Design de sobrancelhas","duration":30,"price_cents":5000}]}'::jsonb,
    true, 1),
  ('esmalteria','Esmalteria','Manicure, pedicure, alongamento.',
    '{"categories":["Mãos","Pés","Alongamento"],"services":[{"name":"Manicure","duration":45,"price_cents":4500}]}'::jsonb,
    true, 1),
  ('wellness','Massagem & Wellness','Relaxamento e terapias.',
    '{"categories":["Massagens","Terapias"],"services":[{"name":"Massagem relaxante","duration":60,"price_cents":15000}]}'::jsonb,
    true, 1)
on conflict do nothing;