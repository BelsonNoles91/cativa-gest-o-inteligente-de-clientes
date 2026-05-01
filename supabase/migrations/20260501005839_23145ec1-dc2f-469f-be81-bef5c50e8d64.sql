-- 1. Plano APOIO
UPDATE public.plans 
SET 
    name = 'Apoio',
    description = 'Ideal para quem está começando agora.',
    price_cents = 0,
    billing_period = 'monthly',
    max_units = 1,
    max_professionals = 1,
    max_active_clients = 50,
    max_appointments_month = 25,
    max_storage_mb = 100,
    status = 'public',
    is_default = true,
    display_order = 1,
    updated_at = now()
WHERE code IN ('starter', 'free', 'apoio');

-- 2. Plano EMPREENDEDOR
UPDATE public.plans 
SET 
    name = 'Empreendedor',
    description = 'Para o profissional que quer crescer com controle.',
    price_cents = 4490,
    billing_period = 'monthly',
    max_units = 1,
    max_professionals = 2,
    max_active_clients = 500,
    max_appointments_month = 300,
    max_storage_mb = 500,
    status = 'public',
    is_default = false,
    display_order = 2,
    updated_at = now()
WHERE code IN ('pro', 'entrepreneur', 'empreendedor');

-- 3. Plano STUDIO
UPDATE public.plans 
SET 
    name = 'Studio',
    description = 'Gestão completa sem limites de escala.',
    price_cents = 9490,
    billing_period = 'monthly',
    max_units = NULL,
    max_professionals = NULL,
    max_active_clients = 2000,
    max_appointments_month = NULL,
    max_storage_mb = 5120,
    status = 'public',
    is_default = false,
    display_order = 3,
    updated_at = now()
WHERE code IN ('studio');

-- Limpar e reinserir features com cast JSONB
DELETE FROM public.plan_features 
WHERE plan_id IN (SELECT id FROM public.plans WHERE status = 'public');

-- APOIO
INSERT INTO public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
SELECT id, 'units', '1 unidade', 'number'::feature_flag_value_type, '1'::jsonb, 1 FROM public.plans WHERE code IN ('starter', 'free', 'apoio')
UNION ALL
SELECT id, 'professionals', '1 profissional', 'number'::feature_flag_value_type, '1'::jsonb, 2 FROM public.plans WHERE code IN ('starter', 'free', 'apoio')
UNION ALL
SELECT id, 'appointments', '25 atendimentos/mês', 'number'::feature_flag_value_type, '25'::jsonb, 3 FROM public.plans WHERE code IN ('starter', 'free', 'apoio')
UNION ALL
SELECT id, 'clients', '50 clientes ativos', 'number'::feature_flag_value_type, '50'::jsonb, 4 FROM public.plans WHERE code IN ('starter', 'free', 'apoio')
UNION ALL
SELECT id, 'storage', '100 MB de armazenamento', 'number'::feature_flag_value_type, '100'::jsonb, 5 FROM public.plans WHERE code IN ('starter', 'free', 'apoio');

-- EMPREENDEDOR
INSERT INTO public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
SELECT id, 'units', '1 unidade', 'number'::feature_flag_value_type, '1'::jsonb, 1 FROM public.plans WHERE code IN ('pro', 'entrepreneur', 'empreendedor')
UNION ALL
SELECT id, 'professionals', 'Até 2 profissionais', 'number'::feature_flag_value_type, '2'::jsonb, 2 FROM public.plans WHERE code IN ('pro', 'entrepreneur', 'empreendedor')
UNION ALL
SELECT id, 'appointments', 'Até 300 atendimentos/mês', 'number'::feature_flag_value_type, '300'::jsonb, 3 FROM public.plans WHERE code IN ('pro', 'entrepreneur', 'empreendedor')
UNION ALL
SELECT id, 'clients', 'Até 500 clientes ativos', 'number'::feature_flag_value_type, '500'::jsonb, 4 FROM public.plans WHERE code IN ('pro', 'entrepreneur', 'empreendedor')
UNION ALL
SELECT id, 'storage', '500 MB de armazenamento', 'number'::feature_flag_value_type, '500'::jsonb, 5 FROM public.plans WHERE code IN ('pro', 'entrepreneur', 'empreendedor')
UNION ALL
SELECT id, 'online_scheduling', 'Agendamento online', 'boolean'::feature_flag_value_type, 'true'::jsonb, 6 FROM public.plans WHERE code IN ('pro', 'entrepreneur', 'empreendedor')
UNION ALL
SELECT id, 'custom_logo', 'Logo personalizada', 'boolean'::feature_flag_value_type, 'true'::jsonb, 7 FROM public.plans WHERE code IN ('pro', 'entrepreneur', 'empreendedor');

-- STUDIO
INSERT INTO public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
SELECT id, 'units', 'Unidades ilimitadas', 'number'::feature_flag_value_type, '0'::jsonb, 1 FROM public.plans WHERE code = 'studio'
UNION ALL
SELECT id, 'professionals', 'Profissionais ilimitados', 'number'::feature_flag_value_type, '0'::jsonb, 2 FROM public.plans WHERE code = 'studio'
UNION ALL
SELECT id, 'appointments', 'Atendimentos ilimitados', 'number'::feature_flag_value_type, '0'::jsonb, 3 FROM public.plans WHERE code = 'studio'
UNION ALL
SELECT id, 'clients', 'Até 2.000 clientes ativos', 'number'::feature_flag_value_type, '2000'::jsonb, 4 FROM public.plans WHERE code = 'studio'
UNION ALL
SELECT id, 'storage', '5 GB de armazenamento', 'number'::feature_flag_value_type, '5120'::jsonb, 5 FROM public.plans WHERE code = 'studio'
UNION ALL
SELECT id, 'online_scheduling', 'Agendamento online', 'boolean'::feature_flag_value_type, 'true'::jsonb, 6 FROM public.plans WHERE code = 'studio'
UNION ALL
SELECT id, 'custom_logo', 'Logo personalizada', 'boolean'::feature_flag_value_type, 'true'::jsonb, 7 FROM public.plans WHERE code = 'studio'
UNION ALL
SELECT id, 'advanced_reports', 'Relatórios avançados', 'boolean'::feature_flag_value_type, 'true'::jsonb, 8 FROM public.plans WHERE code = 'studio';
