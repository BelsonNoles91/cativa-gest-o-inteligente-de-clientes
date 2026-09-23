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
DECLARE v_appointment public.appointments%ROWTYPE; v_is_team boolean; v_is_client boolean;
BEGIN
 v_is_team:=public.has_any_tenant_role(auth.uid(),_tenant_id,ARRAY['owner','manager','frontdesk','professional']::public.app_role[]) OR public.is_super_admin(auth.uid());
 v_is_client:=public.is_portal_client_of(auth.uid(),_client_id);
 IF NOT v_is_team AND NOT (v_is_client AND _source='client_portal') THEN RAISE EXCEPTION 'Você não tem permissão para criar este agendamento.' USING errcode='42501'; END IF;
 IF _duration_minutes<=0 OR _ends_at<>_starts_at+make_interval(mins=>_duration_minutes) THEN RAISE EXCEPTION 'Duração do agendamento inválida.' USING errcode='22023'; END IF;
 IF _buffer_before_minutes<0 OR _buffer_after_minutes<0 OR _total_price_cents<0 THEN RAISE EXCEPTION 'Valores do agendamento inválidos.' USING errcode='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.units WHERE id=_unit_id AND tenant_id=_tenant_id AND is_active)
 OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=_client_id AND tenant_id=_tenant_id)
 OR NOT EXISTS(SELECT 1 FROM public.professionals WHERE id=_professional_id AND tenant_id=_tenant_id AND is_active)
 OR NOT EXISTS(SELECT 1 FROM public.services WHERE id=_service_id AND tenant_id=_tenant_id AND is_active)
 OR (_resource_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.resources WHERE id=_resource_id AND tenant_id=_tenant_id AND is_active))
 THEN RAISE EXCEPTION 'Dados do agendamento não pertencem ao estabelecimento ou estão inativos.' USING errcode='23503'; END IF;
 IF _is_overbooked AND NOT v_is_team THEN RAISE EXCEPTION 'Encaixe manual não permitido para este acesso.' USING errcode='42501'; END IF;
 INSERT INTO public.appointments(tenant_id,unit_id,client_id,professional_id,resource_id,cancellation_policy_id,status,source,starts_at,ends_at,duration_minutes,buffer_before_minutes,buffer_after_minutes,is_walk_in,is_overbooked,total_price_cents,notes,internal_notes,created_by)
 VALUES(_tenant_id,_unit_id,_client_id,_professional_id,_resource_id,_cancellation_policy_id,_status,_source,_starts_at,_ends_at,_duration_minutes,_buffer_before_minutes,_buffer_after_minutes,_is_walk_in,_is_overbooked,_total_price_cents,nullif(btrim(_notes),''),nullif(btrim(_internal_notes),''),coalesce(_created_by,auth.uid())) RETURNING * INTO v_appointment;
 INSERT INTO public.appointment_items(tenant_id,appointment_id,service_id,duration_minutes,price_cents,position)
 VALUES(_tenant_id,v_appointment.id,_service_id,_duration_minutes,coalesce(_item_price_cents,_total_price_cents),0);
 RETURN NEXT v_appointment;
END;
$$;
REVOKE ALL ON FUNCTION public.create_appointment_atomic(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid,uuid,public.appointment_source,public.appointment_status,text,text,integer,boolean,boolean,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_appointment_atomic(uuid,uuid,uuid,uuid,uuid,timestamptz,timestamptz,integer,integer,integer,uuid,uuid,public.appointment_source,public.appointment_status,text,text,integer,boolean,boolean,uuid,integer) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.validate_appointment_status_transition() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 IF NOT (CASE OLD.status
  WHEN 'requested' THEN NEW.status IN ('pending','confirmed','canceled')
  WHEN 'pending' THEN NEW.status IN ('confirmed','reminded','arrived','canceled','no_show')
  WHEN 'confirmed' THEN NEW.status IN ('reminded','arrived','canceled','no_show')
  WHEN 'reminded' THEN NEW.status IN ('arrived','confirmed','canceled','no_show')
  WHEN 'arrived' THEN NEW.status IN ('in_service','canceled')
  WHEN 'in_service' THEN NEW.status='completed'
  ELSE false END)
 THEN RAISE EXCEPTION 'Transição de status inválida: % para %.',OLD.status,NEW.status USING errcode='22023'; END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS appointments_validate_status_transition ON public.appointments;
CREATE TRIGGER appointments_validate_status_transition BEFORE UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.validate_appointment_status_transition();
REVOKE ALL ON FUNCTION public.validate_appointment_status_transition() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_appointment_status_transition() TO service_role;