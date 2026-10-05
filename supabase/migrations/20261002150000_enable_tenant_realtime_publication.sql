-- Realtime subscriptions are used by the authenticated agenda and confirmation
-- center. A fresh Supabase project creates this publication but does not
-- automatically add application tables to it.
DO $migration$
DECLARE
  table_name text;
  realtime_tables text[] := ARRAY[
    'appointments',
    'appointment_items',
    'clients',
    'waitlist_entries',
    'confirmation_queue'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'A publicação supabase_realtime não existe neste projeto.';
  END IF;

  FOREACH table_name IN ARRAY realtime_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      RAISE EXCEPTION 'Tabela pública necessária para Realtime não encontrada: %', table_name;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION %I ADD TABLE public.%I', 'supabase_realtime', table_name);
    END IF;
  END LOOP;
END;
$migration$;
