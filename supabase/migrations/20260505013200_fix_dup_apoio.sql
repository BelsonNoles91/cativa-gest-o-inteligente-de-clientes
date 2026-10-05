-- Reatribuir assinaturas do segundo Apoio para o primeiro
UPDATE public.tenant_subscriptions
  SET plan_id = 'f5ed57f0-3a9e-40e3-b925-5c037188c610'
WHERE plan_id = '5c44bc13-02f0-464f-bbb2-96ab92c33362';

-- Reatribuir eventos
UPDATE public.subscription_events
  SET to_plan_id = 'f5ed57f0-3a9e-40e3-b925-5c037188c610'
WHERE to_plan_id = '5c44bc13-02f0-464f-bbb2-96ab92c33362';

UPDATE public.subscription_events
  SET from_plan_id = 'f5ed57f0-3a9e-40e3-b925-5c037188c610'
WHERE from_plan_id = '5c44bc13-02f0-464f-bbb2-96ab92c33362';

-- Deletar features duplicadas
DELETE FROM public.plan_features WHERE plan_id = '5c44bc13-02f0-464f-bbb2-96ab92c33362';

-- Deletar o plano duplicado
DELETE FROM public.plans WHERE id = '5c44bc13-02f0-464f-bbb2-96ab92c33362';

-- Adicionar constraint para evitar futuros duplicados
-- A migração seguinte consolida duplicatas legadas que não usam os IDs de
-- produção acima. Não falhe um reset limpo antes que ela possa reconciliá-las.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.plans
    GROUP BY name
    HAVING count(*) > 1
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.plans'::regclass
      AND conname = 'plans_name_unique'
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_name_unique UNIQUE (name);
  END IF;
END;
$$;
