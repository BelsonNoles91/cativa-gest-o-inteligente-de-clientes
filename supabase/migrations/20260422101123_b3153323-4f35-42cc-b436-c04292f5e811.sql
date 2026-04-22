ALTER TABLE public.professionals
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS specialty text,
  ADD COLUMN IF NOT EXISTS commission_pct numeric(5,2);

COMMENT ON COLUMN public.professionals.email IS 'E-mail de contato profissional (uso interno).';
COMMENT ON COLUMN public.professionals.phone IS 'Telefone de contato profissional (uso interno).';
COMMENT ON COLUMN public.professionals.specialty IS 'Especialidade/área de atuação principal.';
COMMENT ON COLUMN public.professionals.commission_pct IS 'Comissão padrão em % (0-100). Pode ser sobrescrita por regra futura.';

ALTER TABLE public.professionals
  DROP CONSTRAINT IF EXISTS professionals_commission_pct_range;

ALTER TABLE public.professionals
  ADD CONSTRAINT professionals_commission_pct_range
  CHECK (commission_pct IS NULL OR (commission_pct >= 0 AND commission_pct <= 100));