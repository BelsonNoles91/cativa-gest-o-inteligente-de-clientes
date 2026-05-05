-- =========================================================================
-- FASE 1 — CORREÇÕES DE SEGURANÇA CRÍTICAS
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) PROFILES: bloquear auto-promoção a super_admin
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profiles_block_self_super_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF COALESCE(NEW.is_super_admin, false) IS NOT DISTINCT FROM COALESCE(OLD.is_super_admin, false) THEN
    RETURN NEW;
  END IF;
  IF v_actor IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.is_super_admin(v_actor) THEN
    RETURN NEW;
  END IF;
  NEW.is_super_admin := OLD.is_super_admin;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_super_admin ON public.profiles;
CREATE TRIGGER profiles_block_self_super_admin
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.profiles_block_self_super_admin();

-- -------------------------------------------------------------------------
-- 2) CLIENT_USERS: remover self-insert sem validação
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "client_users: usuário cria seu próprio vínculo" ON public.client_users;

-- -------------------------------------------------------------------------
-- 3) PROFESSIONALS: restringir leitura de commission_pct
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "professionals: membros leem" ON public.professionals;
DROP POLICY IF EXISTS "professionals: dono lê do tenant" ON public.professionals;

CREATE POLICY "professionals: owner manager leem tudo"
ON public.professionals
FOR SELECT
TO authenticated
USING (
  has_any_tenant_role(auth.uid(), tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
  OR is_super_admin(auth.uid())
);

CREATE POLICY "professionals: vê o próprio registro"
ON public.professionals
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RPC para qualquer membro do tenant listar profissionais SEM commission_pct.
CREATE OR REPLACE FUNCTION public.list_team_professionals(_tenant_id uuid)
RETURNS TABLE(
  id uuid,
  tenant_id uuid,
  unit_id uuid,
  user_id uuid,
  display_name text,
  role_title text,
  specialty text,
  color text,
  bio text,
  email text,
  phone text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.tenant_id, p.unit_id, p.user_id,
    p.display_name, p.role_title, p.specialty,
    p.color, p.bio, p.email, p.phone,
    p.is_active, p.created_at, p.updated_at
  FROM public.professionals p
  WHERE p.tenant_id = _tenant_id
    AND (
      public.is_tenant_member(auth.uid(), _tenant_id)
      OR public.is_super_admin(auth.uid())
    )
  ORDER BY p.display_name;
$$;

-- RPC para o próprio profissional consultar a SUA comissão.
CREATE OR REPLACE FUNCTION public.get_my_commission(_professional_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT commission_pct
  FROM public.professionals
  WHERE id = _professional_id
    AND user_id = auth.uid();
$$;

-- -------------------------------------------------------------------------
-- 4) AUDIT_LOGS: remover do Realtime
-- -------------------------------------------------------------------------
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.audit_logs;

-- -------------------------------------------------------------------------
-- 5) SEGMENT_TEMPLATES: exigir membership ativa em algum tenant
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "segment_templates: autenticado lê ativos" ON public.segment_templates;

CREATE POLICY "segment_templates: equipe lê ativos"
ON public.segment_templates
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  )
);

-- -------------------------------------------------------------------------
-- 6) FEATURE_FLAGS: globais visíveis só a quem tem membership ativa
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "feature_flags: tenant lê próprio + globais" ON public.feature_flags;

CREATE POLICY "feature_flags: equipe lê próprio + globais"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    tenant_id IS NOT NULL AND is_tenant_member(auth.uid(), tenant_id)
  )
  OR (
    is_global = true
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.user_id = auth.uid() AND tm.status = 'active'
    )
  )
);

-- -------------------------------------------------------------------------
-- 7) STORAGE: garantir leitura pública APENAS do bucket de logos
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname='tenant-logos: leitura pública'
  ) THEN
    CREATE POLICY "tenant-logos: leitura pública"
    ON storage.objects
    FOR SELECT
    TO public
    USING (bucket_id = 'tenant-logos');
  END IF;
END $$;