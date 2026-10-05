CREATE TABLE IF NOT EXISTS public.retention_advisor_daily_usage (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usage_date date NOT NULL,
  invocation_count integer NOT NULL DEFAULT 0 CHECK (invocation_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, usage_date)
);

ALTER TABLE public.retention_advisor_daily_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.retention_advisor_daily_usage FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.retention_advisor_daily_usage TO service_role;
CREATE POLICY retention_advisor_daily_usage_service_read
  ON public.retention_advisor_daily_usage
  FOR SELECT TO service_role
  USING (true);

CREATE OR REPLACE FUNCTION public.reserve_retention_advisor_evaluation(
  _tenant_id uuid,
  _daily_limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  quota_day date := (statement_timestamp() AT TIME ZONE 'UTC')::date;
  reserved_count integer;
BEGIN
  IF _tenant_id IS NULL OR _daily_limit IS NULL OR _daily_limit < 1 THEN
    RAISE EXCEPTION 'tenant and positive daily limit are required' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.retention_advisor_daily_usage
  WHERE tenant_id = _tenant_id
    AND usage_date < quota_day - 90;

  INSERT INTO public.retention_advisor_daily_usage AS usage (
    tenant_id,
    usage_date,
    invocation_count,
    updated_at
  ) VALUES (
    _tenant_id,
    quota_day,
    1,
    statement_timestamp()
  )
  ON CONFLICT (tenant_id, usage_date) DO UPDATE
    SET invocation_count = usage.invocation_count + 1,
        updated_at = statement_timestamp()
    WHERE usage.invocation_count < _daily_limit
  RETURNING invocation_count INTO reserved_count;

  RETURN reserved_count IS NOT NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_retention_advisor_evaluation(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_retention_advisor_evaluation(uuid, integer) TO service_role;
