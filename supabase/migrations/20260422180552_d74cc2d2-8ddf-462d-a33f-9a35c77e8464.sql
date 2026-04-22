-- Lista todos os memberships do sistema com dados denormalizados (super admin only)
CREATE OR REPLACE FUNCTION public.admin_list_tenant_memberships()
RETURNS TABLE (
  membership_id uuid,
  user_id uuid,
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  role public.app_role,
  status public.membership_status,
  user_full_name text,
  user_email text,
  user_is_super_admin boolean,
  invited_email text,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tm.id,
    tm.user_id,
    tm.tenant_id,
    t.name,
    t.slug,
    tm.role,
    tm.status,
    p.full_name,
    u.email::text,
    COALESCE(p.is_super_admin, false),
    tm.invited_email,
    tm.invited_at,
    tm.accepted_at,
    tm.created_at,
    tm.updated_at
  FROM public.tenant_memberships tm
  LEFT JOIN public.tenants t ON t.id = tm.tenant_id
  LEFT JOIN public.profiles p ON p.id = tm.user_id
  LEFT JOIN auth.users u ON u.id = tm.user_id
  WHERE public.is_super_admin(auth.uid())
  ORDER BY t.name NULLS LAST, p.full_name NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.admin_list_tenant_memberships() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_list_tenant_memberships() TO authenticated;

-- Atualiza papel de um membro (super admin only)
CREATE OR REPLACE FUNCTION public.admin_update_membership_role(
  p_membership_id uuid,
  p_new_role public.app_role
)
RETURNS public.tenant_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.tenant_memberships;
  v_new public.tenant_memberships;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode alterar papéis' USING errcode = '42501';
  END IF;

  SELECT * INTO v_old FROM public.tenant_memberships WHERE id = p_membership_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Vínculo não encontrado' USING errcode = 'P0002';
  END IF;

  UPDATE public.tenant_memberships
    SET role = p_new_role, updated_at = now()
    WHERE id = p_membership_id
    RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_new.tenant_id,
    auth.uid(),
    'admin.membership.role_changed',
    'tenant_membership',
    v_new.id,
    jsonb_build_object(
      'user_id', v_new.user_id,
      'from_role', v_old.role,
      'to_role', v_new.role
    )
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_membership_role(uuid, public.app_role) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_membership_role(uuid, public.app_role) TO authenticated;

-- Atualiza status de um membro (super admin only)
CREATE OR REPLACE FUNCTION public.admin_update_membership_status(
  p_membership_id uuid,
  p_new_status public.membership_status
)
RETURNS public.tenant_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.tenant_memberships;
  v_new public.tenant_memberships;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode alterar status' USING errcode = '42501';
  END IF;

  SELECT * INTO v_old FROM public.tenant_memberships WHERE id = p_membership_id;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'Vínculo não encontrado' USING errcode = 'P0002';
  END IF;

  UPDATE public.tenant_memberships
    SET status = p_new_status,
        accepted_at = CASE
          WHEN p_new_status = 'active' AND v_old.accepted_at IS NULL THEN now()
          ELSE v_old.accepted_at
        END,
        updated_at = now()
    WHERE id = p_membership_id
    RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    v_new.tenant_id,
    auth.uid(),
    'admin.membership.status_changed',
    'tenant_membership',
    v_new.id,
    jsonb_build_object(
      'user_id', v_new.user_id,
      'from_status', v_old.status,
      'to_status', v_new.status
    )
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_membership_status(uuid, public.membership_status) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_update_membership_status(uuid, public.membership_status) TO authenticated;

-- Promove/remove super admin (super admin only) — não permite remover a si mesmo
CREATE OR REPLACE FUNCTION public.admin_set_super_admin(
  p_user_id uuid,
  p_is_super boolean
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old boolean;
  v_new public.profiles;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas super admin pode alterar super admins' USING errcode = '42501';
  END IF;

  IF p_user_id = auth.uid() AND p_is_super = false THEN
    RAISE EXCEPTION 'Não é possível remover seu próprio acesso de super admin' USING errcode = 'P0001';
  END IF;

  SELECT is_super_admin INTO v_old FROM public.profiles WHERE id = p_user_id;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado' USING errcode = 'P0002';
  END IF;

  UPDATE public.profiles
    SET is_super_admin = p_is_super, updated_at = now()
    WHERE id = p_user_id
    RETURNING * INTO v_new;

  INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
  VALUES (
    NULL,
    auth.uid(),
    CASE WHEN p_is_super THEN 'admin.super_admin.granted' ELSE 'admin.super_admin.revoked' END,
    'profile',
    p_user_id,
    jsonb_build_object('from', v_old, 'to', p_is_super)
  );

  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_super_admin(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_super_admin(uuid, boolean) TO authenticated;