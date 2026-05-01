-- Endurecimento de segurança para as funções de retenção
ALTER FUNCTION public.update_client_retention_metrics(UUID) SET search_path = public;
ALTER FUNCTION public.on_appointment_status_change() SET search_path = public;

-- Revoga execução pública e garante apenas para autenticados e service_role
REVOKE EXECUTE ON FUNCTION public.update_client_retention_metrics(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_client_retention_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_client_retention_metrics(UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.on_appointment_status_change() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_appointment_status_change() TO authenticated;
GRANT EXECUTE ON FUNCTION public.on_appointment_status_change() TO service_role;
