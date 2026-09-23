ALTER TABLE public.appointments ADD COLUMN occupied_starts_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN occupied_ends_at timestamptz;
COMMENT ON COLUMN public.appointments.occupied_starts_at IS 'Intervalo efetivamente ocupado, incluindo buffer anterior; mantido por trigger.';
COMMENT ON COLUMN public.appointments.occupied_ends_at IS 'Intervalo efetivamente ocupado, incluindo buffer posterior; mantido por trigger.';

CREATE OR REPLACE FUNCTION public.sync_appointment_occupied_range() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 NEW.occupied_starts_at:=NEW.starts_at-make_interval(mins=>greatest(NEW.buffer_before_minutes,0));
 NEW.occupied_ends_at:=NEW.ends_at+make_interval(mins=>greatest(NEW.buffer_after_minutes,0));
 RETURN NEW;
END;
$$;
CREATE TRIGGER appointments_sync_occupied_range BEFORE INSERT OR UPDATE OF starts_at,ends_at,buffer_before_minutes,buffer_after_minutes ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_occupied_range();
REVOKE ALL ON FUNCTION public.sync_appointment_occupied_range() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_appointment_occupied_range() TO service_role;

UPDATE public.appointments SET occupied_starts_at=starts_at-make_interval(mins=>buffer_before_minutes), occupied_ends_at=ends_at+make_interval(mins=>buffer_after_minutes);

ALTER TABLE public.appointments DROP CONSTRAINT appointments_pro_no_overlap;
ALTER TABLE public.appointments DROP CONSTRAINT appointments_resource_no_overlap;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_pro_no_overlap
EXCLUDE USING gist (professional_id WITH =, tstzrange(occupied_starts_at,occupied_ends_at,'[)') WITH &&)
WHERE (status NOT IN ('canceled','no_show') AND NOT is_overbooked);
ALTER TABLE public.appointments ADD CONSTRAINT appointments_resource_no_overlap
EXCLUDE USING gist (resource_id WITH =, tstzrange(occupied_starts_at,occupied_ends_at,'[)') WITH &&)
WHERE (resource_id IS NOT NULL AND status NOT IN ('canceled','no_show') AND NOT is_overbooked);

CREATE OR REPLACE FUNCTION public.portal_reschedule_appointment(_appointment_id uuid,_starts_at timestamptz,_ends_at timestamptz,_professional_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a public.appointments%ROWTYPE; st jsonb; hours_left numeric; v_service_id uuid; v_duration integer; v_end timestamptz; v_professional uuid; v_available boolean;
BEGIN
 SELECT * INTO a FROM public.appointments WHERE id=_appointment_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.client_users cu WHERE cu.user_id=auth.uid() AND cu.tenant_id=a.tenant_id AND cu.client_id=a.client_id AND cu.status='active') THEN RAISE EXCEPTION 'Você não tem acesso a este agendamento.'; END IF;
 IF a.status IN ('canceled','completed','no_show') THEN RAISE EXCEPTION 'Este horário não pode mais ser alterado.'; END IF;
 st:=public.client_self_service_status(a.tenant_id,a.client_id);
 IF NOT (st->>'allowReschedule')::boolean THEN RAISE EXCEPTION 'O reagendamento pelo portal está desativado. Fale com o estabelecimento.'; END IF;
 IF (st->>'blocked')::boolean THEN RAISE EXCEPTION 'Seu autoatendimento está temporariamente suspenso. Fale com o estabelecimento.'; END IF;
 hours_left:=extract(epoch FROM (a.starts_at-now()))/3600;
 IF hours_left<(st->>'minHoursToReschedule')::numeric THEN RAISE EXCEPTION 'Alterações pelo portal só até % h antes do horário. Fale com o estabelecimento.',(st->>'minHoursToReschedule'); END IF;
 IF (st->>'maxReschedulesPerAppointment')::int>0 AND coalesce(a.client_reschedule_count,0)>=(st->>'maxReschedulesPerAppointment')::int THEN RAISE EXCEPTION 'Você já alterou este horário o número máximo de vezes permitido.'; END IF;
 IF _starts_at<=now() THEN RAISE EXCEPTION 'Escolha um horário futuro.'; END IF;
 SELECT ai.service_id,ai.duration_minutes INTO v_service_id,v_duration FROM public.appointment_items ai WHERE ai.appointment_id=a.id ORDER BY ai.position LIMIT 1;
 IF v_service_id IS NULL THEN RAISE EXCEPTION 'Serviço do agendamento não encontrado.'; END IF;
 v_professional:=coalesce(_professional_id,a.professional_id);
 IF NOT EXISTS(SELECT 1 FROM public.professionals p WHERE p.id=v_professional AND p.tenant_id=a.tenant_id AND p.is_active AND (p.unit_id IS NULL OR p.unit_id=a.unit_id)) THEN RAISE EXCEPTION 'Profissional indisponível.'; END IF;
 v_end:=_starts_at+make_interval(mins=>v_duration);
 SELECT exists(SELECT 1 FROM public.get_available_slots(a.tenant_id,v_professional,a.unit_id,v_service_id,(_starts_at AT TIME ZONE coalesce((SELECT timezone FROM public.tenants WHERE id=a.tenant_id),'America/Sao_Paulo'))::date) s WHERE abs(extract(epoch FROM (s.slot_start-_starts_at)))<60) INTO v_available;
 IF NOT v_available THEN RAISE EXCEPTION 'Esse horário acabou de ficar indisponível. Escolha outro.'; END IF;
 UPDATE public.appointments SET starts_at=_starts_at,ends_at=v_end,professional_id=v_professional,status='pending',client_reschedule_count=coalesce(client_reschedule_count,0)+1,updated_at=now() WHERE id=a.id;
 RETURN jsonb_build_object('ok',true,'startsAt',_starts_at,'endsAt',v_end);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_reschedule_appointment(uuid,timestamptz,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_reschedule_appointment(uuid,timestamptz,timestamptz,uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.validate_appointment_status_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 IF NEW.status='pending' AND NEW.starts_at IS DISTINCT FROM OLD.starts_at AND OLD.status IN ('requested','pending','confirmed','reminded','arrived') THEN RETURN NEW; END IF;
 IF NOT (CASE OLD.status WHEN 'requested' THEN NEW.status IN ('pending','confirmed','canceled') WHEN 'pending' THEN NEW.status IN ('confirmed','reminded','arrived','canceled','no_show') WHEN 'confirmed' THEN NEW.status IN ('reminded','arrived','canceled','no_show') WHEN 'reminded' THEN NEW.status IN ('arrived','confirmed','canceled','no_show') WHEN 'arrived' THEN NEW.status IN ('in_service','canceled') WHEN 'in_service' THEN NEW.status='completed' ELSE false END) THEN RAISE EXCEPTION 'Transição de status inválida: % para %.',OLD.status,NEW.status USING errcode='22023'; END IF;
 RETURN NEW;
END;
$$;