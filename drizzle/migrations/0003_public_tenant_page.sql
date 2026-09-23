create table if not exists public.tenant_public_pages (
  tenant_id    uuid primary key references public.tenants(id) on delete cascade,
  is_published boolean not null default false,
  headline     text,
  about        text,
  cover_url    text,
  whatsapp     text,
  instagram    text,
  website      text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

grant select, insert, update, delete on public.tenant_public_pages to authenticated;
grant all on public.tenant_public_pages to service_role;

alter table public.tenant_public_pages enable row level security;

drop policy if exists "public_pages: gestor le" on public.tenant_public_pages;
create policy "public_pages: gestor le"
  on public.tenant_public_pages for select to authenticated
  using (
    public.is_super_admin(auth.uid())
    or public.is_tenant_member(auth.uid(), tenant_id)
  );

drop policy if exists "public_pages: gestor gerencia" on public.tenant_public_pages;
create policy "public_pages: gestor gerencia"
  on public.tenant_public_pages for all to authenticated
  using (
    public.is_super_admin(auth.uid())
    or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  )
  with check (
    public.is_super_admin(auth.uid())
    or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  );

alter table public.units    add column if not exists is_public boolean not null default true;
alter table public.services add column if not exists is_public boolean not null default true;

create or replace function public.get_public_tenant_page(_slug text)
returns table (
  tenant_id uuid, name text, slug text, segment text,
  headline text, about text, cover_url text, logo_url text,
  whatsapp text, instagram text, website text
)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.slug, t.segment::text,
         p.headline, p.about, p.cover_url, s.logo_url,
         p.whatsapp, p.instagram, p.website
  from public.tenants t
  join public.tenant_public_pages p on p.tenant_id = t.id
  left join public.tenant_settings s on s.tenant_id = t.id
  where t.slug = _slug
    and p.is_published = true
    and t.status = 'active'
  limit 1;
$$;

create or replace function public.get_public_units(_slug text)
returns table (
  id uuid, name text, phone text, address text,
  city text, state text, hours jsonb
)
language sql stable security definer set search_path = public as $$
  select u.id, u.name, u.phone,
         nullif(concat_ws(', ', u.address_line1, u.address_line2), '') as address,
         u.city, u.state,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'weekday', h.weekday,
                    'opensAt', h.opens_at,
                    'closesAt', h.closes_at,
                    'isClosed', h.is_closed)
                  order by h.weekday)
           from public.unit_business_hours h
           where h.unit_id = u.id
         ), '[]'::jsonb) as hours
  from public.units u
  join public.tenants t on t.id = u.tenant_id
  join public.tenant_public_pages p on p.tenant_id = t.id
  where t.slug = _slug and p.is_published = true
    and u.is_active = true and u.is_public = true
  order by u.is_default desc, u.name;
$$;

create or replace function public.get_public_services(_slug text)
returns table (
  id uuid, name text, description text, duration_minutes integer,
  price_cents integer, is_featured boolean
)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.description, s.duration_minutes,
         coalesce((
           select sp.amount_cents from public.service_prices sp
           where sp.service_id = s.id and sp.is_default = true
           limit 1
         ), 0)::integer as price_cents,
         s.is_featured
  from public.services s
  join public.tenants t on t.id = s.tenant_id
  join public.tenant_public_pages p on p.tenant_id = t.id
  where t.slug = _slug and p.is_published = true
    and s.is_active = true and s.is_public = true
  order by s.is_featured desc, s.position, s.name;
$$;

create or replace function public.get_public_professionals(_slug text, _unit_id uuid default null)
returns table (
  id uuid, display_name text, role_title text, specialty text, bio text, unit_id uuid
)
language sql stable security definer set search_path = public as $$
  select pr.id, pr.display_name, pr.role_title, pr.specialty, pr.bio, pr.unit_id
  from public.professionals pr
  join public.tenants t on t.id = pr.tenant_id
  join public.tenant_public_pages p on p.tenant_id = t.id
  where t.slug = _slug and p.is_published = true
    and pr.is_active = true
    and (_unit_id is null or pr.unit_id is null or pr.unit_id = _unit_id)
  order by pr.display_name;
$$;

create or replace function public.get_public_availability(
  _slug text, _unit_id uuid, _service_id uuid, _day date,
  _professional_id uuid default null
)
returns table (professional_id uuid, professional_name text, slot_start timestamptz, slot_end timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare
  v_tenant uuid;
  r record;
begin
  select t.id into v_tenant
  from public.tenants t
  join public.tenant_public_pages p on p.tenant_id = t.id
  where t.slug = _slug and p.is_published = true and t.status = 'active';
  if v_tenant is null then return; end if;

  if not exists (
    select 1 from public.units u
    where u.id = _unit_id and u.tenant_id = v_tenant and u.is_active and u.is_public
  ) then return; end if;

  if not exists (
    select 1 from public.services s
    where s.id = _service_id and s.tenant_id = v_tenant and s.is_active and s.is_public
  ) then return; end if;

  for r in
    select pr.id as pid, pr.display_name as pname
    from public.professionals pr
    where pr.tenant_id = v_tenant and pr.is_active
      and (pr.unit_id is null or pr.unit_id = _unit_id)
      and (_professional_id is null or pr.id = _professional_id)
  loop
    return query
      select r.pid, r.pname, g.slot_start, g.slot_end
      from public.get_available_slots(v_tenant, r.pid, _unit_id, _service_id, _day) g;
  end loop;
end;
$$;

create or replace function public.create_public_appointment(
  _slug text,
  _unit_id uuid,
  _service_id uuid,
  _professional_id uuid,
  _starts_at timestamptz,
  _full_name text default null,
  _phone text default null,
  _notes text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
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
begin
  if v_uid is null then
    raise exception 'Faca login para concluir o agendamento.' using errcode = '42501';
  end if;

  select email into v_email from auth.users where id = v_uid;
  if v_email is null then
    raise exception 'Conta sem e-mail verificado.' using errcode = '42501';
  end if;

  select t.id into v_tenant
  from public.tenants t
  join public.tenant_public_pages p on p.tenant_id = t.id
  where t.slug = _slug and p.is_published = true and t.status = 'active';
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
    insert into public.clients (tenant_id, full_name, email, phone, origin, preferred_unit_id)
    values (v_tenant, coalesce(nullif(trim(_full_name), ''), split_part(v_email, '@', 1)),
            v_email, nullif(trim(_phone), ''), 'public_link', _unit_id)
    returning id into v_client;
  end if;

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
$$;

revoke all on function public.get_public_tenant_page(text) from public;
revoke all on function public.get_public_units(text) from public;
revoke all on function public.get_public_services(text) from public;
revoke all on function public.get_public_professionals(text, uuid) from public;
revoke all on function public.get_public_availability(text, uuid, uuid, date, uuid) from public;
revoke all on function public.create_public_appointment(text, uuid, uuid, uuid, timestamptz, text, text, text) from public;

grant execute on function public.get_public_tenant_page(text) to anon, authenticated;
grant execute on function public.get_public_units(text) to anon, authenticated;
grant execute on function public.get_public_services(text) to anon, authenticated;
grant execute on function public.get_public_professionals(text, uuid) to anon, authenticated;
grant execute on function public.get_public_availability(text, uuid, uuid, date, uuid) to anon, authenticated;
grant execute on function public.create_public_appointment(text, uuid, uuid, uuid, timestamptz, text, text, text) to authenticated;