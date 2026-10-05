-- Serialize potentially conflicting appointment writes before the GiST
-- exclusion constraints inspect concurrent tuples. Under high contention,
-- concurrent checks can otherwise deadlock even though the constraint still
-- prevents double-booking.
--
-- Locks are scoped to each UTC day touched by the occupied interval and are
-- acquired in a global deterministic order. Overlapping intervals therefore
-- share at least one lock, while appointments on unrelated days remain
-- concurrent. Resource locks mirror the resource exclusion constraint.
CREATE OR REPLACE FUNCTION public.serialize_appointment_conflict_checks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_first_day date;
  v_last_day date;
  v_lock_day date;
  v_lock_key bigint;
  v_lock_keys bigint[] := ARRAY[]::bigint[];
BEGIN
  -- The preceding sync_appointment_occupied_range trigger maintains these
  -- fields. Trigger names are ordered alphabetically, so this trigger's zzz
  -- prefix intentionally places it after that synchronization trigger.
  IF NEW.occupied_starts_at IS NULL OR NEW.occupied_ends_at IS NULL THEN
    RAISE EXCEPTION 'Intervalo ocupado do agendamento não foi calculado.'
      USING ERRCODE = '23514';
  END IF;

  v_first_day := (NEW.occupied_starts_at AT TIME ZONE 'UTC')::date;
  -- Exclusion ranges are half-open. Subtract one microsecond so an interval
  -- ending exactly at midnight does not take a lock for the following day.
  v_last_day := ((NEW.occupied_ends_at - interval '1 microsecond') AT TIME ZONE 'UTC')::date;

  v_lock_day := v_first_day;
  WHILE v_lock_day <= v_last_day LOOP
    v_lock_keys := array_append(
      v_lock_keys,
      hashtextextended(
        'appointment:professional:' || NEW.professional_id::text || ':' || to_char(v_lock_day, 'YYYY-MM-DD'),
        0
      )
    );

    IF NEW.resource_id IS NOT NULL THEN
      v_lock_keys := array_append(
        v_lock_keys,
        hashtextextended(
          'appointment:resource:' || NEW.resource_id::text || ':' || to_char(v_lock_day, 'YYYY-MM-DD'),
          0
        )
      );
    END IF;

    v_lock_day := v_lock_day + 1;
  END LOOP;

  FOR v_lock_key IN
    SELECT locks.key
    FROM unnest(v_lock_keys) AS locks(key)
    ORDER BY locks.key
  LOOP
    PERFORM pg_advisory_xact_lock(v_lock_key);
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.serialize_appointment_conflict_checks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.serialize_appointment_conflict_checks() TO service_role;

DROP TRIGGER IF EXISTS appointments_zzz_serialize_conflict_checks ON public.appointments;
CREATE TRIGGER appointments_zzz_serialize_conflict_checks
BEFORE INSERT OR UPDATE OF
  professional_id,
  resource_id,
  starts_at,
  ends_at,
  buffer_before_minutes,
  buffer_after_minutes,
  occupied_starts_at,
  occupied_ends_at,
  status,
  is_overbooked
ON public.appointments
FOR EACH ROW
WHEN (NEW.status NOT IN ('canceled', 'no_show') AND NOT NEW.is_overbooked)
EXECUTE FUNCTION public.serialize_appointment_conflict_checks();
