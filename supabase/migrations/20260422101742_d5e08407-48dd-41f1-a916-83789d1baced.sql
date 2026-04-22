-- Bucket público para logos dos tenants
INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-logos', 'tenant-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública (a UI exibe o logo no portal e em links externos)
DROP POLICY IF EXISTS "tenant-logos: public read" ON storage.objects;
CREATE POLICY "tenant-logos: public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'tenant-logos');

-- Upload: apenas owner/manager do tenant cuja UUID é a primeira pasta do path
DROP POLICY IF EXISTS "tenant-logos: managers upload" ON storage.objects;
CREATE POLICY "tenant-logos: managers upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::app_role, 'manager'::app_role]
    )
    OR public.is_super_admin(auth.uid())
  )
);

-- Update: idem
DROP POLICY IF EXISTS "tenant-logos: managers update" ON storage.objects;
CREATE POLICY "tenant-logos: managers update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::app_role, 'manager'::app_role]
    )
    OR public.is_super_admin(auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'tenant-logos'
  AND (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::app_role, 'manager'::app_role]
    )
    OR public.is_super_admin(auth.uid())
  )
);

-- Delete: idem
DROP POLICY IF EXISTS "tenant-logos: managers delete" ON storage.objects;
CREATE POLICY "tenant-logos: managers delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tenant-logos'
  AND (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      ARRAY['owner'::app_role, 'manager'::app_role]
    )
    OR public.is_super_admin(auth.uid())
  )
);