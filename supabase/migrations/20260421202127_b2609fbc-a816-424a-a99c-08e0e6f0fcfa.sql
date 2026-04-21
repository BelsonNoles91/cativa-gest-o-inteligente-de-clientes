-- =============================================================================
-- Cativa — Etapa 6 — Central de Confirmação
-- Templates, regras, fila, tentativas, ligações e preferência de canal
-- REGRA INEGOCIÁVEL: nenhuma comunicação é enviada automaticamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type public.message_channel as enum (
  'whatsapp',
  'phone',
  'email',
  'sms',
  'in_person'
);

create type public.message_template_stage as enum (
  'confirmation',     -- confirmação de horário próximo
  'reminder',         -- lembrete simples
  'reschedule',       -- proposta/pedido de reagendamento
  'cancellation',     -- aviso de cancelamento
  'recovery',         -- recuperação de cancelado/no-show
  'reactivation',     -- reativação de inativo
  'thanks',           -- agradecimento pós-atendimento
  'custom'
);

create type public.confirmation_stage as enum (
  'today',
  'tomorrow',
  'upcoming',
  'high_risk',
  'premium',
  'reschedule',
  'recovery'
);

create type public.confirmation_queue_status as enum (
  'pending',
  'in_progress',
  'confirmed',
  'reschedule_requested',
  'canceled',
  'no_response',
  'follow_up_scheduled',
  'closed'
);

create type public.contact_attempt_result as enum (
  'pending',
  'sent',
  'confirmed',
  'reschedule_requested',
  'canceled',
  'no_response',
  'call_made',
  'follow_up_scheduled'
);

create type public.call_outcome as enum (
  'answered',
  'no_answer',
  'voicemail',
  'wrong_number',
  'busy',
  'callback_requested'
);

