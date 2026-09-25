-- Restaura no backend oficial de QA as garantias de integridade da agenda que
-- já existem no código/tipos locais, sem importar o restante da cadeia Drizzle.

-- O portal autenticado precisa distinguir serviços publicáveis. A coluna faz
-- parte do modelo atual e é adicionada de forma compatível com dados legados.
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS occupied_starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS occupied_ends_at timestamptz;

COMMENT ON COLUMN public.appointments.occupied_starts_at IS
  'Intervalo efetivamente ocupado, incluindo buffer anterior; mantido por trigger.';
COMMENT ON COLUMN public.appointments.occupied_ends_at IS
  'Intervalo efetivamente ocupado, incluindo buffer posterior; mantido por trigger.';

UPDATE public.appointments
SET occupied_starts_at = starts_at - make_interval(mins => greatest(buffer_before_minutes, 0)),
    occupied_ends_at = ends_at + make_interval(mins => greatest(buffer_after_minutes, 0))
WHERE occupied_starts_at IS DISTINCT FROM starts_at - make_interval(mins => greatest(buffer_before_minutes, 0))
   OR occupied_ends_at IS DISTINCT FROM ends_at + make_interval(mins => greatest(buffer_after_minutes, 0));

-- Falha antes de trocar constraints caso os dados existentes já contenham
-- colisões quando os buffers são considerados. Assim a migration permanece
-- atômica e não "resolve" dados de negócio silenciosamente.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.appointments b
      ON b.tenant_id = a.tenant_id
     AND b.professional_id = a.professional_id
     AND b.id > a.id
    WHERE a.status NOT IN ('canceled', 'no_show')
      AND b.status NOT IN ('canceled', 'no_show')
      AND NOT a.is_overbooked
      AND NOT b.is_overbooked
      AND tstzrange(a.occupied_starts_at, a.occupied_ends_at, '[)')
          && tstzrange(b.occupied_starts_at, b.occupied_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Existem agendamentos ativos conflitantes quando os buffers são considerados.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.appointments a
    JOIN public.appointments b
      ON b.tenant_id = a.tenant_id
     AND b.resource_id = a.resource_id
     AND b.id > a.id
    WHERE a.resource_id IS NOT NULL
      AND a.status NOT IN ('canceled', 'no_show')
      AND b.status NOT IN ('canceled', 'no_show')
      AND NOT a.is_overbooked
      AND NOT b.is_overbooked
      AND tstzrange(a.occupied_starts_at, a.occupied_ends_at, '[)')
          && tstzrange(b.occupied_starts_at, b.occupied_ends_at, '[)')
  ) THEN
    RAISE EXCEPTION 'Existem recursos ativos conflitantes quando os buffers são considerados.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_appointment_occupied_range()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.occupied_starts_at := NEW.starts_at - make_interval(mins => greatest(NEW.buffer_before_minutes, 0));
  NEW.occupied_ends_at := NEW.ends_at + make_interval(mins => greatest(NEW.buffer_after_minutes, 0));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_sync_occupied_range ON public.appointments;
CREATE TRIGGER appointments_sync_occupied_range
BEFORE INSERT OR UPDATE OF starts_at, ends_at, buffer_before_minutes, buffer_after_minutes
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.sync_appointment_occupied_range();

REVOKE ALL ON FUNCTION public.sync_appointment_occupied_range() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_appointment_occupied_range() TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_positive_duration'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_positive_duration CHECK (duration_minutes > 0) NOT VALID;
    ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_positive_duration;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_nonnegative_buffers'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_nonnegative_buffers
      CHECK (buffer_before_minutes >= 0 AND buffer_after_minutes >= 0) NOT VALID;
    ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_nonnegative_buffers;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.appointments'::regclass
      AND conname = 'appointments_nonnegative_price'
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_nonnegative_price CHECK (total_price_cents >= 0) NOT VALID;
    ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_nonnegative_price;
  END IF;
END;
$$;

ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_pro_no_overlap;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_resource_no_overlap;

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_pro_no_overlap
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(occupied_starts_at, occupied_ends_at, '[)') WITH &&
  )
  WHERE (status NOT IN ('canceled', 'no_show') AND NOT is_overbooked);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_resource_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(occupied_starts_at, occupied_ends_at, '[)') WITH &&
  )
  WHERE (
    resource_id IS NOT NULL
    AND status NOT IN ('canceled', 'no_show')
    AND NOT is_overbooked
  );

