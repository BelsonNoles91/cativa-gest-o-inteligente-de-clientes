-- Revoke public execute from sensitive functions
REVOKE EXECUTE ON FUNCTION public.redact_sensitive_data(JSONB) FROM public;
REVOKE EXECUTE ON FUNCTION public.get_audit_logs_advanced(UUID, UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, UUID, TIMESTAMP WITH TIME ZONE, TEXT) FROM public;

-- Grant execute only to authenticated users (or specific roles if needed)
GRANT EXECUTE ON FUNCTION public.redact_sensitive_data(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_audit_logs_advanced(UUID, UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, UUID, TIMESTAMP WITH TIME ZONE, TEXT) TO authenticated;

-- Ensure search_path is set to prevent hijacking
ALTER FUNCTION public.redact_sensitive_data(JSONB) SET search_path = public;
ALTER FUNCTION public.get_audit_logs_advanced(UUID, UUID, TEXT, TEXT, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE, INTEGER, UUID, TIMESTAMP WITH TIME ZONE, TEXT) SET search_path = public;
