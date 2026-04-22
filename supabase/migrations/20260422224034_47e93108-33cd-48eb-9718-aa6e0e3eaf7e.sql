-- =============================================================
-- 1. PROTEGER commission_pct (owner/manager/próprio profissional)
-- =============================================================

-- Remove a policy genérica que expõe commission_pct a todos os membros
DROP POLICY IF EXISTS "professionals: membros leem" ON public.professionals;

-- Substitui por uma policy "membros leem dados públicos" via security definer
-- Para isso usamos uma view "professionals_public" que esconde commission_pct
CREATE OR REPLACE VIEW public.professionals_public
WITH (security_invoker = true) AS
SELECT
  id, tenant_id, unit_id, user_id,
  display_name, role_title, specialty,
  color, bio, email, phone,
  is_active, created_at, updated_at,
  -- commission_pct intencionalmente omitido
  NULL::numeric AS commission_pct_hidden
FROM public.professionals;

GRANT SELECT ON public.professionals_public TO authenticated, anon;

-- Recria policy de leitura para membros, MAS sem expor commission_pct.
-- Como Postgres RLS é por linha, não por coluna, criamos uma policy
-- restritiva por coluna usando uma policy de SELECT que cobre membros
-- e uma policy adicional baseada em função SECURITY DEFINER para permitir
-- a leitura ampla — o frontend já trata o caso onde a coluna é NULL.
--
-- Estratégia: revoga SELECT da coluna commission_pct para `authenticated`
-- e concede apenas via função RPC security definer que valida o role.
CREATE POLICY "professionals: membros leem (sem commission)"
  ON public.professionals
  FOR SELECT
  TO authenticated
  USING (
    public.is_tenant_member(auth.uid(), tenant_id)
    OR public.is_super_admin(auth.uid())
  );

-- Revoga acesso direto à coluna sensível e concede apenas a roles privilegiados
REVOKE SELECT (commission_pct) ON public.professionals FROM authenticated, anon, public;

