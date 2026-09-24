-- Nova linha de planos: Começo (grátis 30 dias), Solo, Equipe (destaque) e Rede.
-- Os planos antigos continuam existindo para quem já usa, mas saem da vitrine.

-- 1) Esconde os planos antigos da landing e tira o padrão antigo
update public.plans
set metadata = coalesce(metadata, '{}'::jsonb) || '{"show_on_landing": false}'::jsonb,
    is_default = false,
    updated_at = now()
where code in ('free', 'starter', 'entrepreneur', 'pro', 'studio', 'enterprise');

-- 2) Começo — grátis por 30 dias (não vitalício)
insert into public.plans (
  code, name, description, billing_period, price_cents, currency,
  trial_days, grace_period_days, max_units, max_professionals,
  max_active_clients, max_storage_mb, max_appointments_month,
  status, is_default, display_order, features, metadata
) values (
  'comeco', 'Começo',
  'Para sair do papel e organizar a agenda hoje mesmo. Grátis por 30 dias: depois você escolhe um plano pago ou a conta fica só para consulta — nada é apagado.',
  'monthly', 0, 'BRL', 30, 0, 1, 1, 100, 256, 30,
  'public', true, 1,
  '{"online_scheduling": true, "client_portal": true, "confirmation_center": true, "packages_memberships": false, "analytics": false, "advanced_reports": false, "custom_logo": false, "multi_unit": false}'::jsonb,
  '{"show_on_landing": true, "highlight": false, "cta_label": "Começar grátis agora", "cta_sub": "Sem cartão de crédito · leva 2 minutos", "landing_bullets": ["1 profissional e 1 unidade", "Até 30 agendamentos por mês", "Agenda completa e fácil de usar", "Página de agendamento com link e QR code", "Portal do cliente: histórico, remarcação e cancelamento", "Confirmação de horário por WhatsApp", "Avisos e lembretes no celular"]}'::jsonb
);

-- 3) Solo — R$ 57,90/mês
insert into public.plans (
  code, name, description, billing_period, price_cents, currency,
  trial_days, grace_period_days, max_units, max_professionals,
  max_active_clients, max_storage_mb, max_appointments_month,
  status, is_default, display_order, features, metadata
) values (
  'solo', 'Solo',
  'Para o profissional autônomo que quer agenda cheia e zero bagunça: manicure, lash designer, barbeiro, tatuador.',
  'monthly', 5790, 'BRL', 14, 7, 1, 1, null, 1024, null,
  'public', false, 2,
  '{"online_scheduling": true, "client_portal": true, "confirmation_center": true, "packages_memberships": true, "analytics": false, "advanced_reports": false, "custom_logo": false, "multi_unit": false}'::jsonb,
  '{"show_on_landing": true, "highlight": false, "cta_label": "Assinar o Solo", "cta_sub": "14 dias grátis para testar tudo", "landing_bullets": ["Tudo do plano Começo", "Clientes e agendamentos ilimitados", "Espaço do Cliente com entrada por Google/Apple", "Lista de espera: preencha horários vagos na hora", "Pacotes e combos do seu atendimento", "Relatórios essenciais do seu negócio"]}'::jsonb
);

-- 4) Equipe — R$ 97,90/mês (destaque)
insert into public.plans (
  code, name, description, billing_period, price_cents, currency,
  trial_days, grace_period_days, max_units, max_professionals,
  max_active_clients, max_storage_mb, max_appointments_month,
  status, is_default, display_order, features, metadata
) values (
  'equipe', 'Equipe',
  'Para salões e clínicas que querem crescer: retenção, metas e inteligência trabalhando pelo seu negócio todos os dias.',
  'monthly', 9790, 'BRL', 14, 7, 1, 6, null, 5120, null,
  'public', false, 3,
  '{"online_scheduling": true, "client_portal": true, "confirmation_center": true, "packages_memberships": true, "analytics": true, "advanced_reports": true, "custom_logo": false, "multi_unit": false}'::jsonb,
  '{"show_on_landing": true, "highlight": true, "badge": "Mais escolhido", "cta_label": "Quero o plano Equipe", "cta_sub": "14 dias grátis · cancele quando quiser", "landing_bullets": ["Tudo do plano Solo", "Até 6 profissionais na mesma agenda", "Resumo inteligente com IA do seu dia", "Reativação automática de clientes com cupom", "Valor de cada cliente e previsão de faturamento", "Metas, ranking e comissões da equipe", "Portal do profissional com a agenda dele", "Índice Cativa: o termômetro da retenção"]}'::jsonb
);

