-- Ajustando search_path para funções disparadas por triggers
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Garantindo que funções de utilidade também tenham search_path explícito
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.has_any_tenant_role(uuid, uuid, app_role[]) SET search_path = public;
