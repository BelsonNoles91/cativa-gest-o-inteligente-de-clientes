CREATE OR REPLACE FUNCTION public.create_public_appointment(_slug text, _unit_id uuid, _service_id uuid, _professional_id uuid, _starts_at timestamp with time zone, _full_name text DEFAULT NULL::text, _phone text DEFAULT NULL::text, _notes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_uid       uuid := auth.uid();
  v_email     text;
  v_tenant    uuid;
  v_svc       public.services%rowtype;
  v_client    uuid;
  v_appt      uuid;
  v_total     integer;
  v_ends      timestamptz;
  v_ok        boolean;
  v_name      text := regexp_replace(trim(coalesce(_full_name, '')), '\s+', ' ', 'g');
  v_phone     text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
begin
  if v_uid is null then
    raise exception 'Faca login para concluir o agendamento.' using errcode = '42501';
  end if;

  if length(v_phone) > 11 and left(v_phone, 2) = '55' then v_phone := substr(v_phone, 3); end if;
  if v_name = '' or array_length(regexp_split_to_array(v_name, ' '), 1) < 2 then
    raise exception 'Informe nome e sobrenome para concluir.' using errcode = '22023';
  end if;
  if v_phone !~ '^[1-9][1-9]9[0-9]{8}$' then
    raise exception 'Informe um WhatsApp valido com DDD.' using errcode = '22023';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'Conta sem e-mail verificado.' using errcode = '42501';
  end if;

  select t.id into v_tenant
  from public.tenants t
  join public.tenant_public_pages p on p.tenant_id = t.id
  where t.slug = _slug and p.is_published = true and t.status in ('active','trialing');
  if v_tenant is null then
    raise exception 'Estabelecimento indisponivel.';
  end if;

  if not exists (
    select 1 from public.units u
    where u.id = _unit_id and u.tenant_id = v_tenant and u.is_active and u.is_public
  ) then raise exception 'Unidade indisponivel.'; end if;

  select * into v_svc from public.services
  where id = _service_id and tenant_id = v_tenant and is_active and is_public;
  if not found then raise exception 'Servico indisponivel.'; end if;

  if not exists (
    select 1 from public.professionals pr
    where pr.id = _professional_id and pr.tenant_id = v_tenant and pr.is_active
  ) then raise exception 'Profissional indisponivel.'; end if;

  if _starts_at < now() + make_interval(hours => coalesce(v_svc.min_advance_hours, 0)) then
    raise exception 'Este servico exige mais antecedencia.';
  end if;
  if _starts_at > now() + make_interval(days => coalesce(v_svc.max_advance_days, 60)) then
    raise exception 'Data muito distante para agendamento online.';
  end if;

  select exists (
    select 1 from public.get_available_slots(
      v_tenant, _professional_id, _unit_id, _service_id, (_starts_at at time zone 'UTC')::date
    ) g
    where abs(extract(epoch from (g.slot_start - _starts_at))) < 60
  ) into v_ok;
  if not v_ok then
    select exists (
      select 1 from public.get_available_slots(
        v_tenant, _professional_id, _unit_id, _service_id, ((_starts_at at time zone 'UTC') - interval '1 day')::date
      ) g
      where abs(extract(epoch from (g.slot_start - _starts_at))) < 60
    ) into v_ok;
  end if;
  if not v_ok then
    raise exception 'Esse horario acabou de ficar indisponivel. Escolha outro.';
  end if;

  select c.id into v_client
  from public.client_users cu
  join public.clients c on c.id = cu.client_id
  where cu.user_id = v_uid and cu.tenant_id = v_tenant and cu.status = 'active'
  limit 1;

  if v_client is null then
    select id into v_client from public.clients
    where tenant_id = v_tenant and lower(email) = lower(v_email)
    limit 1;
  end if;

  if v_client is null then
    insert into public.clients (tenant_id, full_name, email, whatsapp_phone, origin, preferred_unit_id)
    values (v_tenant, v_name, v_email, v_phone, 'public_link', _unit_id)
    returning id into v_client;
  end if;

  update public.clients
     set full_name = v_name,
         whatsapp_phone = v_phone,
         phone = coalesce(nullif(phone, ''), v_phone),
         updated_at = now()
   where id = v_client;

  insert into public.client_users (tenant_id, client_id, user_id, status)
  values (v_tenant, v_client, v_uid, 'active')
  on conflict do nothing;

  select coalesce((
    select sp.amount_cents from public.service_prices sp
    where sp.service_id = _service_id and sp.is_default = true limit 1
  ), 0)::integer into v_total;

  v_ends := _starts_at + make_interval(mins => v_svc.duration_minutes);

  insert into public.appointments (
    tenant_id, unit_id, client_id, professional_id, cancellation_policy_id,
    status, source, starts_at, ends_at, duration_minutes,
    buffer_before_minutes, buffer_after_minutes, total_price_cents, notes, created_by
  ) values (
    v_tenant, _unit_id, v_client, _professional_id, v_svc.cancellation_policy_id,
    'pending', 'client_portal', _starts_at, v_ends, v_svc.duration_minutes,
    coalesce(v_svc.buffer_before_minutes, 0), coalesce(v_svc.buffer_after_minutes, 0),
    v_total, nullif(trim(_notes), ''), v_uid
  ) returning id into v_appt;

  insert into public.appointment_items (tenant_id, appointment_id, service_id, duration_minutes, price_cents, position)
  values (v_tenant, v_appt, _service_id, v_svc.duration_minutes, v_total, 0);

  insert into public.audit_logs (tenant_id, actor_id, user_id, action, entity, entity_id, metadata)
  values (v_tenant, v_uid, v_uid, 'appointment.create', 'appointments', v_appt,
          jsonb_build_object('origin', 'public_link', 'slug', _slug, 'service_id', _service_id));

  return v_appt;
end;
$function$;