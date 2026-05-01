-- System Status Table
CREATE TABLE IF NOT EXISTS public.system_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    component_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('operational', 'degraded', 'partial_outage', 'major_outage')),
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Maintenance/Incidents Table
CREATE TABLE IF NOT EXISTS public.system_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    affected_components TEXT[],
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_incidents ENABLE ROW LEVEL SECURITY;

-- Policies for system_status
CREATE POLICY "Status viewable by everyone" ON public.system_status FOR SELECT USING (true);
CREATE POLICY "Status manageable by super admins" ON public.system_status 
    USING (auth.jwt() ->> 'role' = 'super_admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Policies for system_incidents
CREATE POLICY "Incidents viewable by everyone" ON public.system_incidents FOR SELECT USING (true);
CREATE POLICY "Incidents manageable by super admins" ON public.system_incidents 
    USING (auth.jwt() ->> 'role' = 'super_admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'super_admin');

-- Audit Logs Table (Enhancement if needed)
-- Assuming audit_logs already exists from previous check, but ensuring it has the right structure
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'tenant_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN tenant_id UUID REFERENCES public.tenants(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'user_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Initial Status Data
INSERT INTO public.system_status (component_name, status) VALUES 
('API Gateway', 'operational'),
('Database', 'operational'),
('Authentication', 'operational'),
('File Storage', 'operational')
ON CONFLICT DO NOTHING;
