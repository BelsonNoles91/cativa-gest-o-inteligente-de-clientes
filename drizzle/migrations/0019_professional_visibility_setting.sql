ALTER TABLE public.tenant_settings ADD COLUMN IF NOT EXISTS professional_sees_all boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.professional_is_restricted(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.has_any_tenant_role(_user_id, _tenant_id, ARRAY['owner','manager','frontdesk']::app_role[])
     AND NOT public.is_super_admin(_user_id)
     AND COALESCE((SELECT NOT ts.professional_sees_all FROM public.tenant_settings ts WHERE ts.tenant_id = _tenant_id), false)
$$;
REVOKE EXECUTE ON FUNCTION public.professional_is_restricted(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.professional_is_restricted(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "appointments: membros leem" ON public.appointments;
CREATE POLICY "appointments: membros leem" ON public.appointments FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (is_tenant_member(auth.uid(), tenant_id)
      AND (NOT professional_is_restricted(auth.uid(), tenant_id)
           OR professional_id = current_professional_id(tenant_id)))
);

DROP POLICY IF EXISTS "appointments: equipe gerencia" ON public.appointments;
CREATE POLICY "appointments: equipe gerencia" ON public.appointments FOR ALL TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager','frontdesk','professional']::app_role[])
      AND (NOT professional_is_restricted(auth.uid(), tenant_id)
           OR professional_id = current_professional_id(tenant_id)))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager','frontdesk','professional']::app_role[])
      AND (NOT professional_is_restricted(auth.uid(), tenant_id)
           OR professional_id = current_professional_id(tenant_id)))
);

DROP POLICY IF EXISTS "clients: membros leem" ON public.clients;
CREATE POLICY "clients: membros leem" ON public.clients FOR SELECT TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (is_tenant_member(auth.uid(), tenant_id)
      AND (NOT professional_is_restricted(auth.uid(), tenant_id)
           OR EXISTS (SELECT 1 FROM public.appointments a
                      WHERE a.client_id = clients.id
                        AND a.professional_id = current_professional_id(clients.tenant_id))))
);