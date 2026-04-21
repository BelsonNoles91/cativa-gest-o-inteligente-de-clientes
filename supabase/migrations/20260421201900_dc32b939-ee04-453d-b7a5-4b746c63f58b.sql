-- =============================================================================
-- Cativa — Etapa 5 — Agenda (resources, disponibilidade, bloqueios,
-- appointments, items, status, logs, waitlist) + função de slots
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
-- APPOINTMENT ITEMS (1..N serviços por agendamento)
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
-- TRIGGERS DE HISTÓRICO DE STATUS
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
-- FUNÇÃO DE DISPONIBILIDADE (slots livres)
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
  -- carrega serviço (duração + buffers + processamento)
  select * into svc from public.services where id = _service_id and tenant_id = _tenant_id;
  if not found then
    return;
  end if;
  total_minutes := svc.duration_minutes
                 + coalesce(svc.buffer_before_minutes, 0)
                 + coalesce(svc.buffer_after_minutes, 0)
                 + coalesce(svc.processing_minutes, 0);

  weekday_int := extract(dow from _day)::smallint;

  -- horário da unidade
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