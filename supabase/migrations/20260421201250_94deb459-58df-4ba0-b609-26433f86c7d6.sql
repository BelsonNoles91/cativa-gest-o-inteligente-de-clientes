-- =============================================================================
-- Cativa — Etapa 4 — Catálogo (categorias, serviços, preços, pacotes,
-- assinaturas, protocolos, saldos, políticas de cancelamento)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type public.package_kind as enum ('package', 'combo');
create type public.membership_billing_cycle as enum ('monthly', 'quarterly', 'yearly');
create type public.client_subscription_status as enum ('active', 'paused', 'canceled', 'expired');
create type public.client_package_status as enum ('active', 'completed', 'expired', 'canceled');

-- =============================================================================
-- CANCELLATION POLICIES (reutilizáveis)
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
  -- duração e buffers (minutos)
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
  -- conteúdo
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
-- SERVICE PRICES (lista base por moeda — preparado para múltiplas tabelas)
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
-- SERVICE UNIT PRICES (preço por unidade)
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
-- SERVICE PROFESSIONAL PRICES (preço por profissional)
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
  recommended_interval_days   integer,                -- janela entre sessões
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
-- PROTOCOLS (séries de tratamento)
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
--   SELECT  → membros do tenant
--   ALL     → owner/manager (configuração do catálogo)
--   Saldos de cliente → SELECT membros, ALL owner/manager/frontdesk
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
