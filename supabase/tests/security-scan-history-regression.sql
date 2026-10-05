-- Internal security-scan history is not exposed to anon/authenticated users.
-- The fixture and child row are always rolled back.
BEGIN;

DO $test$
DECLARE
  v_scan_id uuid;
  findings_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'security_scans' AND c.relrowsecurity
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'security_scan_findings' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'RLS precisa estar habilitada nas duas tabelas do histórico de segurança.';
  END IF;

  IF has_table_privilege('anon', 'public.security_scans', 'SELECT')
     OR has_table_privilege('anon', 'public.security_scans', 'INSERT')
     OR has_table_privilege('anon', 'public.security_scans', 'UPDATE')
     OR has_table_privilege('anon', 'public.security_scans', 'DELETE')
     OR has_table_privilege('authenticated', 'public.security_scans', 'SELECT')
     OR has_table_privilege('authenticated', 'public.security_scans', 'INSERT')
     OR has_table_privilege('authenticated', 'public.security_scans', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.security_scans', 'DELETE')
     OR has_table_privilege('anon', 'public.security_scan_findings', 'SELECT')
     OR has_table_privilege('anon', 'public.security_scan_findings', 'INSERT')
     OR has_table_privilege('anon', 'public.security_scan_findings', 'UPDATE')
     OR has_table_privilege('anon', 'public.security_scan_findings', 'DELETE')
     OR has_table_privilege('authenticated', 'public.security_scan_findings', 'SELECT')
     OR has_table_privilege('authenticated', 'public.security_scan_findings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.security_scan_findings', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.security_scan_findings', 'DELETE') THEN
    RAISE EXCEPTION 'anon/authenticated recebeu privilégio direto no histórico de segurança.';
  END IF;

  IF NOT has_table_privilege('service_role', 'public.security_scans', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.security_scans', 'INSERT')
     OR has_table_privilege('service_role', 'public.security_scans', 'UPDATE')
     OR has_table_privilege('service_role', 'public.security_scans', 'DELETE')
     OR NOT has_table_privilege('service_role', 'public.security_scan_findings', 'SELECT')
     OR NOT has_table_privilege('service_role', 'public.security_scan_findings', 'INSERT')
     OR has_table_privilege('service_role', 'public.security_scan_findings', 'UPDATE')
     OR has_table_privilege('service_role', 'public.security_scan_findings', 'DELETE') THEN
    RAISE EXCEPTION 'Os grants do service_role para o histórico de segurança estão incorretos.';
  END IF;

  INSERT INTO public.security_scans (source, critical_count, warning_count, accepted_count, report_md)
  VALUES ('local', 0, 0, 1, 'synthetic security scan regression')
  RETURNING id INTO v_scan_id;

  INSERT INTO public.security_scan_findings
    (scan_id, check_id, title, severity, object_name, details, accepted, accepted_reason)
  VALUES
    (v_scan_id, 'synthetic_check', 'Synthetic finding', 'warning', 'synthetic_object', '{"fixture":true}', true, 'test only');

  SELECT count(*) INTO findings_count
  FROM public.security_scan_findings
  WHERE security_scan_findings.scan_id = v_scan_id;

  IF findings_count <> 1 THEN
    RAISE EXCEPTION 'O finding de segurança não ficou associado ao scan sintético.';
  END IF;

  RAISE NOTICE 'Security scan history: RLS/grants restritos, gravação interna e relacionamento scan/finding aprovados.';
END;
$test$;

ROLLBACK;
