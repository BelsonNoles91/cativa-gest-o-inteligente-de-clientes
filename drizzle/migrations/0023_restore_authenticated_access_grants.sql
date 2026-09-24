-- Restore only the Data API privileges required by signed-in application flows.
-- RLS policies remain authoritative for which rows each user may access.
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.appointments TO authenticated;
GRANT ALL ON TABLE public.appointments TO service_role;