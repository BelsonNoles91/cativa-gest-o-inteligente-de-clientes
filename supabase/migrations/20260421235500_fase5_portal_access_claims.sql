-- =============================================================================
-- Cativa — Fase 5 — Auto-vinculo do Portal do Cliente por e-mail autenticado
-- =============================================================================

create or replace function public.claim_portal_links_for_current_user()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _count integer := 0;
begin
  if _uid is null or _email = '' then
    return 0;
  end if;

  insert into public.client_users (
    tenant_id,
    client_id,
    user_id,
    status,
    linked_at,
    last_seen_at
  )
  select distinct on (c.tenant_id)
    c.tenant_id,
    c.id,
    _uid,
    'active'::public.client_user_status,
    now(),
    now()
  from public.clients c
  where c.email is not null
    and lower(c.email) = _email
  order by c.tenant_id, c.updated_at desc, c.created_at desc
  on conflict (tenant_id, user_id) do update
  set
    client_id = excluded.client_id,
    status = 'active',
    last_seen_at = now(),
    updated_at = now();

  get diagnostics _count = row_count;
  return coalesce(_count, 0);
end;
$$;

grant execute on function public.claim_portal_links_for_current_user() to authenticated;

create or replace function public.touch_portal_last_seen(_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.client_users
  set
    last_seen_at = now(),
    updated_at = now()
  where id = _link_id
    and user_id = auth.uid();
end;
$$;

grant execute on function public.touch_portal_last_seen(uuid) to authenticated;
