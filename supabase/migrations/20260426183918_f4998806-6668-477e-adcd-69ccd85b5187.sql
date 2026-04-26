-- Adicionar coluna de limite de agendamentos mensais
alter table public.plans 
add column if not exists max_appointments_month integer;

-- Atualizar helper de limites para incluir o novo campo
create or replace function public.effective_subscription_limits(_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with sub as (
    select s.*, p.max_units, p.max_professionals, p.max_active_clients, p.max_storage_mb, p.max_appointments_month,
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
    'max_storage_mb', coalesce((override_limits->>'max_storage_mb')::int, max_storage_mb),
    'max_appointments_month', coalesce((override_limits->>'max_appointments_month')::int, max_appointments_month)
  )
  from sub;
$$;

-- Arquivar planos antigos
update public.plans set status = 'archived' where code in ('starter', 'pro');

-- Inserir/Atualizar novos planos
insert into public.plans (code, name, description, billing_period, price_cents, trial_days, grace_period_days,
  max_units, max_professionals, max_active_clients, max_storage_mb, max_appointments_month, status, is_default, display_order)
values
  ('free', 'Apoio', 'Ideal para quem está começando agora.', 'monthly', 0, 0, 0, 1, 1, 50, 100, 25, 'public', true, 1),
  ('entrepreneur', 'Empreendedor', 'Para o profissional que quer crescer com controle.', 'monthly', 2990, 7, 7, 1, 2, 500, 500, 300, 'public', false, 2)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  price_cents = excluded.price_cents,
  max_professionals = excluded.max_professionals,
  max_appointments_month = excluded.max_appointments_month,
  status = 'public',
  display_order = excluded.display_order;

-- Atualizar plano Studio com os novos valores
update public.plans set
  name = 'Studio',
  description = 'Gestão completa sem limites de escala.',
  price_cents = 7990,
  max_professionals = null,
  max_appointments_month = null,
  max_units = null,
  display_order = 3,
  is_default = false
where code = 'studio';

-- Configurar features para os novos planos
insert into public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
select p.id, f.feature_key, f.label, f.value_type::public.feature_flag_value_type, f.value::jsonb, f.display_order
from public.plans p,
lateral (values
  ('agenda', 'Agenda completa', 'boolean', 'true', 1),
  ('confirmation_center', 'Central de Confirmação', 'boolean', case when p.code in ('entrepreneur', 'studio') then 'true' else 'false' end, 2),
  ('client_portal', 'Agendamento Online', 'boolean', case when p.code in ('entrepreneur', 'studio') then 'true' else 'false' end, 3),
  ('analytics', 'Relatórios & Métricas', 'boolean', case when p.code = 'studio' then 'true' else 'false' end, 4),
  ('custom_branding', 'Logo da Profissional', 'boolean', case when p.code in ('entrepreneur', 'studio') then 'true' else 'false' end, 5)
) as f(feature_key, label, value_type, value, display_order)
where p.code in ('free', 'entrepreneur', 'studio')
on conflict (plan_id, feature_key) do update set
  value = excluded.value,
  label = excluded.label;
