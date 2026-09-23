CREATE OR REPLACE FUNCTION public.get_public_tenant_page(_slug text)
 RETURNS TABLE(tenant_id uuid, name text, slug text, segment text, headline text, about text, cover_url text, logo_url text, whatsapp text, instagram text, website text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select t.id, t.name, t.slug, t.segment::text,
         p.headline, p.about, p.cover_url, s.logo_url,
         p.whatsapp, p.instagram, p.website
  from public.tenants t
  join public.tenant_public_pages p on p.tenant_id = t.id
  left join public.tenant_settings s on s.tenant_id = t.id
  where t.slug = _slug
    and p.is_published = true
    and t.status in ('active','trialing')
  limit 1;
$function$;