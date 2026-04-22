-- Habilita Realtime na tabela audit_logs para alimentar o sino de alertas
-- sensíveis do super admin (mudanças de role/status, super_admin toggle,
-- memberships e feature flags). Apenas super admins têm permissão de SELECT
-- via RLS, então a publicação não vaza dados para outros papéis.

ALTER TABLE public.audit_logs REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_logs;
  END IF;
END $$;