-- Drop antes para permitir mudança no shape de retorno
DROP FUNCTION IF EXISTS public.admin_list_tenant_memberships();
DROP FUNCTION IF EXISTS public.admin_update_membership_role(uuid, app_role);
DROP FUNCTION IF EXISTS public.admin_update_membership_status(uuid, text);
DROP FUNCTION IF EXISTS public.admin_set_super_admin(uuid, boolean);

-- ---------- Helpers ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_active_owners(_tenant_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.tenant_memberships
  WHERE tenant_id = _tenant_id
    AND role = 'owner'::app_role
    AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.count_active_super_admins()
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*)::int FROM public.profiles WHERE is_super_admin = true;
$$;

-- ---------- RPC: listar memberships -----------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_tenant_memberships()
RETURNS TABLE (
  membership_id uuid,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  user_id uuid,
  role app_role,
  status text,
  user_full_name text,
  user_email text,
  user_is_super_admin boolean,
  invited_email text,
  invited_at timestamptz,
  accepted_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    tm.id, tm.tenant_id, t.name, t.slug,
    tm.user_id, tm.role, tm.status::text,
    p.full_name, p.email,
    COALESCE(p.is_super_admin, false),
    tm.invited_email, tm.invited_at, tm.accepted_at, tm.updated_at
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  ORDER BY t.name ASC, tm.updated_at DESC;
END;
$$;

-- ---------- RPC: alterar papel ----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_membership_role(
  p_membership_id uuid,
  p_new_role app_role
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_m public.tenant_memberships%ROWTYPE;
  v_owners int;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  IF p_new_role IS NULL THEN
    RAISE EXCEPTION 'Novo papel obrigatório';
  END IF;
  IF p_new_role = 'super_admin' THEN
    RAISE EXCEPTION 'Use admin_set_super_admin para conceder super admin';
  END IF;
  IF p_new_role = 'client' THEN
    RAISE EXCEPTION 'Papel "client" não pode ser atribuído a um membership da equipe';
  END IF;

  SELECT * INTO v_m FROM public.tenant_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership não encontrado'; END IF;

  -- Anti auto-rebaixamento de owner
  IF v_m.user_id = v_actor AND v_m.role = 'owner' AND p_new_role <> 'owner' THEN
    RAISE EXCEPTION 'Você não pode rebaixar seu próprio papel de owner neste tenant';
  END IF;

  -- Não deixar tenant sem owner ativo
  IF v_m.role = 'owner' AND v_m.status = 'active' AND p_new_role <> 'owner' THEN
    SELECT public.count_active_owners(v_m.tenant_id) INTO v_owners;
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'Não é possível alterar — este é o último owner ativo do tenant';
    END IF;
  END IF;

  IF v_m.role = p_new_role THEN RETURN; END IF;

  UPDATE public.tenant_memberships
  SET role = p_new_role, updated_at = now()
  WHERE id = p_membership_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, entity, entity_id, action, metadata)
  VALUES (
    v_m.tenant_id, v_actor, 'tenant_membership', p_membership_id, 'role_changed',
    jsonb_build_object(
      'from_role', v_m.role, 'to_role', p_new_role,
      'user_id', v_m.user_id, 'changed_by_super_admin', true
    )
  );
END;
$$;

-- ---------- RPC: alterar status ---------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_membership_status(
  p_membership_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_m public.tenant_memberships%ROWTYPE;
  v_owners int;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;

  IF p_new_status NOT IN ('active','invited','suspended') THEN
    RAISE EXCEPTION 'Status inválido: %', p_new_status;
  END IF;

  SELECT * INTO v_m FROM public.tenant_memberships WHERE id = p_membership_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Membership não encontrado'; END IF;

  -- Anti auto-suspensão
  IF v_m.user_id = v_actor AND v_m.status = 'active' AND p_new_status <> 'active' THEN
    RAISE EXCEPTION 'Você não pode suspender ou desativar seu próprio acesso a este tenant';
  END IF;

  -- Não suspender o último owner ativo
  IF v_m.role = 'owner' AND v_m.status = 'active' AND p_new_status <> 'active' THEN
    SELECT public.count_active_owners(v_m.tenant_id) INTO v_owners;
    IF v_owners <= 1 THEN
      RAISE EXCEPTION 'Não é possível suspender — este é o último owner ativo do tenant';
    END IF;
  END IF;

  IF v_m.status::text = p_new_status THEN RETURN; END IF;

  UPDATE public.tenant_memberships
  SET status = p_new_status::membership_status,
      accepted_at = CASE
        WHEN p_new_status = 'active' AND accepted_at IS NULL THEN now()
        ELSE accepted_at
      END,
      updated_at = now()
  WHERE id = p_membership_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, entity, entity_id, action, metadata)
  VALUES (
    v_m.tenant_id, v_actor, 'tenant_membership', p_membership_id, 'status_changed',
    jsonb_build_object(
      'from_status', v_m.status, 'to_status', p_new_status,
      'user_id', v_m.user_id, 'changed_by_super_admin', true
    )
  );
END;
$$;

-- ---------- RPC: super admin -----------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_super_admin(
  p_user_id uuid,
  p_is_super boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_current boolean;
  v_total int;
BEGIN
  IF NOT public.is_super_admin(v_actor) THEN
    RAISE EXCEPTION 'Apenas super admin' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id obrigatório'; END IF;

  IF p_user_id = v_actor AND p_is_super = false THEN
    RAISE EXCEPTION 'Você não pode remover seu próprio acesso de super admin';
  END IF;

  SELECT COALESCE(is_super_admin, false) INTO v_current
  FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário sem profile — peça que ele faça login uma vez antes';
  END IF;

  IF v_current = true AND p_is_super = false THEN
    SELECT public.count_active_super_admins() INTO v_total;
    IF v_total <= 1 THEN
      RAISE EXCEPTION 'Não é possível remover — este é o último super admin do sistema';
    END IF;
  END IF;

  IF v_current = p_is_super THEN RETURN; END IF;

  UPDATE public.profiles
  SET is_super_admin = p_is_super, updated_at = now()
  WHERE id = p_user_id;

  INSERT INTO public.audit_logs (tenant_id, actor_id, entity, entity_id, action, metadata)
  VALUES (
    NULL, v_actor, 'profile', p_user_id,
    CASE WHEN p_is_super THEN 'super_admin_granted' ELSE 'super_admin_revoked' END,
    jsonb_build_object('user_id', p_user_id, 'is_super_admin', p_is_super)
  );
END;
$$;

-- ---------- Permissões ------------------------------------------------
REVOKE ALL ON FUNCTION public.admin_list_tenant_memberships()              FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_update_membership_role(uuid, app_role) FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_update_membership_status(uuid, text)   FROM public, anon;
REVOKE ALL ON FUNCTION public.admin_set_super_admin(uuid, boolean)         FROM public, anon;
REVOKE ALL ON FUNCTION public.count_active_owners(uuid)                    FROM public, anon;
REVOKE ALL ON FUNCTION public.count_active_super_admins()                  FROM public, anon;

GRANT EXECUTE ON FUNCTION public.admin_list_tenant_memberships()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_membership_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_membership_status(uuid, text)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_super_admin(uuid, boolean)         TO authenticated;