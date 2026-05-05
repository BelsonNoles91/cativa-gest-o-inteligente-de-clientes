-- Migração para histórico de senhas e reset forçado por Super Admin

CREATE TABLE IF NOT EXISTS public.password_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  password_hash text not null,
  created_at timestamptz default now() not null
);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON public.password_history(user_id);

ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;
-- Apenas sistema/RPCs vão ler ou escrever nessa tabela. Sem policies públicas.

CREATE OR REPLACE FUNCTION public.admin_force_reset_password(target_user_id uuid, new_raw_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas Super Admins.';
  END IF;

  -- Atualiza a senha no Supabase e marca que precisa mudar
  UPDATE auth.users
  SET encrypted_password = crypt(new_raw_password, gen_salt('bf')),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"force_password_reset": true}'::jsonb
  WHERE id = target_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_change_password_with_history(new_raw_password text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_history_record record;
  v_is_reused boolean := false;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Verifica histórico (últimas 5 senhas)
  FOR v_history_record IN 
    SELECT password_hash FROM public.password_history 
    WHERE user_id = v_uid 
    ORDER BY created_at DESC 
    LIMIT 5
  LOOP
    IF v_history_record.password_hash = crypt(new_raw_password, v_history_record.password_hash) THEN
      v_is_reused := true;
      EXIT;
    END IF;
  END LOOP;

  IF v_is_reused THEN
    RAISE EXCEPTION 'REUSED_PASSWORD';
  END IF;

  -- Salva no histórico
  INSERT INTO public.password_history (user_id, password_hash)
  VALUES (v_uid, crypt(new_raw_password, gen_salt('bf')));

  -- Atualiza no auth.users e remove o flag de force reset
  UPDATE auth.users
  SET encrypted_password = crypt(new_raw_password, gen_salt('bf')),
      raw_app_meta_data = raw_app_meta_data - 'force_password_reset'
  WHERE id = v_uid;
END;
$$;