CREATE OR REPLACE FUNCTION public.check_appointment_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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
    RAISE EXCEPTION 'O profissional já possui um agendamento neste horário, incluindo os intervalos de preparação.'
      USING ERRCODE = '23P01';
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
      RAISE EXCEPTION 'O recurso já está reservado neste horário, incluindo os intervalos de preparação.'
        USING ERRCODE = '23P01';
    END IF;
  END IF;

  SELECT coalesce(timezone, 'America/Sao_Paulo')
  INTO v_tenant_timezone
  FROM public.tenants
  WHERE id = NEW.tenant_id;

  v_local_start := NEW.starts_at AT TIME ZONE v_tenant_timezone;
  v_local_end := NEW.ends_at AT TIME ZONE v_tenant_timezone;
  v_weekday := extract(dow FROM v_local_start)::smallint;

  IF NOT EXISTS (
    SELECT 1
    FROM public.unit_business_hours h
    WHERE h.tenant_id = NEW.tenant_id
      AND h.unit_id = NEW.unit_id
      AND h.weekday = v_weekday
      AND NOT h.is_closed
      AND v_local_start::date = v_local_end::date
      AND v_local_start::time >= h.opens_at
      AND v_local_end::time <= h.closes_at
  ) THEN
    RAISE EXCEPTION 'O agendamento está fora do horário de funcionamento da unidade.'
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.check_appointment_conflicts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_appointment_conflicts() TO service_role;

CREATE OR REPLACE FUNCTION public.get_available_slots(
  _tenant_id uuid,
  _professional_id uuid,
  _unit_id uuid,
  _service_id uuid,
  _day date,
  _slot_step_minutes integer DEFAULT 15
)
RETURNS TABLE (slot_start timestamptz, slot_end timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH context AS (
  SELECT
    s.duration_minutes,
    coalesce(s.buffer_before_minutes, 0) AS buffer_before_minutes,
    coalesce(s.buffer_after_minutes, 0) AS buffer_after_minutes,
    coalesce(s.processing_minutes, 0) AS processing_minutes,
    coalesce(t.timezone, 'America/Sao_Paulo') AS tenant_timezone,
    h.opens_at,
    h.closes_at
  FROM public.services s
  JOIN public.tenants t ON t.id = s.tenant_id
  JOIN public.units u
    ON u.id = _unit_id
   AND u.tenant_id = s.tenant_id
   AND u.is_active
  JOIN public.professionals p
    ON p.id = _professional_id
   AND p.tenant_id = s.tenant_id
   AND p.is_active
   AND (p.unit_id IS NULL OR p.unit_id = _unit_id)
  JOIN public.unit_business_hours h
    ON h.tenant_id = s.tenant_id
   AND h.unit_id = _unit_id
   AND h.weekday = extract(dow FROM _day)::smallint
   AND NOT h.is_closed
  WHERE s.id = _service_id
    AND s.tenant_id = _tenant_id
    AND s.is_active
), professional_windows AS (
  SELECT
    greatest(c.opens_at, pa.starts_at) AS starts_at,
    least(c.closes_at, pa.ends_at) AS ends_at,
    c.*
  FROM context c
  JOIN public.professional_availability pa
    ON pa.tenant_id = _tenant_id
   AND pa.professional_id = _professional_id
   AND pa.weekday = extract(dow FROM _day)::smallint
   AND pa.is_active
   AND (pa.unit_id IS NULL OR pa.unit_id = _unit_id)
), windows AS (
  SELECT
    pw.starts_at,
    pw.ends_at,
    pw.duration_minutes,
    pw.buffer_before_minutes,
    pw.buffer_after_minutes,
    pw.processing_minutes,
    pw.tenant_timezone
  FROM professional_windows pw
  WHERE pw.starts_at < pw.ends_at
  UNION ALL
  SELECT
    c.opens_at,
    c.closes_at,
    c.duration_minutes,
    c.buffer_before_minutes,
    c.buffer_after_minutes,
    c.processing_minutes,
    c.tenant_timezone
  FROM context c
  WHERE NOT EXISTS (SELECT 1 FROM professional_windows)
), candidates AS (
  SELECT
    gs AS service_start,
    gs + make_interval(mins => w.duration_minutes) AS service_end,
    gs - make_interval(mins => w.buffer_before_minutes) AS occupied_start,
    gs + make_interval(mins => w.duration_minutes + w.processing_minutes + w.buffer_after_minutes) AS occupied_end,
    w.tenant_timezone
  FROM windows w
  CROSS JOIN LATERAL generate_series(
    ((_day + w.starts_at)::timestamp AT TIME ZONE w.tenant_timezone)
      + make_interval(mins => w.buffer_before_minutes),
    ((_day + w.ends_at)::timestamp AT TIME ZONE w.tenant_timezone)
      - make_interval(mins => w.duration_minutes + w.processing_minutes + w.buffer_after_minutes),
    make_interval(mins => greatest(1, least(coalesce(_slot_step_minutes, 15), 1440)))
  ) gs
)
SELECT c.service_start, c.service_end
FROM candidates c
WHERE c.service_start >= now()
  AND NOT EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.tenant_id = _tenant_id
      AND a.professional_id = _professional_id
      AND a.status NOT IN ('canceled', 'no_show')
      AND NOT a.is_overbooked
      AND tstzrange(a.occupied_starts_at, a.occupied_ends_at, '[)')
          && tstzrange(c.occupied_start, c.occupied_end, '[)')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.time_off_blocks b
    WHERE b.tenant_id = _tenant_id
      AND (
        (b.scope = 'professional' AND b.professional_id = _professional_id)
        OR (b.scope = 'unit' AND b.unit_id = _unit_id)
      )
      AND tstzrange(b.starts_at, b.ends_at, '[)')
          && tstzrange(c.occupied_start, c.occupied_end, '[)')
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.recurring_blocks r
    WHERE r.tenant_id = _tenant_id
      AND r.is_active
      AND r.weekday = extract(dow FROM _day)::smallint
      AND (r.professional_id IS NULL OR r.professional_id = _professional_id)
      AND (r.unit_id IS NULL OR r.unit_id = _unit_id)
      AND c.occupied_start < ((_day + r.ends_at)::timestamp AT TIME ZONE c.tenant_timezone)
      AND c.occupied_end > ((_day + r.starts_at)::timestamp AT TIME ZONE c.tenant_timezone)
  )
