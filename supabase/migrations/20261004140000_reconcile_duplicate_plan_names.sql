-- Reconcile duplicate plan names for databases where the legacy Apoio migration
-- already ran with production-specific IDs. Existing subscriptions and event
-- history are redirected before duplicate plans are removed.
CREATE TEMPORARY TABLE _duplicate_plans_to_merge ON COMMIT DROP AS
WITH ranked_plans AS (
  SELECT
    p.id AS plan_id,
    first_value(p.id) OVER (
      PARTITION BY p.name
      ORDER BY
        (p.code = 'free') DESC,
        (p.status = 'public') DESC,
        p.is_default DESC,
        p.created_at ASC,
        p.id ASC
    ) AS canonical_id,
    row_number() OVER (
      PARTITION BY p.name
      ORDER BY
        (p.code = 'free') DESC,
        (p.status = 'public') DESC,
        p.is_default DESC,
        p.created_at ASC,
        p.id ASC
    ) AS name_rank
  FROM public.plans AS p
)
SELECT plan_id, canonical_id
FROM ranked_plans
WHERE name_rank > 1;

INSERT INTO public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
SELECT
  merge.canonical_id,
  feature.feature_key,
  feature.label,
  feature.value_type,
  feature.value,
  feature.display_order
FROM _duplicate_plans_to_merge AS merge
JOIN public.plan_features AS feature ON feature.plan_id = merge.plan_id
ON CONFLICT (plan_id, feature_key) DO NOTHING;

UPDATE public.tenant_subscriptions AS subscription
SET plan_id = merge.canonical_id
FROM _duplicate_plans_to_merge AS merge
WHERE subscription.plan_id = merge.plan_id;

UPDATE public.subscription_events AS event
SET to_plan_id = merge.canonical_id
FROM _duplicate_plans_to_merge AS merge
WHERE event.to_plan_id = merge.plan_id;

UPDATE public.subscription_events AS event
SET from_plan_id = merge.canonical_id
FROM _duplicate_plans_to_merge AS merge
WHERE event.from_plan_id = merge.plan_id;

DELETE FROM public.plans AS plan
USING _duplicate_plans_to_merge AS merge
WHERE plan.id = merge.plan_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.plans'::regclass
      AND conname = 'plans_name_unique'
  ) THEN
    ALTER TABLE public.plans ADD CONSTRAINT plans_name_unique UNIQUE (name);
  END IF;
END;
$$;
