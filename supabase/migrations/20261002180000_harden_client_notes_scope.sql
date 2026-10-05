-- Keep client notes bound to their original client/tenant and require active
-- tenant membership for author-based writes.

CREATE OR REPLACE FUNCTION public.enforce_client_note_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  linked_tenant_id uuid;
BEGIN
  IF TG_OP = 'UPDATE'
     AND (NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
          OR NEW.client_id IS DISTINCT FROM OLD.client_id) THEN
    RAISE EXCEPTION 'Client note scope cannot be reassigned.'
      USING ERRCODE = '42501';
  END IF;

  SELECT clients.tenant_id
    INTO linked_tenant_id
    FROM public.clients
   WHERE clients.id = NEW.client_id;

  IF linked_tenant_id IS NULL OR linked_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Client note and client must belong to the same tenant.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_client_note_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS client_notes_enforce_scope_trg ON public.client_notes;
CREATE TRIGGER client_notes_enforce_scope_trg
  BEFORE INSERT OR UPDATE ON public.client_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_note_scope();

DROP POLICY IF EXISTS "client_notes: autor ou gestor edita" ON public.client_notes;
CREATE POLICY "client_notes: autor ou gestor edita"
ON public.client_notes FOR UPDATE TO authenticated
USING (
  (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND (
      author_id = auth.uid()
      OR public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
    )
  )
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND (
      author_id = auth.uid()
      OR public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
    )
  )
  OR public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "client_notes: autor ou gestor remove" ON public.client_notes;
CREATE POLICY "client_notes: autor ou gestor remove"
ON public.client_notes FOR DELETE TO authenticated
USING (
  (
    public.is_tenant_member(auth.uid(), tenant_id)
    AND (
      author_id = auth.uid()
      OR public.has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner','manager']::public.app_role[])
    )
  )
  OR public.is_super_admin(auth.uid())
);
