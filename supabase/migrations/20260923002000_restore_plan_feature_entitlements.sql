-- Restaura direitos removidos quando o catálogo público foi recriado em
-- 20260501005839. As rotas usam estas chaves para liberar módulos; manter
-- também plans.features evita divergência entre o frontend e as RPCs legadas.

with desired(plan_code, feature_key, label, enabled, display_order) as (
  values
    ('free',         'confirmation_center', 'Central de Confirmação', false, 20),
    ('entrepreneur', 'confirmation_center', 'Central de Confirmação', true,  20),
    ('studio',       'confirmation_center', 'Central de Confirmação', true,  20),
    ('free',         'packages_memberships', 'Pacotes & Memberships', true,  21),
    ('entrepreneur', 'packages_memberships', 'Pacotes & Memberships', true,  21),
    ('studio',       'packages_memberships', 'Pacotes & Memberships', true,  21),
    ('free',         'client_portal',         'Portal do cliente',     false, 22),
    ('entrepreneur', 'client_portal',         'Portal do cliente',     true,  22),
    ('studio',       'client_portal',         'Portal do cliente',     true,  22),
    ('free',         'analytics',             'Relatórios & Métricas', false, 23),
    ('entrepreneur', 'analytics',             'Relatórios & Métricas', false, 23),
    ('studio',       'analytics',             'Relatórios & Métricas', true,  23),
    ('free',         'custom_branding',       'Branding customizado',  false, 24),
    ('entrepreneur', 'custom_branding',       'Branding customizado',  true,  24),
    ('studio',       'custom_branding',       'Branding customizado',  true,  24)
), resolved as (
  select p.id as plan_id, d.feature_key, d.label, d.enabled, d.display_order
  from desired d
  join public.plans p on p.code = d.plan_code
)
insert into public.plan_features (
  plan_id,
  feature_key,
  label,
  value_type,
  value,
  display_order
)
select
  plan_id,
  feature_key,
  label,
  'boolean'::public.feature_flag_value_type,
  to_jsonb(enabled),
  display_order
from resolved
on conflict (plan_id, feature_key) do update set
  label = excluded.label,
  value_type = excluded.value_type,
  value = excluded.value,
  display_order = excluded.display_order;

update public.plans p
set features = coalesce(p.features, '{}'::jsonb) || entitlements.features,
    updated_at = now()
from (
  select
    p2.id as plan_id,
    jsonb_object_agg(d.feature_key, to_jsonb(d.enabled)) as features
  from public.plans p2
  join (
    values
      ('free',         'confirmation_center', false),
      ('entrepreneur', 'confirmation_center', true),
      ('studio',       'confirmation_center', true),
      ('free',         'packages_memberships', true),
      ('entrepreneur', 'packages_memberships', true),
      ('studio',       'packages_memberships', true),
      ('free',         'client_portal', false),
      ('entrepreneur', 'client_portal', true),
      ('studio',       'client_portal', true),
      ('free',         'analytics', false),
      ('entrepreneur', 'analytics', false),
      ('studio',       'analytics', true),
      ('free',         'custom_branding', false),
      ('entrepreneur', 'custom_branding', true),
      ('studio',       'custom_branding', true)
  ) as d(plan_code, feature_key, enabled) on d.plan_code = p2.code
  group by p2.id
) entitlements
where p.id = entitlements.plan_id;
