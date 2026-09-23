-- Profissional pode editar apenas os dados de apresentação da própria ficha
CREATE OR REPLACE FUNCTION public.enforce_professional_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_any_tenant_role(auth.uid(), NEW.tenant_id, array['owner','manager']::public.app_role[])
     OR public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Você só pode editar a sua própria ficha.';
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.unit_id IS DISTINCT FROM OLD.unit_id
     OR NEW.commission_pct IS DISTINCT FROM OLD.commission_pct
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'Estes dados só podem ser alterados pelo gestor do estabelecimento.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS professionals_self_update_guard ON public.professionals;
CREATE TRIGGER professionals_self_update_guard
  BEFORE UPDATE ON public.professionals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_professional_self_update();

DROP POLICY IF EXISTS "professionals: edita a própria ficha" ON public.professionals;
CREATE POLICY "professionals: edita a própria ficha"
ON public.professionals FOR UPDATE TO authenticated
USING (user_id = auth.uid() AND public.is_tenant_member(auth.uid(), tenant_id))
WITH CHECK (user_id = auth.uid() AND public.is_tenant_member(auth.uid(), tenant_id));