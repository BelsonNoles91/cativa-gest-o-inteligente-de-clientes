ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_positive_duration CHECK (duration_minutes > 0) NOT VALID,
  ADD CONSTRAINT appointments_nonnegative_buffers CHECK (buffer_before_minutes >= 0 AND buffer_after_minutes >= 0) NOT VALID,
  ADD CONSTRAINT appointments_nonnegative_price CHECK (total_price_cents >= 0) NOT VALID;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_positive_duration;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_nonnegative_buffers;
ALTER TABLE public.appointments VALIDATE CONSTRAINT appointments_nonnegative_price;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_pro_no_overlap;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_pro_no_overlap
EXCLUDE USING gist (professional_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
WHERE (status NOT IN ('canceled', 'no_show') AND NOT is_overbooked);
ALTER TABLE public.appointments ADD CONSTRAINT appointments_resource_no_overlap
EXCLUDE USING gist (resource_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
WHERE (resource_id IS NOT NULL AND status NOT IN ('canceled', 'no_show') AND NOT is_overbooked);

CREATE OR REPLACE FUNCTION public.get_available_slots(_tenant_id uuid, _professional_id uuid, _unit_id uuid, _service_id uuid, _day date, _slot_step_minutes integer DEFAULT 15)
RETURNS TABLE (slot_start timestamptz, slot_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH context AS (
 SELECT s.duration_minutes, coalesce(s.buffer_before_minutes,0) buffer_before_minutes,
        coalesce(s.buffer_after_minutes,0) buffer_after_minutes, coalesce(s.processing_minutes,0) processing_minutes,
        coalesce(t.timezone,'America/Sao_Paulo') tenant_timezone, h.opens_at, h.closes_at
 FROM public.services s JOIN public.tenants t ON t.id=s.tenant_id
 JOIN public.units u ON u.id=_unit_id AND u.tenant_id=s.tenant_id AND u.is_active
 JOIN public.professionals p ON p.id=_professional_id AND p.tenant_id=s.tenant_id AND p.is_active AND (p.unit_id IS NULL OR p.unit_id=_unit_id)
 JOIN public.unit_business_hours h ON h.tenant_id=s.tenant_id AND h.unit_id=_unit_id AND h.weekday=extract(dow FROM _day)::smallint AND NOT h.is_closed
 WHERE s.id=_service_id AND s.tenant_id=_tenant_id AND s.is_active
), professional_windows AS (
 SELECT greatest(c.opens_at,pa.starts_at) starts_at, least(c.closes_at,pa.ends_at) ends_at, c.*
 FROM context c JOIN public.professional_availability pa ON pa.tenant_id=_tenant_id AND pa.professional_id=_professional_id
  AND pa.weekday=extract(dow FROM _day)::smallint AND pa.is_active AND (pa.unit_id IS NULL OR pa.unit_id=_unit_id)
), windows AS (
 SELECT pw.starts_at,pw.ends_at,pw.duration_minutes,pw.buffer_before_minutes,pw.buffer_after_minutes,pw.processing_minutes,pw.tenant_timezone
 FROM professional_windows pw WHERE pw.starts_at<pw.ends_at
 UNION ALL SELECT c.opens_at,c.closes_at,c.duration_minutes,c.buffer_before_minutes,c.buffer_after_minutes,c.processing_minutes,c.tenant_timezone
 FROM context c WHERE NOT EXISTS (SELECT 1 FROM professional_windows)
), candidates AS (
 SELECT gs service_start, gs+make_interval(mins=>w.duration_minutes) service_end,
        gs-make_interval(mins=>w.buffer_before_minutes) occupied_start,
        gs+make_interval(mins=>w.duration_minutes+w.processing_minutes+w.buffer_after_minutes) occupied_end,
        w.tenant_timezone
 FROM windows w CROSS JOIN LATERAL generate_series(
   ((_day+w.starts_at)::timestamp AT TIME ZONE w.tenant_timezone)+make_interval(mins=>w.buffer_before_minutes),
   ((_day+w.ends_at)::timestamp AT TIME ZONE w.tenant_timezone)-make_interval(mins=>w.duration_minutes+w.processing_minutes+w.buffer_after_minutes),
   make_interval(mins=>greatest(1,least(coalesce(_slot_step_minutes,15),1440)))) gs
)
SELECT c.service_start,c.service_end FROM candidates c
WHERE c.service_start>=now()
AND NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.tenant_id=_tenant_id AND a.professional_id=_professional_id
 AND a.status NOT IN ('canceled','no_show') AND NOT a.is_overbooked
 AND tstzrange(a.starts_at-make_interval(mins=>a.buffer_before_minutes),a.ends_at+make_interval(mins=>a.buffer_after_minutes),'[)') && tstzrange(c.occupied_start,c.occupied_end,'[)'))
AND NOT EXISTS (SELECT 1 FROM public.time_off_blocks b WHERE b.tenant_id=_tenant_id
 AND ((b.scope='professional' AND b.professional_id=_professional_id) OR (b.scope='unit' AND b.unit_id=_unit_id))
 AND tstzrange(b.starts_at,b.ends_at,'[)') && tstzrange(c.occupied_start,c.occupied_end,'[)'))
AND NOT EXISTS (SELECT 1 FROM public.recurring_blocks r WHERE r.tenant_id=_tenant_id AND r.is_active
 AND r.weekday=extract(dow FROM _day)::smallint AND (r.professional_id IS NULL OR r.professional_id=_professional_id)
 AND (r.unit_id IS NULL OR r.unit_id=_unit_id)
 AND c.occupied_start<((_day+r.ends_at)::timestamp AT TIME ZONE c.tenant_timezone)
 AND c.occupied_end>((_day+r.starts_at)::timestamp AT TIME ZONE c.tenant_timezone))
ORDER BY c.service_start
$$;
REVOKE ALL ON FUNCTION public.get_available_slots(uuid,uuid,uuid,uuid,date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid,uuid,uuid,uuid,date,integer) TO anon,authenticated,service_role;