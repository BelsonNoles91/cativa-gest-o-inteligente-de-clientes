-- Adicionar colunas de controle de recursos na tabela de planos
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{}'::jsonb;

-- Atualizar recursos para cada plano baseado na estratégia de produto
UPDATE public.plans SET features = '{"online_scheduling": false, "custom_logo": false, "advanced_reports": false}'::jsonb WHERE code = 'free';
UPDATE public.plans SET features = '{"online_scheduling": true, "custom_logo": true, "advanced_reports": false}'::jsonb WHERE code = 'entrepreneur';
UPDATE public.plans SET features = '{"online_scheduling": true, "custom_logo": true, "advanced_reports": true}'::jsonb WHERE code = 'studio';

-- Adicionar coluna de metadata nos tenants para overrides pontuais (Pulo do Gato)
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Criar uma função para verificar se um tenant tem acesso a uma funcionalidade
CREATE OR REPLACE FUNCTION public.tenant_has_feature(_tenant_id uuid, _feature_key text)
RETURNS boolean AS $$
DECLARE
    _plan_features jsonb;
    _tenant_overrides jsonb;
BEGIN
    -- 1. Buscar features do plano atual
    SELECT p.features INTO _plan_features
    FROM public.tenant_subscriptions ts
    JOIN public.plans p ON p.id = ts.plan_id
    WHERE ts.tenant_id = _tenant_id AND ts.status IN ('active', 'trialing');

    -- 2. Buscar overrides no tenant (Metadata)
    SELECT metadata INTO _tenant_overrides
    FROM public.tenants
    WHERE id = _tenant_id;

    -- 3. Lógica de precedência: Override do Tenant > Feature do Plano
    -- O override pode ser boolean ou conter data de expiração futuramente
    IF (_tenant_overrides->'feature_overrides'->>_feature_key)::boolean = true THEN
        RETURN true;
    END IF;

    RETURN (_plan_features->>_feature_key)::boolean = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
