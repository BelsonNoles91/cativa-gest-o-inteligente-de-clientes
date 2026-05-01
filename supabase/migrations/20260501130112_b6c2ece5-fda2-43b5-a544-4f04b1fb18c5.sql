-- Habilitar RLS em audit_logs (caso não esteja)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para audit_logs
DROP POLICY IF EXISTS "Super admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Super admins can view all audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (auth.jwt() ->> 'role' = 'super_admin');

DROP POLICY IF EXISTS "Owners and managers can view their tenant audit logs" ON public.audit_logs;
CREATE POLICY "Owners and managers can view their tenant audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (
    tenant_id = (auth.jwt() ->> 'tenant_id')::uuid 
    AND (auth.jwt() ->> 'role' IN ('owner', 'manager'))
);

-- Função RPC para listagem avançada de auditoria com paginação e filtros
CREATE OR REPLACE FUNCTION public.get_audit_logs_advanced(
    _tenant_id UUID DEFAULT NULL,
    _actor_id UUID DEFAULT NULL,
    _action_prefix TEXT DEFAULT NULL,
    _entity TEXT DEFAULT NULL,
    _from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    _to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    _limit INTEGER DEFAULT 50,
    _offset INTEGER DEFAULT 0,
    _sort_order TEXT DEFAULT 'desc'
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    tenant_name TEXT,
    actor_id UUID,
    actor_name TEXT,
    actor_email TEXT,
    action TEXT,
    entity TEXT,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH filtered_logs AS (
        SELECT 
            al.id,
            al.tenant_id,
            t.name as tenant_name,
            al.actor_id,
            p.display_name as actor_name,
            au.email as actor_email,
            al.action,
            al.entity,
            al.entity_id,
            al.metadata,
            al.created_at
        FROM public.audit_logs al
        LEFT JOIN public.tenants t ON t.id = al.tenant_id
        LEFT JOIN public.profiles p ON p.user_id = al.actor_id
        LEFT JOIN auth.users au ON au.id = al.actor_id
        WHERE 
            (_tenant_id IS NULL OR al.tenant_id = _tenant_id) AND
            (_actor_id IS NULL OR al.actor_id = _actor_id) AND
            (_action_prefix IS NULL OR al.action LIKE _action_prefix || '%') AND
            (_entity IS NULL OR al.entity = _entity) AND
            (_from IS NULL OR al.created_at >= _from) AND
            (_to IS NULL OR al.created_at <= _to)
    ),
    total AS (
        SELECT count(*) as cnt FROM filtered_logs
    )
    SELECT 
        fl.*,
        total.cnt
    FROM filtered_logs fl, total
    ORDER BY 
        CASE WHEN _sort_order = 'asc' THEN fl.created_at END ASC,
        CASE WHEN _sort_order = 'desc' THEN fl.created_at END DESC
    LIMIT _limit
    OFFSET _offset;
END;
$$;
