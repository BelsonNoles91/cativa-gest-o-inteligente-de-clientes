REVOKE ALL ON FUNCTION public.create_appointment_atomic(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid,uuid,public.appointment_source,public.appointment_status,text,text,integer,boolean,boolean,uuid,integer) FROM anon;
REVOKE ALL ON FUNCTION public.portal_reschedule_appointment(uuid,timestamptz,timestamptz,uuid) FROM anon;
REVOKE ALL ON FUNCTION public.portal_cancel_appointment(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.create_public_appointment(text,uuid,uuid,uuid,timestamptz,text,text,text) FROM anon;
REVOKE ALL ON FUNCTION public.validate_appointment_status_transition() FROM anon,authenticated;
REVOKE ALL ON FUNCTION public.sync_appointment_occupied_range() FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.create_appointment_atomic(
 _tenant_id uuid, _unit_id uuid, _client_id uuid, _professional_id uuid, _service_id uuid,
 _starts_at timestamptz, _ends_at timestamptz, _duration_minutes integer,
 _buffer_before_minutes integer DEFAULT 0, _buffer_after_minutes integer DEFAULT 0,
 _resource_id uuid DEFAULT NULL, _cancellation_policy_id uuid DEFAULT NULL,
 _source public.appointment_source DEFAULT 'frontdesk', _status public.appointment_status DEFAULT 'pending',
 _notes text DEFAULT NULL, _internal_notes text DEFAULT NULL, _total_price_cents integer DEFAULT 0,
 _is_walk_in boolean DEFAULT false, _is_overbooked boolean DEFAULT false,
 _created_by uuid DEFAULT NULL, _item_price_cents integer DEFAULT 0)
RETURNS SETOF public.appointments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_appointment public.appointments%ROWTYPE; v_service public.services%ROWTYPE; v_is_team boolean; v_is_client boolean; v_available boolean; v_tenant_timezone text;
BEGIN
 v_is_team:=public.has_any_tenant_role(auth.uid(),_tenant_id,ARRAY['owner','manager','frontdesk','professional']::public.app_role[]) OR public.is_super_admin(auth.uid());
 v_is_client:=public.is_portal_client_of(auth.uid(),_client_id);
 IF NOT v_is_team AND NOT (v_is_client AND _source='client_portal') THEN RAISE EXCEPTION 'Você não tem permissão para criar este agendamento.' USING errcode='42501'; END IF;
 SELECT * INTO v_service FROM public.services WHERE id=_service_id AND tenant_id=_tenant_id AND is_active;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM public.units WHERE id=_unit_id AND tenant_id=_tenant_id AND is_active)
 OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=_client_id AND tenant_id=_tenant_id)
 OR NOT EXISTS(SELECT 1 FROM public.professionals WHERE id=_professional_id AND tenant_id=_tenant_id AND is_active AND (unit_id IS NULL OR unit_id=_unit_id))
 OR (_resource_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.resources WHERE id=_resource_id AND tenant_id=_tenant_id AND is_active))
 THEN RAISE EXCEPTION 'Dados do agendamento não pertencem ao estabelecimento ou estão inativos.' USING errcode='23503'; END IF;
 IF _duration_minutes<=0 OR _ends_at<>_starts_at+make_interval(mins=>_duration_minutes) THEN RAISE EXCEPTION 'Duração do agendamento inválida.' USING errcode='22023'; END IF;
 IF _buffer_before_minutes<0 OR _buffer_after_minutes<0 OR _total_price_cents<0 THEN RAISE EXCEPTION 'Valores do agendamento inválidos.' USING errcode='22023'; END IF;
 IF _is_overbooked AND NOT v_is_team THEN RAISE EXCEPTION 'Encaixe manual não permitido para este acesso.' USING errcode='42501'; END IF;
 IF _source='client_portal' THEN
  IF NOT v_service.is_public OR _status<>'pending' OR _is_overbooked OR _is_walk_in THEN RAISE EXCEPTION 'Parâmetros de autoagendamento inválidos.' USING errcode='22023'; END IF;
  IF _duration_minutes<>v_service.duration_minutes OR _buffer_before_minutes<>coalesce(v_service.buffer_before_minutes,0) OR _buffer_after_minutes<>coalesce(v_service.buffer_after_minutes,0) THEN RAISE EXCEPTION 'Duração do serviço inválida.' USING errcode='22023'; END IF;
  IF _starts_at<now()+make_interval(hours=>coalesce(v_service.min_advance_hours,0)) THEN RAISE EXCEPTION 'Este serviço exige mais antecedência.'; END IF;
  IF _starts_at>now()+make_interval(days=>coalesce(v_service.max_advance_days,60)) THEN RAISE EXCEPTION 'Data muito distante para agendamento online.'; END IF;
  SELECT coalesce(timezone,'America/Sao_Paulo') INTO v_tenant_timezone FROM public.tenants WHERE id=_tenant_id;
  SELECT exists(SELECT 1 FROM public.get_available_slots(_tenant_id,_professional_id,_unit_id,_service_id,(_starts_at AT TIME ZONE v_tenant_timezone)::date) s WHERE abs(extract(epoch FROM (s.slot_start-_starts_at)))<60) INTO v_available;
  IF NOT v_available THEN RAISE EXCEPTION 'Esse horário acabou de ficar indisponível. Escolha outro.'; END IF;
 END IF;
 INSERT INTO public.appointments(tenant_id,unit_id,client_id,professional_id,resource_id,cancellation_policy_id,status,source,starts_at,ends_at,duration_minutes,buffer_before_minutes,buffer_after_minutes,is_walk_in,is_overbooked,total_price_cents,notes,internal_notes,created_by)
 VALUES(_tenant_id,_unit_id,_client_id,_professional_id,_resource_id,_cancellation_policy_id,_status,_source,_starts_at,_ends_at,_duration_minutes,_buffer_before_minutes,_buffer_after_minutes,_is_walk_in,_is_overbooked,_total_price_cents,nullif(btrim(_notes),''),nullif(btrim(_internal_notes),''),coalesce(_created_by,auth.uid())) RETURNING * INTO v_appointment;
 INSERT INTO public.appointment_items(tenant_id,appointment_id,service_id,duration_minutes,price_cents,position) VALUES(_tenant_id,v_appointment.id,_service_id,_duration_minutes,coalesce(_item_price_cents,_total_price_cents),0);
 RETURN NEXT v_appointment;
END;
$$;
REVOKE ALL ON FUNCTION public.create_appointment_atomic(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid,uuid,public.appointment_source,public.appointment_status,text,text,integer,boolean,boolean,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_appointment_atomic(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid,uuid,public.appointment_source,public.appointment_status,text,text,integer,boolean,boolean,uuid,integer) TO authenticated,service_role;