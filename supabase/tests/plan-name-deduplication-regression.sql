-- Exercises the forward reconciliation migration with disposable duplicate
-- plans and verifies dependent records; the enclosing transaction rolls back.
BEGIN;

ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_name_unique;

CREATE TEMP TABLE qa_plan_merge_fixture ON COMMIT DROP AS
SELECT
  gen_random_uuid() AS canonical_id,
  gen_random_uuid() AS duplicate_id,
  gen_random_uuid() AS tenant_id,
  'qa-plan-merge-' || replace(gen_random_uuid()::text, '-', '') AS suffix;

INSERT INTO public.plans (id, code, name, status, is_default)
SELECT canonical_id, 'qa-keep-' || suffix, 'QA plan merge ' || suffix, 'public'::public.plan_status, true
FROM qa_plan_merge_fixture
UNION ALL
SELECT duplicate_id, 'qa-drop-' || suffix, 'QA plan merge ' || suffix, 'archived'::public.plan_status, false
FROM qa_plan_merge_fixture;

INSERT INTO public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
SELECT canonical_id, 'qa_shared', 'Preserve canonical value', 'boolean'::public.feature_flag_value_type, 'true'::jsonb, 1
FROM qa_plan_merge_fixture
UNION ALL
SELECT duplicate_id, 'qa_shared', 'Conflicting duplicate value', 'boolean'::public.feature_flag_value_type, 'false'::jsonb, 1
FROM qa_plan_merge_fixture
UNION ALL
SELECT duplicate_id, 'qa_duplicate_only', 'Copy missing feature', 'boolean'::public.feature_flag_value_type, 'true'::jsonb, 2
FROM qa_plan_merge_fixture;

INSERT INTO public.tenant_subscriptions (tenant_id, plan_id, status)
SELECT tenant_id, duplicate_id, 'trialing'::public.subscription_status
FROM qa_plan_merge_fixture;

INSERT INTO public.subscription_events (tenant_id, event_type, from_plan_id, to_plan_id)
SELECT tenant_id, 'created'::public.subscription_event_type, duplicate_id, duplicate_id
FROM qa_plan_merge_fixture;

CREATE TEMP TABLE _duplicate_plans_to_merge ON COMMIT DROP AS
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
SELECT merge.canonical_id, feature.feature_key, feature.label, feature.value_type, feature.value, feature.display_order
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

DO $$
DECLARE
  fixture qa_plan_merge_fixture%ROWTYPE;
  feature_value jsonb;
  subscription_plan uuid;
  event_from_plan uuid;
  event_to_plan uuid;
BEGIN
  SELECT * INTO STRICT fixture FROM qa_plan_merge_fixture;

  IF EXISTS (SELECT 1 FROM public.plans WHERE id = fixture.duplicate_id) THEN
    RAISE EXCEPTION 'duplicate plan was not removed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plans WHERE id = fixture.canonical_id) THEN
    RAISE EXCEPTION 'canonical plan was not preserved';
  END IF;

  SELECT value INTO feature_value
  FROM public.plan_features
  WHERE plan_id = fixture.canonical_id AND feature_key = 'qa_shared';
  IF feature_value IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION 'canonical feature value was overwritten: %', feature_value;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.plan_features
    WHERE plan_id = fixture.canonical_id AND feature_key = 'qa_duplicate_only'
  ) THEN
    RAISE EXCEPTION 'non-conflicting feature was not merged';
  END IF;

  SELECT plan_id INTO subscription_plan
  FROM public.tenant_subscriptions WHERE tenant_id = fixture.tenant_id;
  IF subscription_plan IS DISTINCT FROM fixture.canonical_id THEN
    RAISE EXCEPTION 'subscription still references duplicate plan';
  END IF;

  SELECT from_plan_id, to_plan_id INTO event_from_plan, event_to_plan
  FROM public.subscription_events WHERE tenant_id = fixture.tenant_id;
  IF event_from_plan IS DISTINCT FROM fixture.canonical_id
     OR event_to_plan IS DISTINCT FROM fixture.canonical_id THEN
    RAISE EXCEPTION 'subscription history still references duplicate plan';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.plans'::regclass AND conname = 'plans_name_unique'
  ) THEN
    RAISE EXCEPTION 'unique plan-name constraint was not restored';
  END IF;
END;
$$;

ROLLBACK;
