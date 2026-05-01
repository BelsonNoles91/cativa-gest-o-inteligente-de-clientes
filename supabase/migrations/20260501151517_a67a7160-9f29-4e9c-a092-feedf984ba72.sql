-- Create a helper function for redacting sensitive fields in JSONB
CREATE OR REPLACE FUNCTION public.redact_sensitive_data(input_data JSONB)
RETURNS JSONB AS $$
DECLARE
    key TEXT;
    value JSONB;
    result JSONB := '{}'::JSONB;
    sensitive_keys TEXT[] := ARRAY['password', 'token', 'secret', 'key', 'email', 'phone', 'mobile', 'cpf', 'cnpj', 'cvv', 'card_number', 'auth_token', 'session_id'];
BEGIN
    IF input_data IS NULL THEN
        RETURN NULL;
    END IF;

    IF jsonb_typeof(input_data) != 'object' THEN
        RETURN input_data;
    END IF;

    FOR key, value IN SELECT * FROM jsonb_each(input_data)
    LOOP
        -- Check if key is sensitive (case-insensitive)
        IF LOWER(key) = ANY(sensitive_keys) OR key ~* '.*(password|token|secret|key|email|phone|mobile|cpf|cnpj|cvv|card).*' THEN
            result := result || jsonb_build_object(key, '[REDACTED]');
        ELSIF jsonb_typeof(value) = 'object' THEN
            result := result || jsonb_build_object(key, public.redact_sensitive_data(value));
        ELSIF jsonb_typeof(value) = 'array' THEN
            result := result || jsonb_build_object(key, value);
        ELSE
            result := result || jsonb_build_object(key, value);
        END IF;
    END LOOP;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update get_audit_logs_advanced
CREATE OR REPLACE FUNCTION public.get_audit_logs_advanced(
    _tenant_id UUID DEFAULT NULL,
    _actor_id UUID DEFAULT NULL,
    _action_prefix TEXT DEFAULT NULL,
    _entity TEXT DEFAULT NULL,
    _from TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    _to TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    _limit INTEGER DEFAULT 50,
    _cursor_id UUID DEFAULT NULL,
    _cursor_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NULL,
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
) AS $$
DECLARE
    _total_count BIGINT;
BEGIN
    SELECT count(*) INTO _total_count
    FROM public.audit_logs al
    WHERE 
        (_tenant_id IS NULL OR al.tenant_id = _tenant_id) AND
        (_actor_id IS NULL OR al.actor_id = _actor_id) AND
        (_action_prefix IS NULL OR al.action LIKE _action_prefix || '%') AND
        (_entity IS NULL OR al.entity = _entity) AND
        (_from IS NULL OR al.created_at >= _from) AND
        (_to IS NULL OR al.created_at <= _to);

    RETURN QUERY
    WITH filtered_logs AS (
        SELECT 
            al.id,
            al.tenant_id,
            t.name as tenant_name,
            al.actor_id,
            p.full_name as actor_name,
            au.email as actor_email,
            al.action,
            al.entity,
            al.entity_id,
            public.redact_sensitive_data(al.metadata) as metadata,
            al.created_at
        FROM public.audit_logs al
        LEFT JOIN public.tenants t ON t.id = al.tenant_id
        LEFT JOIN public.profiles p ON p.id = al.actor_id
        LEFT JOIN auth.users au ON au.id = al.actor_id
        WHERE 
            (_tenant_id IS NULL OR al.tenant_id = _tenant_id) AND
            (_actor_id IS NULL OR al.actor_id = _actor_id) AND
            (_action_prefix IS NULL OR al.action LIKE _action_prefix || '%') AND
            (_entity IS NULL OR al.entity = _entity) AND
            (_from IS NULL OR al.created_at >= _from) AND
            (_to IS NULL OR al.created_at <= _to) AND
            (
                _cursor_id IS NULL OR 
                (
                    CASE WHEN _sort_order = 'desc' THEN
                        (al.created_at < _cursor_timestamp) OR (al.created_at = _cursor_timestamp AND al.id < _cursor_id)
                    ELSE
                        (al.created_at > _cursor_timestamp) OR (al.created_at = _cursor_timestamp AND al.id > _cursor_id)
                    END
                )
            )
        ORDER BY 
            CASE WHEN _sort_order = 'asc' THEN al.created_at END ASC,
            CASE WHEN _sort_order = 'asc' THEN al.id END ASC,
            CASE WHEN _sort_order = 'desc' THEN al.created_at END DESC,
            CASE WHEN _sort_order = 'desc' THEN al.id END DESC
        LIMIT _limit
    )
    SELECT 
        fl.*,
        _total_count
    FROM filtered_logs fl;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
