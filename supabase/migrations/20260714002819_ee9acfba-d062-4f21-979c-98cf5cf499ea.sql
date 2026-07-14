
CREATE OR REPLACE FUNCTION public.prevent_super_admin_self_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_super boolean := false;
BEGIN
  -- Bypass para operações sem contexto de auth (service_role, migrations, triggers internos)
  IF v_caller IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.is_super_admin, false) INTO v_is_super
  FROM public.profiles p
  WHERE p.id = v_caller;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.is_super_admin, false) = true AND v_is_super IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Não é permitido definir is_super_admin ao criar o próprio perfil';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.is_super_admin, false) IS DISTINCT FROM COALESCE(OLD.is_super_admin, false)
       AND v_is_super IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'Somente super administradores podem alterar is_super_admin';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_super_admin_self_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_super_admin_self_escalation
  BEFORE INSERT OR UPDATE OF is_super_admin ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_super_admin_self_escalation();
