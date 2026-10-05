-- Keep tenant storage usage private and enforce plan quotas on updates as well
-- as inserts. Advisory locking serializes quota checks for a tenant.

CREATE OR REPLACE FUNCTION public.tenant_storage_bytes_used(_tenant_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $function$
DECLARE
  v_used_bytes bigint;
  v_has_archived_at boolean;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.is_tenant_member(auth.uid(), _tenant_id)
       OR public.is_super_admin(auth.uid())
     ) THEN
    RAISE EXCEPTION 'Acesso negado ao uso de armazenamento deste tenant.'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'storage.objects'::pg_catalog.regclass
      AND attname = 'archived_at'
      AND NOT attisdropped
  ) INTO v_has_archived_at;

  IF v_has_archived_at THEN
    EXECUTE
      'SELECT COALESCE(SUM(COALESCE((objects.metadata->>''size'')::bigint, 0)), 0)::bigint
       FROM storage.objects AS objects
       WHERE objects.bucket_id IN (''tenant-logos'', ''client-media'')
         AND (storage.foldername(objects.name))[1] = $1
         AND objects.archived_at IS NULL'
      INTO v_used_bytes
      USING _tenant_id::text;
  ELSE
    EXECUTE
      'SELECT COALESCE(SUM(COALESCE((objects.metadata->>''size'')::bigint, 0)), 0)::bigint
       FROM storage.objects AS objects
       WHERE objects.bucket_id IN (''tenant-logos'', ''client-media'')
         AND (storage.foldername(objects.name))[1] = $1'
      INTO v_used_bytes
      USING _tenant_id::text;
  END IF;

  RETURN COALESCE(v_used_bytes, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.tenant_storage_bytes_used(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tenant_storage_bytes_used(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_tenant_storage_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $function$
DECLARE
  v_tenant_id uuid;
  v_previous_tenant_id uuid;
  v_max_mb int;
  v_used_bytes bigint;
  v_replaced_bytes bigint := 0;
  v_new_bytes bigint;
  v_limit_bytes bigint;
  v_has_archived_at boolean;
BEGIN
  IF NEW.bucket_id NOT IN ('tenant-logos', 'client-media') THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_tenant_id := ((storage.foldername(NEW.name))[1])::uuid;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Caminho inválido para upload (esperado tenantId/...).'
      USING ERRCODE = '22023';
  END;

  -- Serialize uploads/overwrites for a tenant so concurrent requests cannot
  -- each observe the same free quota and exceed the plan limit together.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('cativa-storage-quota:' || v_tenant_id::text, 0)
  );

  SELECT (public.effective_subscription_limits(v_tenant_id)->>'max_storage_mb')::int
    INTO v_max_mb;

  IF v_max_mb IS NULL OR v_max_mb <= 0 THEN
    RETURN NEW;
  END IF;

  v_limit_bytes := v_max_mb::bigint * 1024 * 1024;
  v_new_bytes := COALESCE((NEW.metadata->>'size')::bigint, 0);
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'storage.objects'::pg_catalog.regclass
      AND attname = 'archived_at'
      AND NOT attisdropped
  ) INTO v_has_archived_at;

  EXECUTE
    'SELECT COALESCE(SUM(COALESCE((objects.metadata->>''size'')::bigint, 0)), 0)::bigint
     FROM storage.objects AS objects
     WHERE objects.bucket_id IN (''tenant-logos'', ''client-media'')
       AND (storage.foldername(objects.name))[1] = $1'
    || CASE WHEN v_has_archived_at THEN ' AND objects.archived_at IS NULL' ELSE '' END
    INTO v_used_bytes
    USING v_tenant_id::text;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.bucket_id IN ('tenant-logos', 'client-media') THEN
      BEGIN
        v_previous_tenant_id := ((storage.foldername(OLD.name))[1])::uuid;
      EXCEPTION WHEN OTHERS THEN
        v_previous_tenant_id := NULL;
      END;

      IF v_previous_tenant_id = v_tenant_id THEN
        v_replaced_bytes := COALESCE((OLD.metadata->>'size')::bigint, 0);
      END IF;
    END IF;
  ELSE
    -- Storage upserts enter through BEFORE INSERT before PostgreSQL applies
    -- ON CONFLICT DO UPDATE. Subtract the existing object's bytes here so a
    -- valid replacement is measured as a replacement, not double-counted.
    EXECUTE
      'SELECT COALESCE((
         SELECT COALESCE((objects.metadata->>''size'')::bigint, 0)
         FROM storage.objects AS objects
         WHERE objects.bucket_id = $1
           AND objects.name = $2'
      || CASE WHEN v_has_archived_at THEN ' AND objects.archived_at IS NULL' ELSE '' END
      || ' LIMIT 1
       ), 0)'
      INTO v_replaced_bytes
      USING NEW.bucket_id, NEW.name;
  END IF;

  v_used_bytes := GREATEST(0, COALESCE(v_used_bytes, 0) - v_replaced_bytes);

  IF (v_used_bytes + v_new_bytes) > v_limit_bytes THEN
    RAISE EXCEPTION 'Limite de armazenamento do plano atingido (% MB). Faça upgrade para continuar enviando arquivos.', v_max_mb
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS enforce_tenant_storage_limit_trg ON storage.objects;
CREATE TRIGGER enforce_tenant_storage_limit_trg
  BEFORE INSERT OR UPDATE ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_storage_limit();
