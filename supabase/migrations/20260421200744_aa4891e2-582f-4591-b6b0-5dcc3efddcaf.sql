-- =============================================================================
-- Cativa — Etapa 3 — CRM (clients, tags, notes, files, photos, timeline,
-- custom fields, consent forms) + Storage bucket
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
create type public.client_status as enum ('active', 'inactive', 'blocked');
create type public.client_risk_level as enum ('low', 'medium', 'high');
create type public.client_photo_type as enum ('before', 'after', 'general');
create type public.timeline_event_type as enum (
  'note', 'file', 'photo', 'consent', 'manual', 'status_change', 'appointment', 'system'
);
create type public.custom_field_type as enum ('text', 'number', 'date', 'boolean', 'select', 'multiselect', 'textarea');
create type public.consent_response_status as enum ('pending', 'signed', 'declined');

-- =============================================================================
-- CLIENTS
-- =============================================================================
create table public.clients (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  preferred_unit_id       uuid references public.units(id) on delete set null,
  preferred_professional_id uuid references public.professionals(id) on delete set null,
  referred_by_client_id   uuid references public.clients(id) on delete set null,

  full_name               text not null,
  email                   text,
  phone                   text,
  whatsapp_phone          text,
  birth_date              date,
  origin                  text,
  notes                   text,
  allergies               text,
  contraindications       text,
  preferences             text,

  status                  public.client_status not null default 'active',
  is_vip                  boolean not null default false,
  risk_level              public.client_risk_level not null default 'low',
  needs_reactivation      boolean not null default false,

  last_visit_at           timestamptz,
  next_visit_at           timestamptz,

  address_line1           text,
  address_line2           text,
  city                    text,
  state                   text,
  postal_code             text,
  country                 text default 'BR',

  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index clients_tenant_idx on public.clients(tenant_id);
create index clients_tenant_name_idx on public.clients(tenant_id, full_name);
create index clients_tenant_phone_idx on public.clients(tenant_id, phone);
create index clients_tenant_email_idx on public.clients(tenant_id, email);
create index clients_birthday_idx on public.clients(tenant_id, (extract(month from birth_date)), (extract(day from birth_date)));

create trigger clients_set_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

-- =============================================================================
-- CLIENT TAGS
-- =============================================================================
create table public.client_tags (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  color       text,
  created_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create index client_tags_tenant_idx on public.client_tags(tenant_id);

create table public.client_tag_relations (
  client_id   uuid not null references public.clients(id) on delete cascade,
  tag_id      uuid not null references public.client_tags(id) on delete cascade,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (client_id, tag_id)
);

create index client_tag_relations_tenant_idx on public.client_tag_relations(tenant_id);
create index client_tag_relations_tag_idx on public.client_tag_relations(tag_id);

-- =============================================================================
-- CLIENT NOTES
-- =============================================================================
create table public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  client_id   uuid not null references public.clients(id) on delete cascade,
  author_id   uuid references auth.users(id) on delete set null,
  body        text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index client_notes_client_idx on public.client_notes(client_id, created_at desc);
create index client_notes_tenant_idx on public.client_notes(tenant_id);

create trigger client_notes_set_updated_at
before update on public.client_notes
for each row execute function public.set_updated_at();

-- =============================================================================
-- CLIENT FILES
-- =============================================================================
create table public.client_files (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  uploaded_by   uuid references auth.users(id) on delete set null,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    integer,
  description   text,
  created_at    timestamptz not null default now()
);

create index client_files_client_idx on public.client_files(client_id, created_at desc);
create index client_files_tenant_idx on public.client_files(tenant_id);

-- =============================================================================
-- CLIENT PHOTOS (com par antes/depois)
-- =============================================================================
create table public.client_photos (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  uploaded_by   uuid references auth.users(id) on delete set null,
  storage_path  text not null,
  photo_type    public.client_photo_type not null default 'general',
  pair_id       uuid,
  caption       text,
  taken_at      timestamptz,
  created_at    timestamptz not null default now()
);

create index client_photos_client_idx on public.client_photos(client_id, created_at desc);
create index client_photos_pair_idx on public.client_photos(pair_id);
create index client_photos_tenant_idx on public.client_photos(tenant_id);

-- =============================================================================
-- TIMELINE EVENTS
-- =============================================================================
create table public.client_timeline_events (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  actor_id      uuid references auth.users(id) on delete set null,
  event_type    public.timeline_event_type not null,
  title         text not null,
  description   text,
  reference_id  uuid,
  metadata      jsonb not null default '{}'::jsonb,
  occurred_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index timeline_client_idx on public.client_timeline_events(client_id, occurred_at desc);
create index timeline_tenant_idx on public.client_timeline_events(tenant_id);

-- =============================================================================
-- CUSTOM FIELDS
-- =============================================================================
create table public.custom_field_definitions (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  entity        text not null default 'client',
  key           text not null,
  label         text not null,
  field_type    public.custom_field_type not null,
  options       jsonb not null default '[]'::jsonb,
  is_required   boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, entity, key)
);

create index custom_field_defs_tenant_idx on public.custom_field_definitions(tenant_id, entity, position);

create trigger custom_field_definitions_set_updated_at
before update on public.custom_field_definitions
for each row execute function public.set_updated_at();

create table public.client_custom_field_values (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  client_id     uuid not null references public.clients(id) on delete cascade,
  definition_id uuid not null references public.custom_field_definitions(id) on delete cascade,
  value         jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (client_id, definition_id)
);

create index client_cfv_client_idx on public.client_custom_field_values(client_id);
create index client_cfv_tenant_idx on public.client_custom_field_values(tenant_id);

create trigger client_cfv_set_updated_at
before update on public.client_custom_field_values
for each row execute function public.set_updated_at();

-- =============================================================================
-- CONSENT FORMS
-- =============================================================================
create table public.consent_form_templates (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  title         text not null,
  body          text not null,
  is_active     boolean not null default true,
  version       integer not null default 1,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index consent_templates_tenant_idx on public.consent_form_templates(tenant_id);

create trigger consent_form_templates_set_updated_at
before update on public.consent_form_templates
for each row execute function public.set_updated_at();

create table public.consent_form_responses (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  client_id       uuid not null references public.clients(id) on delete cascade,
  template_id     uuid not null references public.consent_form_templates(id) on delete restrict,
  template_version integer not null default 1,
  status          public.consent_response_status not null default 'pending',
  signed_text     text,
  signed_name     text,
  signed_at       timestamptz,
  signed_by       uuid references auth.users(id) on delete set null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index consent_responses_client_idx on public.consent_form_responses(client_id, created_at desc);
create index consent_responses_tenant_idx on public.consent_form_responses(tenant_id);

create trigger consent_form_responses_set_updated_at
before update on public.consent_form_responses
for each row execute function public.set_updated_at();

-- =============================================================================
-- ENABLE RLS
-- =============================================================================
alter table public.clients                     enable row level security;
alter table public.client_tags                 enable row level security;
alter table public.client_tag_relations        enable row level security;
alter table public.client_notes                enable row level security;
alter table public.client_files                enable row level security;
alter table public.client_photos               enable row level security;
alter table public.client_timeline_events      enable row level security;
alter table public.custom_field_definitions    enable row level security;
alter table public.client_custom_field_values  enable row level security;
alter table public.consent_form_templates      enable row level security;
alter table public.consent_form_responses      enable row level security;

-- -----------------------------------------------------------------------------
-- POLICIES
-- Padrão:
--   SELECT  → qualquer membro ativo do tenant
--   INSERT/UPDATE/DELETE → owner/manager/frontdesk/professional (operação)
--                          owner/manager apenas (configuração)
-- Super admin sempre passa.
-- -----------------------------------------------------------------------------

-- ---------- clients ----------
create policy "clients: membros leem"
on public.clients for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "clients: equipe gerencia"
on public.clients for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_tags ----------
create policy "client_tags: membros leem"
on public.client_tags for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_tags: equipe gerencia"
on public.client_tags for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_tag_relations ----------
create policy "client_tag_relations: membros leem"
on public.client_tag_relations for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_tag_relations: equipe gerencia"
on public.client_tag_relations for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_notes ----------
create policy "client_notes: membros leem"
on public.client_notes for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_notes: equipe escreve"
on public.client_notes for insert to authenticated
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "client_notes: autor ou gestor edita"
on public.client_notes for update to authenticated
using (
  author_id = auth.uid()
  or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  author_id = auth.uid()
  or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "client_notes: autor ou gestor remove"
on public.client_notes for delete to authenticated
using (
  author_id = auth.uid()
  or public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_files ----------
create policy "client_files: membros leem"
on public.client_files for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_files: equipe gerencia"
on public.client_files for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_photos ----------
create policy "client_photos: membros leem"
on public.client_photos for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_photos: equipe gerencia"
on public.client_photos for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_timeline_events ----------
create policy "timeline: membros leem"
on public.client_timeline_events for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "timeline: equipe registra"
on public.client_timeline_events for insert to authenticated
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

create policy "timeline: gestor remove"
on public.client_timeline_events for delete to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- custom_field_definitions ----------
create policy "custom_field_defs: membros leem"
on public.custom_field_definitions for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "custom_field_defs: gestor configura"
on public.custom_field_definitions for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- client_custom_field_values ----------
create policy "client_cfv: membros leem"
on public.client_custom_field_values for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "client_cfv: equipe gerencia"
on public.client_custom_field_values for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- consent_form_templates ----------
create policy "consent_templates: membros leem"
on public.consent_form_templates for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "consent_templates: gestor configura"
on public.consent_form_templates for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- ---------- consent_form_responses ----------
create policy "consent_responses: membros leem"
on public.consent_form_responses for select to authenticated
using (public.is_tenant_member(auth.uid(), tenant_id) or public.is_super_admin(auth.uid()));

create policy "consent_responses: equipe gerencia"
on public.consent_form_responses for all to authenticated
using (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
)
with check (
  public.has_any_tenant_role(auth.uid(), tenant_id, array['owner','manager','frontdesk','professional']::public.app_role[])
  or public.is_super_admin(auth.uid())
);

-- =============================================================================
-- STORAGE BUCKET (privado): client-media
-- Estrutura de path: {tenant_id}/{client_id}/{uuid}-{filename}
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('client-media', 'client-media', false)
on conflict (id) do nothing;

-- Helper: extrair tenant_id do primeiro segmento do path
-- (storage.foldername(name) retorna text[]; o primeiro elemento é o tenant)

create policy "client-media: membros leem"
on storage.objects for select to authenticated
using (
  bucket_id = 'client-media'
  and (
    public.is_tenant_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
    or public.is_super_admin(auth.uid())
  )
);

create policy "client-media: equipe envia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'client-media'
  and (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      array['owner','manager','frontdesk','professional']::public.app_role[]
    )
    or public.is_super_admin(auth.uid())
  )
);

create policy "client-media: equipe atualiza"
on storage.objects for update to authenticated
using (
  bucket_id = 'client-media'
  and (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      array['owner','manager','frontdesk','professional']::public.app_role[]
    )
    or public.is_super_admin(auth.uid())
  )
);

create policy "client-media: equipe remove"
on storage.objects for delete to authenticated
using (
  bucket_id = 'client-media'
  and (
    public.has_any_tenant_role(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      array['owner','manager','frontdesk','professional']::public.app_role[]
    )
    or public.is_super_admin(auth.uid())
  )
);
