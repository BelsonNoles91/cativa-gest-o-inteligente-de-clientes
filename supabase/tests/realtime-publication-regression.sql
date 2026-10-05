-- Confirms that all tenant-scoped tables consumed by TenantRealtimeSync are
-- published after a clean `supabase db reset`.
DO $test$
DECLARE
  missing_tables text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    RAISE EXCEPTION 'A publicação supabase_realtime não existe.';
  END IF;

  SELECT array_agg(required.table_name ORDER BY required.table_name)
    INTO missing_tables
    FROM unnest(ARRAY[
      'appointments',
      'appointment_items',
      'clients',
      'waitlist_entries',
      'confirmation_queue'
    ]) AS required(table_name)
   WHERE NOT EXISTS (
     SELECT 1
       FROM pg_publication_tables published
      WHERE published.pubname = 'supabase_realtime'
        AND published.schemaname = 'public'
        AND published.tablename = required.table_name
   );

  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'Tabelas ausentes da publicação supabase_realtime: %', missing_tables;
  END IF;

  RAISE NOTICE 'Realtime habilitado para appointments, appointment_items, clients, waitlist_entries e confirmation_queue.';
END;
$test$;
