-- Public, allowlisted system flags used by signup and maintenance gates.
-- The RPC deliberately exposes only these three boolean controls, never raw
-- feature_flags rows or tenant-specific configuration.
CREATE OR REPLACE FUNCTION public.get_public_system_flags()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH selected_flags AS (
    SELECT DISTINCT ON (flag.flag_key)
      flag.flag_key,
      flag.value
    FROM public.feature_flags AS flag
    WHERE flag.tenant_id IS NULL
      AND flag.is_global = true
      AND flag.value_type = 'boolean'
      AND jsonb_typeof(flag.value) = 'boolean'
      AND flag.flag_key IN (
        'enable_signups',
        'maintenance_mode',
        'show_cativa_index'
      )
    ORDER BY
      flag.flag_key,
      flag.updated_at DESC,
      flag.created_at DESC,
      flag.id DESC
  )
  SELECT COALESCE(
    jsonb_object_agg(flag_key, value),
    '{}'::jsonb
  )
  FROM selected_flags;
$$;

REVOKE ALL ON FUNCTION public.get_public_system_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_system_flags()
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_public_system_flags() IS
  'Returns only the allowlisted public boolean flags for signup, maintenance, and the Cativa index.';
