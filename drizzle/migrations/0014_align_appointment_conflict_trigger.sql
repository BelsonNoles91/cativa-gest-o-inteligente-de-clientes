CREATE OR REPLACE FUNCTION public.check_appointment_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_has_conflict boolean;
  v_tenant_timezone text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_weekday smallint;
BEGIN
  IF NEW.status IN ('canceled', 'no_show') OR NEW.is_overbooked THEN
    RETURN NEW;
  END IF;

  NEW.occupied_starts_at := NEW.starts_at - make_interval(mins => greatest(NEW.buffer_before_minutes, 0));
  NEW.occupied_ends_at := NEW.ends_at + make_interval(mins => greatest(NEW.buffer_after_minutes, 0));

  SELECT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id <> NEW.id
      AND a.professional_id = NEW.professional_id
      AND a.tenant_id = NEW.tenant_id
      AND a.status NOT IN ('canceled', 'no_show')
      AND NOT a.is_overbooked
      AND tstzrange(a.occupied_starts_at, a.occupied_ends_at, '[)')
          && tstzrange(NEW.occupied_starts_at, NEW.occupied_ends_at, '[)')
  ) INTO v_has_conflict;
  IF v_has_conflict THEN
    RAISE EXCEPTION 'O profissional já possui um agendamento neste horário, incluindo os intervalos de preparação.' USING ERRCODE = '23P01';
  END IF;

  IF NEW.resource_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.appointments a
      WHERE a.id <> NEW.id
        AND a.resource_id = NEW.resource_id
        AND a.tenant_id = NEW.tenant_id
        AND a.status NOT IN ('canceled', 'no_show')
        AND NOT a.is_overbooked
        AND tstzrange(a.occupied_starts_at, a.occupied_ends_at, '[)')
            && tstzrange(NEW.occupied_starts_at, NEW.occupied_ends_at, '[)')
    ) INTO v_has_conflict;
    IF v_has_conflict THEN
      RAISE EXCEPTION 'O recurso já está reservado neste horário, incluindo os intervalos de preparação.' USING ERRCODE = '23P01';
    END IF;
  END IF;

  SELECT coalesce(timezone, 'America/Sao_Paulo') INTO v_tenant_timezone
  FROM public.tenants WHERE id = NEW.tenant_id;
  v_local_start := NEW.starts_at AT TIME ZONE v_tenant_timezone;
  v_local_end := NEW.ends_at AT TIME ZONE v_tenant_timezone;
  v_weekday := extract(dow FROM v_local_start)::smallint;

  IF NOT EXISTS (
    SELECT 1
    FROM public.unit_business_hours h
    WHERE h.unit_id = NEW.unit_id
      AND h.weekday = v_weekday
      AND NOT h.is_closed
      AND v_local_start::date = v_local_end::date
      AND v_local_start::time >= h.opens_at
      AND v_local_end::time <= h.closes_at
  ) THEN
    RAISE EXCEPTION 'O agendamento está fora do horário de funcionamento da unidade.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.check_appointment_conflicts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_appointment_conflicts() TO service_role;