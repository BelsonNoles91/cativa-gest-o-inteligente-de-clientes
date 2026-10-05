-- Histórico interno das verificações de segurança executadas por CI/QA.
-- Os relatórios nunca ficam legíveis pela API para anon/authenticated.
CREATE TABLE IF NOT EXISTS public.security_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('ci', 'local')),
  git_ref text,
  git_sha text,
  pull_request integer CHECK (pull_request IS NULL OR pull_request > 0),
  migrations text[] NOT NULL DEFAULT '{}',
  critical_count integer NOT NULL DEFAULT 0 CHECK (critical_count >= 0),
  warning_count integer NOT NULL DEFAULT 0 CHECK (warning_count >= 0),
  accepted_count integer NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  report_md text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.security_scan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.security_scans(id) ON DELETE CASCADE,
  check_id text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'warning')),
  object_name text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  accepted boolean NOT NULL DEFAULT false,
  accepted_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_scans_created_at_idx
  ON public.security_scans (created_at DESC);
CREATE INDEX IF NOT EXISTS security_scan_findings_scan_id_idx
  ON public.security_scan_findings (scan_id, created_at);

ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_scan_findings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.security_scans FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.security_scan_findings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON TABLE public.security_scans TO service_role;
GRANT SELECT, INSERT ON TABLE public.security_scan_findings TO service_role;

CREATE POLICY security_scans_service_role_only
  ON public.security_scans
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY security_scan_findings_service_role_only
  ON public.security_scan_findings
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);