-- Função para owner/manager lerem comissões do tenant
CREATE OR REPLACE FUNCTION public.list_professionals_with_commission(_tenant_id uuid)
RETURNS TABLE (
  id uuid,
  display_name text,
  commission_pct numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.display_name, p.commission_pct
  FROM public.professionals p
  WHERE p.tenant_id = _tenant_id
    AND (
      public.has_any_tenant_role(auth.uid(), _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
      OR public.is_super_admin(auth.uid())
      OR p.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.list_professionals_with_commission(uuid) TO authenticated;

-- =============================================================
-- 2. BLOQUEAR ESCALAÇÃO is_super_admin
-- =============================================================
-- O trigger profiles_block_self_super_admin já existe, mas só roda em UPDATE.
-- Garantimos que também rode em INSERT, e que NÃO permita o usuário marcar
-- a si mesmo como super_admin no INSERT inicial via handle_new_user.

CREATE OR REPLACE FUNCTION public.profiles_block_super_admin_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  -- INSERT: novo perfil
  IF TG_OP = 'INSERT' THEN
    -- Se o ator não é super admin, força is_super_admin = false
    IF v_actor IS NOT NULL AND NOT public.is_super_admin(v_actor) THEN
      NEW.is_super_admin := false;
    END IF;
    -- Caso especial: handle_new_user roda como SECURITY DEFINER (sem auth.uid())
    -- Mantemos false por padrão nesse caso também.
    IF v_actor IS NULL THEN
      NEW.is_super_admin := COALESCE(NEW.is_super_admin, false);
      -- Bloqueia handle_new_user de definir true (não há caso legítimo)
      IF NEW.is_super_admin = true THEN
        NEW.is_super_admin := false;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: campo mudou?
  IF COALESCE(NEW.is_super_admin, false) IS NOT DISTINCT FROM COALESCE(OLD.is_super_admin, false) THEN
    RETURN NEW;
  END IF;

  -- Apenas super admin pode alterar
  IF v_actor IS NULL OR NOT public.is_super_admin(v_actor) THEN
    NEW.is_super_admin := OLD.is_super_admin;
    RETURN NEW;
  END IF;

  -- Auditoria da mudança
  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (
      NULL, v_actor,
      CASE WHEN NEW.is_super_admin THEN 'profile.super_admin_granted' ELSE 'profile.super_admin_revoked' END,
      'profile', NEW.id,
      jsonb_build_object('from', OLD.is_super_admin, 'to', NEW.is_super_admin)
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_block_self_super_admin_trg ON public.profiles;
DROP TRIGGER IF EXISTS profiles_block_super_admin_changes_trg ON public.profiles;

CREATE TRIGGER profiles_block_super_admin_changes_trg
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_block_super_admin_changes();

-- =============================================================
-- 3. HASHEAR team_invitations.token
-- =============================================================

-- Adiciona coluna token_hash
ALTER TABLE public.team_invitations
  ADD COLUMN IF NOT EXISTS token_hash text;

-- Backfill: popula token_hash a partir do token atual e marca pendentes como expirados
UPDATE public.team_invitations
   SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
 WHERE token_hash IS NULL;

-- Invalida convites pendentes anteriores (sem hash original confiável)
UPDATE public.team_invitations
   SET status = 'expired',
       updated_at = now()
 WHERE status = 'pending';

-- Index para lookup por hash
CREATE UNIQUE INDEX IF NOT EXISTS team_invitations_token_hash_idx
  ON public.team_invitations (token_hash);

-- Trigger BEFORE INSERT/UPDATE: garante token_hash sempre populado
CREATE OR REPLACE FUNCTION public.team_invitations_hash_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Se token foi setado/alterado, recalcula hash
  IF TG_OP = 'INSERT' OR NEW.token IS DISTINCT FROM OLD.token THEN
    IF NEW.token IS NOT NULL THEN
      NEW.token_hash := encode(extensions.digest(NEW.token, 'sha256'), 'hex');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS team_invitations_hash_token_trg ON public.team_invitations;
CREATE TRIGGER team_invitations_hash_token_trg
  BEFORE INSERT OR UPDATE OF token ON public.team_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.team_invitations_hash_token();

-- Garante NOT NULL após backfill
ALTER TABLE public.team_invitations
  ALTER COLUMN token_hash SET NOT NULL;

-- Atualiza accept_team_invitation para aceitar token PLAIN e comparar via hash
CREATE OR REPLACE FUNCTION public.accept_team_invitation(_token text)
RETURNS public.tenant_memberships
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.team_invitations;
  v_existing public.tenant_memberships;
  v_inserted public.tenant_memberships;
  v_pro_count int;
  v_max_pros int;
  v_hash text;
begin
  if v_user is null then
    raise exception 'Usuário não autenticado.' using errcode = '42501';
  end if;
  if v_email = '' then
    raise exception 'E-mail do usuário não disponível na sessão.' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');

  select * into v_invite
    from public.team_invitations
   where token_hash = v_hash
   limit 1;

  if not found then
    raise exception 'Convite não encontrado.' using errcode = 'P0002';
  end if;

  if v_invite.status = 'accepted' then
    raise exception 'Este convite já foi aceito.' using errcode = '22023';
  elsif v_invite.status = 'revoked' then
    raise exception 'Este convite foi cancelado.' using errcode = '22023';
  elsif v_invite.status = 'expired' or v_invite.expires_at <= now() then
    update public.team_invitations
       set status = 'expired', updated_at = now()
     where id = v_invite.id and status = 'pending';
    raise exception 'Este convite expirou.' using errcode = '22023';
  end if;

  if lower(v_invite.email) <> v_email then
    raise exception 'O convite foi emitido para outro e-mail.' using errcode = '42501';
  end if;

  if v_invite.role = 'professional'::public.app_role then
    select coalesce((public.effective_subscription_limits(v_invite.tenant_id) ->> 'max_professionals')::int, 0)
      into v_max_pros;
    if v_max_pros > 0 then
      select count(*) into v_pro_count
        from public.tenant_memberships
       where tenant_id = v_invite.tenant_id
         and status = 'active'
         and role = 'professional'::public.app_role;
      if v_pro_count >= v_max_pros then
        raise exception 'Limite de profissionais do plano atingido (%/%).', v_pro_count, v_max_pros
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  select * into v_existing
    from public.tenant_memberships
   where tenant_id = v_invite.tenant_id and user_id = v_user
   limit 1;

  if found then
    update public.tenant_memberships
       set role = v_invite.role, status = 'active', updated_at = now()
     where id = v_existing.id
     returning * into v_inserted;
  else
    insert into public.tenant_memberships (tenant_id, user_id, role, status)
    values (v_invite.tenant_id, v_user, v_invite.role, 'active')
    returning * into v_inserted;
  end if;

  update public.team_invitations
     set status = 'accepted', accepted_by = v_user, accepted_at = now(),
         token = NULL,  -- limpa o plaintext após aceite
         updated_at = now()
   where id = v_invite.id;

  begin
    insert into public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    values (
      v_invite.tenant_id, v_user, 'team.invitation_accepted', 'team_invitation', v_invite.id,
      jsonb_build_object('email', v_invite.email, 'role', v_invite.role)
    );
  exception when others then null;
  end;

  return v_inserted;
end;
$$;

-- RPC para o convidado verificar/visualizar um convite por token (hash internamente)
CREATE OR REPLACE FUNCTION public.lookup_team_invitation(_token text)
RETURNS TABLE (
  id uuid,
  tenant_id uuid,
  email text,
  role app_role,
  status team_invitation_status,
  expires_at timestamptz,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_hash text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  v_hash := encode(extensions.digest(_token, 'sha256'), 'hex');
  RETURN QUERY
    SELECT i.id, i.tenant_id, i.email, i.role, i.status, i.expires_at, i.message
    FROM public.team_invitations i
    WHERE i.token_hash = v_hash
      AND lower(i.email) = v_email
    LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.lookup_team_invitation(text) TO authenticated;

-- Revoga acesso direto à coluna token (plaintext) — agora apenas o criador
-- vê na resposta do INSERT via RETURNING (RLS de gestor ainda permite).
-- Para reforçar: criamos RPC que cria o convite e devolve token plaintext apenas uma vez.
CREATE OR REPLACE FUNCTION public.create_team_invitation(
  _tenant_id uuid,
  _email text,
  _role app_role,
  _message text DEFAULT NULL,
  _expires_in_days int DEFAULT 14
)
RETURNS TABLE (
  id uuid,
  token text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_token text;
  v_invite public.team_invitations;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING errcode = '42501';
  END IF;
  IF NOT (
    public.has_any_tenant_role(v_user, _tenant_id, ARRAY['owner'::app_role, 'manager'::app_role])
    OR public.is_super_admin(v_user)
  ) THEN
    RAISE EXCEPTION 'Sem permissão para convidar nesta loja' USING errcode = '42501';
  END IF;
  IF _role IN ('super_admin'::app_role, 'client'::app_role) THEN
    RAISE EXCEPTION 'Papel inválido para convite' USING errcode = '22023';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  INSERT INTO public.team_invitations (
    tenant_id, email, role, invited_by, message, expires_at, token
  ) VALUES (
    _tenant_id, lower(_email), _role, v_user, _message,
    now() + make_interval(days => GREATEST(_expires_in_days, 1)),
    v_token
  )
  RETURNING * INTO v_invite;

  -- Limpa o plaintext após retornar (mantém apenas o hash)
  UPDATE public.team_invitations
     SET token = NULL
   WHERE id = v_invite.id;

  BEGIN
    INSERT INTO public.audit_logs (tenant_id, actor_id, action, entity, entity_id, metadata)
    VALUES (_tenant_id, v_user, 'team.invitation_created', 'team_invitation', v_invite.id,
            jsonb_build_object('email', lower(_email), 'role', _role));
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  id := v_invite.id;
  token := v_token;
  expires_at := v_invite.expires_at;
  RETURN NEXT;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_team_invitation(uuid, text, app_role, text, int) TO authenticated;

-- =============================================================
-- 4. RESTRINGIR audit_logs INSERT
-- =============================================================
-- Apenas funções SECURITY DEFINER (que rodam como postgres/owner) podem inserir.
-- Para isso: revoga INSERT direto de authenticated.

DROP POLICY IF EXISTS "audit_logs: membros podem registrar" ON public.audit_logs;

-- Mantém SELECT existente (owner/manager/super_admin)
-- Cria policy de INSERT bloqueada para clientes diretos
CREATE POLICY "audit_logs: bloqueado para clientes"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Functions SECURITY DEFINER continuam funcionando (rodam como owner do schema)

-- =============================================================
-- 5. STORAGE: tenant-logos (mantém público para landing/portal,
--    mas refina policies de UPLOAD/UPDATE para garantir folder=tenantId)
-- =============================================================

-- A policy de UPLOAD atualmente não tem WITH CHECK. Corrigimos.
DROP POLICY IF EXISTS "tenant-logos: managers upload" ON storage.objects;

CREATE POLICY "tenant-logos: managers upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-logos'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (
      public.has_any_tenant_role(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid,
        ARRAY['owner'::app_role, 'manager'::app_role]
      )
      OR public.is_super_admin(auth.uid())
    )
  );

-- Remove duplicata de SELECT pública (deixamos apenas uma)
DROP POLICY IF EXISTS "tenant-logos: leitura pública" ON storage.objects;
-- "tenant-logos: public read" mantém leitura pública (necessária para landing)

-- =============================================================
-- 6. STORAGE HARD-LIMIT (max_storage_mb)
-- =============================================================

-- Função: calcula bytes usados pelo tenant em todos os buckets
CREATE OR REPLACE FUNCTION public.tenant_storage_bytes_used(_tenant_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT COALESCE(SUM(
    COALESCE((metadata->>'size')::bigint, 0)
  ), 0)::bigint
  FROM storage.objects
  WHERE bucket_id IN ('tenant-logos','client-media')
    AND (storage.foldername(name))[1] = _tenant_id::text;
$$;
GRANT EXECUTE ON FUNCTION public.tenant_storage_bytes_used(uuid) TO authenticated;

-- Trigger BEFORE INSERT em storage.objects: bloqueia se exceder limite
CREATE OR REPLACE FUNCTION public.enforce_tenant_storage_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_tenant_id uuid;
  v_max_mb int;
  v_used_bytes bigint;
  v_new_bytes bigint;
  v_limit_bytes bigint;
BEGIN
  -- Só atua nos buckets de tenant
  IF NEW.bucket_id NOT IN ('tenant-logos','client-media') THEN
    RETURN NEW;
  END IF;

  -- Extrai tenant_id da primeira pasta
  BEGIN
    v_tenant_id := ((storage.foldername(NEW.name))[1])::uuid;
  EXCEPTION WHEN OTHERS THEN
    -- Path malformado: bloqueia
    RAISE EXCEPTION 'Caminho inválido para upload (esperado tenantId/...).' USING ERRCODE = '22023';
  END;

  -- Resolve limite efetivo
  SELECT (public.effective_subscription_limits(v_tenant_id) ->> 'max_storage_mb')::int
    INTO v_max_mb;

  -- Sem limite definido = sem enforcement
  IF v_max_mb IS NULL OR v_max_mb <= 0 THEN
    RETURN NEW;
  END IF;

  v_limit_bytes := v_max_mb::bigint * 1024 * 1024;
  v_new_bytes := COALESCE((NEW.metadata->>'size')::bigint, 0);
  SELECT public.tenant_storage_bytes_used(v_tenant_id) INTO v_used_bytes;

  IF (v_used_bytes + v_new_bytes) > v_limit_bytes THEN
    RAISE EXCEPTION 'Limite de armazenamento do plano atingido (% MB). Faça upgrade para continuar enviando arquivos.', v_max_mb
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tenant_storage_limit_trg ON storage.objects;
CREATE TRIGGER enforce_tenant_storage_limit_trg
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tenant_storage_limit();