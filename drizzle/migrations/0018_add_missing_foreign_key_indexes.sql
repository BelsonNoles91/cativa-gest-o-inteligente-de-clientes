-- Fase 8: índices nas chaves estrangeiras sem índice (joins e exclusões em cascata).
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl, a.attname AS col, ck.attnum
    FROM pg_constraint k
    JOIN pg_class c ON c.oid = k.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN unnest(k.conkey) ck(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ck.attnum
    WHERE n.nspname = 'public' AND k.contype = 'f'
      AND NOT EXISTS (
        SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indkey[0] = ck.attnum
      )
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (%I)',
      'idx_' || r.tbl || '_' || r.col, r.tbl, r.col
    );
  END LOOP;
END
$$;