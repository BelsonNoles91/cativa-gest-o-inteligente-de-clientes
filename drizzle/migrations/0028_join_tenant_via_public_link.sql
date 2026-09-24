CREATE OR REPLACE FUNCTION public.join_tenant_via_public_link(_slug text, _full_name text, _phone text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
declare
  v_uid    uuid := auth.uid();
  v_email  text;
  v_tenant uuid;
  v_client uuid;
  v_name   text := regexp_replace(trim(coalesce(_full_name, '')), '\s+', ' ', 'g');
  v_phone  text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
begin
  if v_uid is null then
    raise exception 'Faca login para continuar.' using errcode = '42501';
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

  select cu.client_id into v_client from public.client_users cu
  where cu.user_id = v_uid and cu.tenant_id = v_tenant limit 1;

  if v_client is null then
    select id into v_client from public.clients
    where tenant_id = v_tenant and lower(email) = lower(v_email) limit 1;
  end if;

  if v_client is null then
    insert into public.clients (tenant_id, full_name, email, whatsapp_phone, phone, origin)
    values (v_tenant, v_name, v_email, v_phone, v_phone, 'public_link')
    returning id into v_client;
  else
    update public.clients
       set full_name = v_name, whatsapp_phone = v_phone,
           phone = coalesce(nullif(phone, ''), v_phone), updated_at = now()
     where id = v_client;
  end if;

  insert into public.client_users (tenant_id, client_id, user_id, status, booking_origin)
  values (v_tenant, v_client, v_uid, 'active', 'public_link')
  on conflict (tenant_id, user_id) do update
    set status = 'active', booking_origin = 'public_link', updated_at = now();

  return v_client;
end;
$$;
REVOKE EXECUTE ON FUNCTION public.join_tenant_via_public_link(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_tenant_via_public_link(text, text, text) TO authenticated, service_role;