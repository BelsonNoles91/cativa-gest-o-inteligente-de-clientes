-- =============================================================================
-- Cativa — Etapa 7 — Portal do Cliente
-- Vincula auth.users a clients e abre acesso self-service controlado por RLS
-- =============================================================================

-- ENUMS -----------------------------------------------------------------------
create type public.client_user_status as enum ('active', 'pending', 'blocked');

-- TABELA: client_users --------------------------------------------------------
create table public.client_users (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  user_id     uuid not null,
  status      public.client_user_status not null default 'active',
  linked_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, user_id),
  unique (client_id, user_id)
);
create index client_users_user_idx   on public.client_users(user_id, status);
create index client_users_client_idx on public.client_users(client_id);
create index client_users_tenant_idx on public.client_users(tenant_id);
create trigger client_users_set_updated_at
  before update on public.client_users
  for each row execute function public.set_updated_at();

-- TABELA: client_reviews ------------------------------------------------------
create table public.client_reviews (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  appointment_id  uuid not null references public.appointments(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete set null,
  rating          smallint not null check (rating between 1 and 5),
  would_recommend boolean,
  comment         text,
  is_public       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (appointment_id)
);
create index client_reviews_tenant_idx       on public.client_reviews(tenant_id, created_at desc);
create index client_reviews_client_idx       on public.client_reviews(client_id);
create index client_reviews_professional_idx on public.client_reviews(professional_id);
create trigger client_reviews_set_updated_at
  before update on public.client_reviews
  for each row execute function public.set_updated_at();

-- FUNÇÕES AUXILIARES ----------------------------------------------------------
create or replace function public.is_portal_client_of(_user_id uuid, _client_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.client_users
    where user_id = _user_id
      and client_id = _client_id
      and status = 'active'
  );
$$;

create or replace function public.client_user_tenant(_user_id uuid, _tenant_id uuid)
returns uuid
language sql stable security definer
set search_path = public
as $$
  select client_id from public.client_users
  where user_id = _user_id and tenant_id = _tenant_id and status = 'active'
  limit 1;
$$;

create or replace function public.client_owns_appointment(_user_id uuid, _appointment_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.appointments a
    join public.client_users cu on cu.client_id = a.client_id and cu.tenant_id = a.tenant_id
    where a.id = _appointment_id
      and cu.user_id = _user_id
      and cu.status = 'active'
  );
$$;

-- RLS -------------------------------------------------------------------------
alter table public.client_users   enable row level security;
alter table public.client_reviews enable row level security;

-- client_users
create policy "client_users: dono lê seu vínculo"
on public.client_users for select to authenticated
using (user_id = auth.uid() or public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_users: equipe gerencia"
on public.client_users for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[]) or public.is_super_admin(auth.uid()));

create policy "client_users: usuário cria seu próprio vínculo"
on public.client_users for insert to authenticated
with check (user_id = auth.uid());

create policy "client_users: dono atualiza last_seen"
on public.client_users for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- client_reviews
create policy "client_reviews: equipe lê"
on public.client_reviews for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_reviews: dono lê suas reviews"
on public.client_reviews for select to authenticated
using (public.is_portal_client_of(auth.uid(), client_id));

create policy "client_reviews: dono cria review do próprio agendamento"
on public.client_reviews for insert to authenticated
with check (
  public.is_portal_client_of(auth.uid(), client_id)
  and public.client_owns_appointment(auth.uid(), appointment_id)
);

create policy "client_reviews: dono edita sua review"
on public.client_reviews for update to authenticated
using (public.is_portal_client_of(auth.uid(), client_id))
with check (public.is_portal_client_of(auth.uid(), client_id));

create policy "client_reviews: gestor remove"
on public.client_reviews for delete to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- =============================================================================
-- AMPLIAR RLS DAS TABELAS EXISTENTES PARA O CLIENTE LOGADO
-- =============================================================================

-- clients: cliente lê/atualiza o próprio cadastro
create policy "clients: dono lê próprio cadastro"
on public.clients for select to authenticated
using (public.is_portal_client_of(auth.uid(), id));

create policy "clients: dono atualiza próprio cadastro"
on public.clients for update to authenticated
using (public.is_portal_client_of(auth.uid(), id))
with check (public.is_portal_client_of(auth.uid(), id));

