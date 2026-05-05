-- Remove planos "Empreendedor" excedentes/duplicados, mantendo apenas o registro original
DELETE FROM public.plans 
WHERE name = 'Empreendedor' 
  AND id NOT IN (
    SELECT id FROM public.plans WHERE name = 'Empreendedor' ORDER BY created_at ASC LIMIT 1
  );

-- Remove ou esconde planos "Enterprise" duplicados do seed para não sujar a UI
DELETE FROM public.plans WHERE name = 'Enterprise' OR name = 'Pro';

-- Garante que os preços estejam perfeitamente alinhados com o Marketing (Landing)
UPDATE public.plans SET price_cents = 4490 WHERE name = 'Empreendedor';
UPDATE public.plans SET price_cents = 9490 WHERE name = 'Studio';
