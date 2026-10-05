-- Enforce upload types and logo size at the Storage API boundary. These are
-- bucket constraints (not direct writes to storage.objects metadata).

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]::text[]
WHERE id = 'client-media';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[],
    file_size_limit = 2097152
WHERE id = 'tenant-logos';

DO $buckets$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'client-media'
      AND 'application/pdf' = ANY(allowed_mime_types)
      AND 'image/webp' = ANY(allowed_mime_types)
      AND NOT ('text/html' = ANY(allowed_mime_types))
      AND NOT ('image/svg+xml' = ANY(allowed_mime_types))
  ) THEN
    RAISE EXCEPTION 'Bucket client-media ausente ou sem allowlist MIME segura.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets
    WHERE id = 'tenant-logos'
      AND allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
      AND file_size_limit = 2097152
  ) THEN
    RAISE EXCEPTION 'Bucket tenant-logos ausente ou com restrições de MIME/tamanho inesperadas.';
  END IF;
END;
$buckets$;
