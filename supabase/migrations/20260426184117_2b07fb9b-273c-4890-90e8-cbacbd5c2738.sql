-- Atualizar preço do plano Empreendedor
update public.plans 
set price_cents = 4490 
where code = 'entrepreneur';

-- Atualizar preço do plano Studio
update public.plans 
set price_cents = 9490 
where code = 'studio';
