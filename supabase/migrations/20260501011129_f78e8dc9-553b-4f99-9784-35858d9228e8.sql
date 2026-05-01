-- Configurando search_path em funções SECURITY DEFINER identificadas
ALTER FUNCTION public.count_active_owners(uuid) SET search_path = public;
ALTER FUNCTION public.start_default_trial(uuid) SET search_path = public;
ALTER FUNCTION public.tenant_has_feature(uuid, text) SET search_path = public;
ALTER FUNCTION public.admin_update_plan_limits(uuid, integer, integer, integer, integer) SET search_path = public;

-- Revogar execução pública de funções administrativas críticas
REVOKE EXECUTE ON FUNCTION public.admin_update_plan_limits(uuid, integer, integer, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_update_plan_limits(uuid, integer, integer, integer, integer) FROM anon;

-- Reforço no isolamento de tenant_memberships
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_user_tenant ON public.tenant_memberships(user_id, tenant_id);