-- appointments: cliente lê / cria / cancela / reagenda os próprios
create policy "appointments: dono lê próprios"
on public.appointments for select to authenticated
using (public.is_portal_client_of(auth.uid(), client_id));

create policy "appointments: dono cria para si"
on public.appointments for insert to authenticated
with check (
  public.is_portal_client_of(auth.uid(), client_id)
  and source = 'client_portal'
);

create policy "appointments: dono atualiza próprios"
on public.appointments for update to authenticated
using (public.is_portal_client_of(auth.uid(), client_id))
with check (public.is_portal_client_of(auth.uid(), client_id));

-- appointment_items: leitura pelo dono do agendamento
create policy "appointment_items: dono lê"
on public.appointment_items for select to authenticated
using (public.client_owns_appointment(auth.uid(), appointment_id));

-- appointment_status_history: leitura pelo dono
create policy "appt_status_history: dono lê"
on public.appointment_status_history for select to authenticated
using (public.client_owns_appointment(auth.uid(), appointment_id));

-- client_package_balances: dono lê seus saldos
create policy "client_package_balances: dono lê"
on public.client_package_balances for select to authenticated
using (public.is_portal_client_of(auth.uid(), client_id));

-- client_membership_subscriptions: dono lê
create policy "client_membership_subs: dono lê"
on public.client_membership_subscriptions for select to authenticated
using (public.is_portal_client_of(auth.uid(), client_id));

-- client_membership_balances: dono lê via subscription
create policy "client_membership_balances: dono lê"
on public.client_membership_balances for select to authenticated
using (
  exists (
    select 1 from public.client_membership_subscriptions s
    where s.id = client_membership_balances.subscription_id
      and public.is_portal_client_of(auth.uid(), s.client_id)
  )
);

-- channel_preferences: dono lê e atualiza
create policy "channel_preferences: dono lê"
on public.channel_preferences for select to authenticated
using (public.is_portal_client_of(auth.uid(), client_id));

create policy "channel_preferences: dono atualiza"
on public.channel_preferences for update to authenticated
using (public.is_portal_client_of(auth.uid(), client_id))
with check (public.is_portal_client_of(auth.uid(), client_id));

create policy "channel_preferences: dono cria"
on public.channel_preferences for insert to authenticated
with check (public.is_portal_client_of(auth.uid(), client_id));

-- consent_form_responses: dono lê e responde
create policy "consent_responses: dono lê"
on public.consent_form_responses for select to authenticated
using (public.is_portal_client_of(auth.uid(), client_id));

create policy "consent_responses: dono atualiza própria resposta"
on public.consent_form_responses for update to authenticated
using (public.is_portal_client_of(auth.uid(), client_id))
with check (public.is_portal_client_of(auth.uid(), client_id));

-- consent_form_templates: dono lê os ativos do tenant
create policy "consent_templates: dono lê ativos"
on public.consent_form_templates for select to authenticated
using (
  is_active = true
  and exists (
    select 1 from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.tenant_id = consent_form_templates.tenant_id
      and cu.status = 'active'
  )
);

-- units: dono lê unidades do tenant que pertence
create policy "units: dono lê do tenant"
on public.units for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.tenant_id = units.tenant_id
      and cu.status = 'active'
  )
);

-- services: dono lê serviços ativos do tenant
create policy "services: dono lê do tenant"
on public.services for select to authenticated
using (
  is_active = true
  and exists (
    select 1 from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.tenant_id = services.tenant_id
      and cu.status = 'active'
  )
);

-- professionals: dono lê profissionais ativos do tenant
create policy "professionals: dono lê do tenant"
on public.professionals for select to authenticated
using (
  is_active = true
  and exists (
    select 1 from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.tenant_id = professionals.tenant_id
      and cu.status = 'active'
  )
);

-- cancellation_policies: dono lê
create policy "cancellation_policies: dono lê"
on public.cancellation_policies for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.tenant_id = cancellation_policies.tenant_id
      and cu.status = 'active'
  )
);

-- tenants: dono lê o próprio tenant (para branding)
create policy "tenants: dono lê seu tenant"
on public.tenants for select to authenticated
using (
  exists (
    select 1 from public.client_users cu
    where cu.user_id = auth.uid()
      and cu.tenant_id = tenants.id
      and cu.status = 'active'
  )
);
