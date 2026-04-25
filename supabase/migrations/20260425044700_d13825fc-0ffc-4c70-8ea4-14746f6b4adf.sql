CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Adiciona restrição de exclusão para evitar sobreposição de horários por profissional
ALTER TABLE public.appointments
ADD CONSTRAINT appointments_pro_no_overlap
EXCLUDE USING gist (
  professional_id WITH =,
  tstzrange(starts_at, ends_at) WITH &&
)
WHERE (status != 'canceled');