-- 5) Rede — R$ 247,90/mês
insert into public.plans (
  code, name, description, billing_period, price_cents, currency,
  trial_days, grace_period_days, max_units, max_professionals,
  max_active_clients, max_storage_mb, max_appointments_month,
  status, is_default, display_order, features, metadata
) values (
  'rede', 'Rede',
  'Para quem tem filiais ou quer escalar: todas as unidades em uma visão consolidada, com a sua marca em tudo.',
  'monthly', 24790, 'BRL', 14, 14, null, null, null, null, null,
  'public', false, 4,
  '{"online_scheduling": true, "client_portal": true, "confirmation_center": true, "packages_memberships": true, "analytics": true, "advanced_reports": true, "custom_logo": true, "multi_unit": true}'::jsonb,
  '{"show_on_landing": true, "highlight": false, "cta_label": "Falar com a gente", "cta_sub": "Implantação acompanhada pela nossa equipe", "landing_bullets": ["Tudo do plano Equipe", "Profissionais ilimitados", "Várias unidades com visão consolidada", "Marca própria: suas cores e seu logo", "Importação assistida de clientes e agenda", "Atendimento prioritário"]}'::jsonb
);

-- 6) Espelha os limites/funções na tabela de exibição (usada em "Meu plano" e no admin)
insert into public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
select p.id, f.feature_key, f.label, f.value_type::feature_flag_value_type, f.value::jsonb, f.display_order
from public.plans p
cross join lateral (
  values
    ('units',         case when p.max_units is null then 'Unidades ilimitadas' else p.max_units::text || ' unidade' || case when p.max_units > 1 then 's' else '' end end, 'number', coalesce(p.max_units, 0)::text, 1),
    ('professionals', case when p.max_professionals is null then 'Profissionais ilimitados' when p.max_professionals = 1 then '1 profissional' else 'Até ' || p.max_professionals || ' profissionais' end, 'number', coalesce(p.max_professionals, 0)::text, 2),
    ('appointments',  case when p.max_appointments_month is null then 'Agendamentos ilimitados' else 'Até ' || p.max_appointments_month || ' agendamentos/mês' end, 'number', coalesce(p.max_appointments_month, 0)::text, 3),
    ('clients',       case when p.max_active_clients is null then 'Clientes ilimitados' else 'Até ' || p.max_active_clients || ' clientes ativos' end, 'number', coalesce(p.max_active_clients, 0)::text, 4)
) as f(feature_key, label, value_type, value, display_order)
where p.code in ('comeco', 'solo', 'equipe', 'rede');

insert into public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
select p.id, c.key, c.label, 'boolean'::feature_flag_value_type, to_jsonb((p.features ->> c.key)::boolean), 10 + c.ord
from public.plans p
cross join lateral (
  values
    ('online_scheduling',    'Agendamento online com link e QR code', 1),
    ('client_portal',        'Portal do cliente',                     2),
    ('confirmation_center',  'Central de confirmação por WhatsApp',   3),
    ('packages_memberships', 'Pacotes e assinaturas',                 4),
    ('analytics',            'Indicadores e Índice Cativa',           5),
    ('advanced_reports',     'Relatórios avançados',                  6),
    ('custom_logo',          'Marca própria (logo e cores)',          7),
    ('multi_unit',           'Várias unidades',                       8)
) as c(key, label, ord)
where p.code in ('comeco', 'solo', 'equipe', 'rede');