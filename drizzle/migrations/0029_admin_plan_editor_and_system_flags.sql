-- Flags públicas do sistema (lidas por visitantes e por qualquer usuário)
create or replace function public.get_public_system_flags()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'enable_signups', coalesce((select value from feature_flags where flag_key='enable_signups' and is_global and tenant_id is null limit 1), 'true'::jsonb),
    'maintenance_mode', coalesce((select value from feature_flags where flag_key='maintenance_mode' and is_global and tenant_id is null limit 1), 'false'::jsonb),
    'show_cativa_index', coalesce((select value from feature_flags where flag_key='show_cativa_index' and is_global and tenant_id is null limit 1), 'true'::jsonb)
  );
$$;
revoke all on function public.get_public_system_flags() from public;
grant execute on function public.get_public_system_flags() to anon, authenticated, service_role;

create or replace function public.system_flag_enabled(_key text, _default boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case when value = 'true'::jsonb or value = '"true"'::jsonb then true
                 when value = 'false'::jsonb or value = '"false"'::jsonb then false
                 else _default end
       from feature_flags where flag_key=_key and is_global and tenant_id is null limit 1),
    _default);
$$;
revoke all on function public.system_flag_enabled(text, boolean) from public;
grant execute on function public.system_flag_enabled(text, boolean) to authenticated, service_role;

-- Cadastro de novos estabelecimentos respeita "Permitir novos cadastros"
drop policy if exists "tenants: usuário autenticado pode criar" on public.tenants;
create policy "tenants: usuário autenticado pode criar" on public.tenants
  for insert to authenticated
  with check (created_by = auth.uid() and (public.system_flag_enabled('enable_signups', true) or public.is_super_admin(auth.uid())));

-- Mantém o comportamento atual (cadastros abertos), já que a opção nunca era respeitada
update public.feature_flags set value='true'::jsonb, updated_at=now()
 where flag_key='enable_signups' and is_global and tenant_id is null;

-- Exibição na landing
update public.plans set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('show_on_landing', code in ('free','entrepreneur','studio'), 'highlight', code = 'entrepreneur')
 where not (coalesce(metadata,'{}'::jsonb) ? 'show_on_landing');

-- Atualização em tempo real da landing
do $$ begin
  alter publication supabase_realtime add table public.plans;
exception when duplicate_object then null; end $$;