-- =============================================================================
-- MESSAGE TEMPLATES
-- =============================================================================
create table public.message_templates (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  unit_id         uuid references public.units(id) on delete cascade,
  service_id      uuid references public.services(id) on delete set null,
  stage           public.message_template_stage not null,
  channel         public.message_channel not null default 'whatsapp',
  name            text not null,
  body            text not null,
  variables       jsonb not null default '[]'::jsonb,
  is_default      boolean not null default false,
  is_active       boolean not null default true,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index message_templates_tenant_idx on public.message_templates(tenant_id, stage, is_active);
create index message_templates_unit_idx   on public.message_templates(unit_id);
create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

-- =============================================================================
-- CONFIRMATION RULES
-- =============================================================================
create table public.confirmation_rules (
  id                          uuid primary key default gen_random_uuid(),
  tenant_id                   uuid not null references public.tenants(id) on delete cascade,
  unit_id                     uuid references public.units(id) on delete cascade,
  name                        text not null,
  stage                       public.confirmation_stage not null,
  hours_before_appointment    integer not null default 24,
  base_priority               smallint not null default 50,
  skip_if_already_confirmed   boolean not null default true,
  applies_to_vip              boolean not null default true,
  applies_to_high_risk        boolean not null default true,
  applies_to_protocol         boolean not null default true,
  min_appointment_value_cents integer,
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index confirmation_rules_tenant_idx on public.confirmation_rules(tenant_id, stage, is_active);
create trigger confirmation_rules_set_updated_at
  before update on public.confirmation_rules
  for each row execute function public.set_updated_at();

-- =============================================================================
-- CONFIRMATION QUEUE
-- =============================================================================
create table public.confirmation_queue (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null references public.tenants(id) on delete cascade,
  appointment_id      uuid not null references public.appointments(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  rule_id             uuid references public.confirmation_rules(id) on delete set null,
  stage               public.confirmation_stage not null,
  status              public.confirmation_queue_status not null default 'pending',
  priority            smallint not null default 50,
  scheduled_for       timestamptz not null default now(),
  appointment_starts_at timestamptz not null,
  assigned_to         uuid,
  last_attempt_at     timestamptz,
  attempts_count      integer not null default 0,
  follow_up_at        timestamptz,
  closed_at           timestamptz,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (appointment_id, stage)
);
create index confirmation_queue_tenant_status_idx on public.confirmation_queue(tenant_id, status, priority desc, appointment_starts_at);
create index confirmation_queue_stage_idx         on public.confirmation_queue(tenant_id, stage, status);
create index confirmation_queue_client_idx        on public.confirmation_queue(client_id);
create index confirmation_queue_appointment_idx   on public.confirmation_queue(appointment_id);
create trigger confirmation_queue_set_updated_at
  before update on public.confirmation_queue
  for each row execute function public.set_updated_at();

-- =============================================================================
-- CONTACT ATTEMPTS (histórico de tentativas manuais)
-- =============================================================================
create table public.contact_attempts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  queue_id        uuid references public.confirmation_queue(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  template_id     uuid references public.message_templates(id) on delete set null,
  channel         public.message_channel not null,
  result          public.contact_attempt_result not null default 'pending',
  message_preview text,
  notes           text,
  attempted_by    uuid,
  attempted_at    timestamptz not null default now(),
  follow_up_at    timestamptz,
  created_at      timestamptz not null default now()
);
create index contact_attempts_queue_idx       on public.contact_attempts(queue_id, attempted_at desc);
create index contact_attempts_client_idx      on public.contact_attempts(client_id, attempted_at desc);
create index contact_attempts_tenant_idx      on public.contact_attempts(tenant_id, attempted_at desc);
create index contact_attempts_appointment_idx on public.contact_attempts(appointment_id);

-- =============================================================================
-- CALL LOGS (registros específicos de ligação)
-- =============================================================================
create table public.call_logs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  appointment_id  uuid references public.appointments(id) on delete set null,
  queue_id        uuid references public.confirmation_queue(id) on delete set null,
  outcome         public.call_outcome not null,
  duration_seconds integer,
  notes           text,
  called_by       uuid,
  called_at       timestamptz not null default now(),
  created_at      timestamptz not null default now()
);
create index call_logs_client_idx     on public.call_logs(client_id, called_at desc);
create index call_logs_tenant_idx     on public.call_logs(tenant_id, called_at desc);
create index call_logs_appointment_idx on public.call_logs(appointment_id);

-- =============================================================================
-- CHANNEL PREFERENCES (por cliente)
-- =============================================================================
create table public.channel_preferences (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  client_id                uuid not null references public.clients(id) on delete cascade,
  preferred_channel        public.message_channel not null default 'whatsapp',
  fallback_channel         public.message_channel,
  preferred_window_start   time,
  preferred_window_end     time,
  do_not_disturb           boolean not null default false,
  notes                    text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (client_id)
);
create index channel_preferences_tenant_idx on public.channel_preferences(tenant_id);
create trigger channel_preferences_set_updated_at
  before update on public.channel_preferences
  for each row execute function public.set_updated_at();

-- =============================================================================
-- FUNÇÃO DE PRIORIZAÇÃO
-- =============================================================================
create or replace function public.calculate_queue_priority(
  _tenant_id          uuid,
  _client_id          uuid,
  _appointment_id     uuid,
  _stage              public.confirmation_stage,
  _base_priority      smallint default 50
)
returns smallint
language plpgsql
stable security definer
set search_path = public
as $$
declare
  cli            clients%rowtype;
  appt           appointments%rowtype;
  no_show_count  integer;
  in_protocol    boolean;
  result         integer;
begin
  result := coalesce(_base_priority, 50);

  select * into cli  from public.clients      where id = _client_id      and tenant_id = _tenant_id;
  select * into appt from public.appointments where id = _appointment_id and tenant_id = _tenant_id;

  if not found then
    return result::smallint;
  end if;

  -- VIP: +20
  if coalesce(cli.is_vip, false) then
    result := result + 20;
  end if;

  -- Risco do cliente
  if cli.risk_level = 'high' then
    result := result + 25;
  elsif cli.risk_level = 'medium' then
    result := result + 10;
  end if;

  -- Histórico de no-show (últimos 90 dias)
  select count(*) into no_show_count
  from public.appointments
  where tenant_id = _tenant_id
    and client_id = _client_id
    and status = 'no_show'
    and starts_at > now() - interval '90 days';
  if no_show_count >= 3 then
    result := result + 25;
  elsif no_show_count >= 1 then
    result := result + 10;
  end if;

  -- Cliente em protocolo ativo
  select exists (
    select 1 from public.client_package_balances b
    where b.tenant_id = _tenant_id
      and b.client_id = _client_id
      and b.status = 'active'
      and b.sessions_used < b.sessions_total
  ) into in_protocol;
  if in_protocol then
    result := result + 10;
  end if;

  -- Valor do agendamento
  if appt.total_price_cents >= 50000 then       -- >= R$ 500
    result := result + 15;
  elsif appt.total_price_cents >= 20000 then    -- >= R$ 200
    result := result + 5;
  end if;

  -- Proximidade do horário (quanto mais próximo, mais urgente)
  if appt.starts_at <= now() + interval '6 hours' then
    result := result + 30;
  elsif appt.starts_at <= now() + interval '24 hours' then
    result := result + 15;
  elsif appt.starts_at <= now() + interval '48 hours' then
    result := result + 5;
  end if;

  -- Estágio reforça prioridade
  if _stage = 'today' then
    result := result + 10;
  elsif _stage = 'high_risk' then
    result := result + 15;
  elsif _stage = 'premium' then
    result := result + 10;
  end if;

  if result > 100 then result := 100; end if;
  if result < 0   then result := 0;   end if;

  return result::smallint;
end;
$$;

-- =============================================================================
-- ENABLE RLS
-- =============================================================================
alter table public.message_templates    enable row level security;
alter table public.confirmation_rules   enable row level security;
alter table public.confirmation_queue   enable row level security;
alter table public.contact_attempts     enable row level security;
alter table public.call_logs            enable row level security;
alter table public.channel_preferences  enable row level security;

-- ---------- message_templates ----------
create policy "message_templates: membros leem"
on public.message_templates for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "message_templates: gestor configura"
on public.message_templates for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- confirmation_rules ----------
create policy "confirmation_rules: membros leem"
on public.confirmation_rules for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "confirmation_rules: gestor configura"
on public.confirmation_rules for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- confirmation_queue ----------
create policy "confirmation_queue: membros leem"
on public.confirmation_queue for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "confirmation_queue: equipe gerencia"
on public.confirmation_queue for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- contact_attempts ----------
create policy "contact_attempts: membros leem"
on public.contact_attempts for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "contact_attempts: equipe registra"
on public.contact_attempts for insert to authenticated
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

create policy "contact_attempts: equipe atualiza"
on public.contact_attempts for update to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

create policy "contact_attempts: gestor remove"
on public.contact_attempts for delete to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- call_logs ----------
create policy "call_logs: membros leem"
on public.call_logs for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "call_logs: equipe registra"
on public.call_logs for insert to authenticated
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

create policy "call_logs: equipe atualiza"
on public.call_logs for update to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));

create policy "call_logs: gestor remove"
on public.call_logs for delete to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[]) or public.is_super_admin(auth.uid()));

-- ---------- channel_preferences ----------
create policy "channel_preferences: membros leem"
on public.channel_preferences for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "channel_preferences: equipe gerencia"
on public.channel_preferences for all to authenticated
using (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()))
with check (public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[]) or public.is_super_admin(auth.uid()));