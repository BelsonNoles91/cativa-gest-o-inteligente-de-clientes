CREATE TABLE public.security_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'local',
  git_ref text,
  git_sha text,
  pull_request integer,
  migrations text[] NOT NULL DEFAULT '{}',
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  accepted_count integer NOT NULL DEFAULT 0,
  report_md text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE TABLE public.security_scan_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.security_scans(id) ON DELETE CASCADE,
  check_id text NOT NULL,
  title text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical','warning')),
  object_name text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  accepted boolean NOT NULL DEFAULT false,
  accepted_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_security_scans_created_at ON public.security_scans (created_at DESC);
CREATE INDEX idx_security_scan_findings_scan ON public.security_scan_findings (scan_id);
CREATE INDEX idx_security_scan_findings_check ON public.security_scan_findings (check_id);

GRANT SELECT ON public.security_scans TO authenticated;
GRANT SELECT ON public.security_scan_findings TO authenticated;
GRANT ALL ON public.security_scans TO service_role;
GRANT ALL ON public.security_scan_findings TO service_role;

ALTER TABLE public.security_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_scan_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "security_scans: super admin le"
  ON public.security_scans FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "security_scan_findings: super admin le"
  ON public.security_scan_findings FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));