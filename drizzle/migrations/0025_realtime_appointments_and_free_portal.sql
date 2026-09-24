DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['appointments','appointment_items','clients','waitlist_entries','confirmation_queue'] LOOP
    IF to_regclass('public.'||t) IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- Portal do cliente liberado em todos os planos, inclusive o gratuito
UPDATE public.plan_features SET value = 'true'::jsonb WHERE feature_key = 'client_portal';
INSERT INTO public.plan_features (plan_id, feature_key, label, value_type, value, display_order)
SELECT p.id, 'client_portal', 'Portal do cliente', 'boolean'::public.feature_flag_value_type, 'true'::jsonb, 22
FROM public.plans p
ON CONFLICT (plan_id, feature_key) DO UPDATE SET value = 'true'::jsonb;
UPDATE public.plans SET features = coalesce(features,'{}'::jsonb) || '{"client_portal": true}'::jsonb, updated_at = now();