ORDER BY c.service_start;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots(uuid, uuid, uuid, uuid, date, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, uuid, uuid, date, integer)
TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_appointment_atomic(
  _tenant_id uuid,
  _unit_id uuid,
  _client_id uuid,
  _professional_id uuid,
  _service_id uuid,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _duration_minutes integer,
  _buffer_before_minutes integer DEFAULT 0,
  _buffer_after_minutes integer DEFAULT 0,
  _resource_id uuid DEFAULT NULL,
  _cancellation_policy_id uuid DEFAULT NULL,
  _source public.appointment_source DEFAULT 'frontdesk',
  _status public.appointment_status DEFAULT 'pending',
  _notes text DEFAULT NULL,
  _internal_notes text DEFAULT NULL,
  _total_price_cents integer DEFAULT 0,
  _is_walk_in boolean DEFAULT false,
  _is_overbooked boolean DEFAULT false,
  _created_by uuid DEFAULT NULL,
  _item_price_cents integer DEFAULT 0
)
RETURNS SETOF public.appointments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment public.appointments%ROWTYPE;
  v_service public.services%ROWTYPE;
  v_is_team boolean;
  v_is_client boolean;
  v_available boolean;
  v_tenant_timezone text;
BEGIN
  v_is_team := public.has_any_tenant_role(
    auth.uid(),
    _tenant_id,
    ARRAY['owner', 'manager', 'frontdesk', 'professional']::public.app_role[]
  ) OR public.is_super_admin(auth.uid());
  v_is_client := public.is_portal_client_of(_client_id, auth.uid());

  IF NOT v_is_team AND NOT (v_is_client AND _source = 'client_portal') THEN
    RAISE EXCEPTION 'Você não tem permissão para criar este agendamento.' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_service
  FROM public.services
  WHERE id = _service_id
    AND tenant_id = _tenant_id
    AND is_active;

  IF NOT FOUND
     OR NOT EXISTS (
       SELECT 1 FROM public.units
       WHERE id = _unit_id AND tenant_id = _tenant_id AND is_active
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.clients
       WHERE id = _client_id AND tenant_id = _tenant_id
     )
     OR NOT EXISTS (
       SELECT 1 FROM public.professionals
       WHERE id = _professional_id
         AND tenant_id = _tenant_id
         AND is_active
         AND (unit_id IS NULL OR unit_id = _unit_id)
     )
     OR (
       _resource_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.resources
         WHERE id = _resource_id AND tenant_id = _tenant_id AND is_active
       )
     ) THEN
    RAISE EXCEPTION 'Dados do agendamento não pertencem ao estabelecimento ou estão inativos.'
      USING ERRCODE = '23503';
  END IF;

  IF _duration_minutes <= 0
     OR _ends_at <> _starts_at + make_interval(mins => _duration_minutes) THEN
    RAISE EXCEPTION 'Duração do agendamento inválida.' USING ERRCODE = '22023';
  END IF;

  IF _buffer_before_minutes < 0
     OR _buffer_after_minutes < 0
     OR _total_price_cents < 0 THEN
    RAISE EXCEPTION 'Valores do agendamento inválidos.' USING ERRCODE = '22023';
  END IF;

  IF _is_overbooked AND NOT v_is_team THEN
    RAISE EXCEPTION 'Encaixe manual não permitido para este acesso.' USING ERRCODE = '42501';
  END IF;

  IF _source = 'client_portal' AND NOT v_is_team THEN
    IF NOT v_service.is_public
       OR _status <> 'pending'
       OR _is_overbooked
       OR _is_walk_in THEN
      RAISE EXCEPTION 'Parâmetros de autoagendamento inválidos.' USING ERRCODE = '22023';
    END IF;

    IF _duration_minutes <> v_service.duration_minutes
       OR _buffer_before_minutes <> coalesce(v_service.buffer_before_minutes, 0)
       OR _buffer_after_minutes <> coalesce(v_service.buffer_after_minutes, 0) THEN
      RAISE EXCEPTION 'Duração do serviço inválida.' USING ERRCODE = '22023';
    END IF;

    IF _starts_at < now() + make_interval(hours => coalesce(v_service.min_advance_hours, 0)) THEN
      RAISE EXCEPTION 'Este serviço exige mais antecedência.';
    END IF;

    IF _starts_at > now() + make_interval(days => coalesce(v_service.max_advance_days, 60)) THEN
      RAISE EXCEPTION 'Data muito distante para agendamento online.';
    END IF;

    SELECT coalesce(timezone, 'America/Sao_Paulo')
    INTO v_tenant_timezone
    FROM public.tenants
    WHERE id = _tenant_id;

    SELECT EXISTS (
      SELECT 1
      FROM public.get_available_slots(
        _tenant_id,
        _professional_id,
        _unit_id,
        _service_id,
        (_starts_at AT TIME ZONE v_tenant_timezone)::date
      ) s
      WHERE abs(extract(epoch FROM (s.slot_start - _starts_at))) < 60
    ) INTO v_available;

    IF NOT v_available THEN
      RAISE EXCEPTION 'Esse horário acabou de ficar indisponível. Escolha outro.';
    END IF;
  END IF;

  INSERT INTO public.appointments (
    tenant_id,
    unit_id,
    client_id,
    professional_id,
    resource_id,
    cancellation_policy_id,
    status,
    source,
    starts_at,
    ends_at,
    duration_minutes,
    buffer_before_minutes,
    buffer_after_minutes,
    is_walk_in,
    is_overbooked,
    total_price_cents,
    notes,
    internal_notes,
    created_by
  ) VALUES (
    _tenant_id,
    _unit_id,
    _client_id,
    _professional_id,
    _resource_id,
    _cancellation_policy_id,
    _status,
    _source,
    _starts_at,
    _ends_at,
    _duration_minutes,
    _buffer_before_minutes,
    _buffer_after_minutes,
    _is_walk_in,
    _is_overbooked,
    _total_price_cents,
    nullif(btrim(_notes), ''),
    nullif(btrim(_internal_notes), ''),
    coalesce(_created_by, auth.uid())
  )
  RETURNING * INTO v_appointment;

  INSERT INTO public.appointment_items (
    tenant_id,
    appointment_id,
    service_id,
    duration_minutes,
    price_cents,
    position
  ) VALUES (
    _tenant_id,
    v_appointment.id,
    _service_id,
    _duration_minutes,
    coalesce(_item_price_cents, _total_price_cents),
    0
  );

  RETURN NEXT v_appointment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_appointment_atomic(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid,uuid,public.appointment_source,public.appointment_status,text,text,integer,boolean,boolean,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_appointment_atomic(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid,uuid,public.appointment_source,public.appointment_status,text,text,integer,boolean,boolean,uuid,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.validate_appointment_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (
    CASE OLD.status
      WHEN 'requested' THEN NEW.status IN ('pending', 'confirmed', 'canceled')
      WHEN 'pending' THEN NEW.status IN ('confirmed', 'reminded', 'arrived', 'canceled', 'no_show')
      WHEN 'confirmed' THEN NEW.status IN ('reminded', 'arrived', 'canceled', 'no_show')
      WHEN 'reminded' THEN NEW.status IN ('arrived', 'confirmed', 'canceled', 'no_show')
      WHEN 'arrived' THEN NEW.status IN ('in_service', 'canceled')
      WHEN 'in_service' THEN NEW.status = 'completed'
      ELSE false
    END
  ) THEN
    RAISE EXCEPTION 'Transição de status inválida: % para %.', OLD.status, NEW.status
      USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_validate_status_transition ON public.appointments;
CREATE TRIGGER appointments_validate_status_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.validate_appointment_status_transition();

REVOKE ALL ON FUNCTION public.validate_appointment_status_transition() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_appointment_status_transition() TO service_role;
