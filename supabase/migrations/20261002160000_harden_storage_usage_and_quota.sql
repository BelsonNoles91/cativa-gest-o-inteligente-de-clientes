-- Keep tenant storage usage private and enforce plan quotas on updates as well
-- as inserts. Advisory locking serializes quota checks for a tenant.

CREATE OR REPLACE FUNCTION public.tenant_storage_bytes_used(_tenant_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, storage
AS $function$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.is_tenant_member(auth.uid(), _tenant_id)
       OR public.is_super_admin(auth.uid())
     ) THEN
    RAISE EXCEPTION 'Acesso negado ao uso de armazenamento deste tenant.'
      USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COALESCE(SUM(COALESCE((objects.metadata->>'size')::bigint, 0)), 0)::bigint
    FROM storage.objects AS objects
    WHERE objects.bucket_id IN ('tenant-logos', 'client-media')
      AND (storage.foldername(objects.name))[1] = _tenant_id::text
      -- Storage schema versions differ: some expose archived_at while older
      -- supported versions do not. JSON access keeps this query compatible;
      -- a missing key means every stored object is active.
      AND (to_jsonb(objects)->>'archived_at') IS NULL
  );
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
  SELECT COALESCE(SUM(COALESCE((objects.metadata->>'size')::bigint, 0)), 0)::bigint
    INTO v_used_bytes
  FROM storage.objects AS objects
  WHERE objects.bucket_id IN ('tenant-logos', 'client-media')
    AND (storage.foldername(objects.name))[1] = v_tenant_id::text
    AND (to_jsonb(objects)->>'archived_at') IS NULL;

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
    SELECT COALESCE((
      SELECT COALESCE((objects.metadata->>'size')::bigint, 0)
      FROM storage.objects AS objects
      WHERE objects.bucket_id = NEW.bucket_id
        AND objects.name = NEW.name
        AND (to_jsonb(objects)->>'archived_at') IS NULL
      LIMIT 1
    ), 0) INTO v_replaced_bytes;
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
