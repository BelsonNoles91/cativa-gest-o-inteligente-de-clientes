-- Esta migração varre o banco de dados e corrige as assinaturas que foram criadas 
-- antes da nova política (que permitia que planos gratuitos tivessem período de "trial").
-- Ela força as assinaturas desses planos para 'active' e remove as tags de trial.

UPDATE public.tenant_subscriptions
SET 
  status = 'active',
  trial_started_at = NULL,
  trial_ends_at = NULL,
  current_period_start = COALESCE(current_period_start, now()),
  current_period_end = now() + interval '1 month'
WHERE plan_id IN (SELECT id FROM public.plans WHERE price_cents <= 0)
  AND status = 'trialing';

UPDATE public.tenant_subscriptions
SET 
  status = 'active',
  trial_started_at = NULL,
  trial_ends_at = NULL,
  current_period_start = now(),
  current_period_end = now() + interval '1 month'
WHERE plan_id IN (SELECT id FROM public.plans WHERE price_cents <= 0)
  AND status IN ('canceled', 'suspended', 'overdue');
