GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_tenant_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_tenant_role(uuid, uuid, app_role[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_portal_client_of(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_professional_id(uuid) TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;