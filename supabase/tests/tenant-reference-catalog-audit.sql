-- Automatically audit tenant-aware foreign keys after all migrations.
-- Every child/parent pair must have an active scope trigger and zero existing
-- rows whose tenant_id disagrees with the referenced record.

DO $audit$
DECLARE
  edge record;
  mismatched_rows bigint;
  audited_edges integer := 0;
BEGIN
  FOR edge IN
    SELECT
      con.oid,
      con.conname,
      child.oid AS child_oid,
      child.relname AS child_table,
      parent.relname AS parent_table,
      (
        SELECT string_agg(
          format('child_row.%I = parent_row.%I', child_column.attname, parent_column.attname),
          ' AND ' ORDER BY key.ord
        )
        FROM unnest(con.conkey, con.confkey) WITH ORDINALITY
          AS key(child_attnum, parent_attnum, ord)
        JOIN pg_attribute child_column
          ON child_column.attrelid = con.conrelid AND child_column.attnum = key.child_attnum
        JOIN pg_attribute parent_column
          ON parent_column.attrelid = con.confrelid AND parent_column.attnum = key.parent_attnum
      ) AS join_condition
    FROM pg_constraint con
    JOIN pg_class child ON child.oid = con.conrelid
    JOIN pg_namespace child_schema ON child_schema.oid = child.relnamespace
    JOIN pg_class parent ON parent.oid = con.confrelid
    JOIN pg_namespace parent_schema ON parent_schema.oid = parent.relnamespace
    WHERE con.contype = 'f'
      AND child_schema.nspname = 'public'
      AND parent_schema.nspname = 'public'
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = child.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
      )
      AND EXISTS (
        SELECT 1 FROM pg_attribute a
        WHERE a.attrelid = parent.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
      )
    ORDER BY child.relname, con.conname
  LOOP
    audited_edges := audited_edges + 1;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger trigger_row
      JOIN pg_proc trigger_function ON trigger_function.oid = trigger_row.tgfoid
      WHERE trigger_row.tgrelid = edge.child_oid
        AND NOT trigger_row.tgisinternal
        AND (trigger_row.tgtype & 1) = 1 -- row-level
        AND (trigger_row.tgtype & 2) = 2 -- BEFORE
        AND (trigger_row.tgtype & 4) = 4 -- INSERT
        AND (trigger_row.tgtype & 16) = 16 -- UPDATE
        AND trigger_function.proname ~* '(tenant|scope|integrity|reference)'
    ) THEN
      RAISE EXCEPTION 'FK tenant-aware sem trigger BEFORE INSERT/UPDATE: %.% -> %',
        edge.child_table, edge.conname, edge.parent_table;
    END IF;

    EXECUTE format(
      'SELECT count(*) FROM public.%I child_row JOIN public.%I parent_row ON %s WHERE child_row.tenant_id IS DISTINCT FROM parent_row.tenant_id',
      edge.child_table,
      edge.parent_table,
      edge.join_condition
    ) INTO mismatched_rows;

    IF mismatched_rows > 0 THEN
      RAISE EXCEPTION 'FK tenant-aware contém % linha(s) incoerente(s): %.% -> %',
        mismatched_rows, edge.child_table, edge.conname, edge.parent_table;
    END IF;
  END LOOP;

  IF audited_edges = 0 THEN
    RAISE EXCEPTION 'Nenhuma relação FK tenant-aware foi encontrada; auditoria não pode passar vazia.';
  END IF;

  RAISE NOTICE 'Tenant-reference catalog audit: % FK tenant-aware verificadas, sem referências sem guard e sem inconsistências.', audited_edges;
END
$audit$;
