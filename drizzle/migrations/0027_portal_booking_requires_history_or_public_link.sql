ALTER TABLE public.client_users ADD COLUMN IF NOT EXISTS booking_origin text;

-- Vínculos já criados pelo link público do estabelecimento
UPDATE public.client_users cu
   SET booking_origin = 'public_link'
  FROM public.clients c
 WHERE c.id = cu.client_id AND c.origin = 'public_link' AND cu.booking_origin IS NULL;

-- Cliente só agenda pelo portal onde já tem histórico ou chegou pelo link do estabelecimento
CREATE OR REPLACE FUNCTION public.portal_can_book(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  select exists (
    select 1 from public.client_users cu
    where cu.user_id = _user_id and cu.tenant_id = _tenant_id and cu.status = 'active'
      and (
        cu.booking_origin = 'public_link'
        or exists (select 1 from public.appointments a
                   where a.client_id = cu.client_id and a.tenant_id = cu.tenant_id)
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.portal_can_book(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_can_book(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "appointments: dono cria para si" ON public.appointments;
CREATE POLICY "appointments: dono cria para si" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    is_portal_client_of(auth.uid(), client_id)
    AND source = 'client_portal'::appointment_source
    AND public.portal_can_book(auth.uid(), tenant_id)
  );

-- Link público marca o vínculo como origem autorizada
DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.create_public_appointment'::regproc);
  d := replace(d,
    E'values (v_tenant, v_client, v_uid, ''active'')\n  on conflict do nothing;',
    E'values (v_tenant, v_client, v_uid, ''active'')\n  on conflict (tenant_id, user_id) do nothing;\n\n  update public.client_users set booking_origin = ''public_link'', status = ''active'', updated_at = now()\n   where tenant_id = v_tenant and user_id = v_uid;');
  IF position('booking_origin' in d) = 0 THEN
    RAISE EXCEPTION 'create_public_appointment patch not applied';
  END IF;
  EXECUTE d;
END
$mig$;