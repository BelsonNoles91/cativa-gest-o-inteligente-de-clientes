update public.plans
set metadata = metadata || '{"cta_label": "Começar grátis"}'::jsonb,
    updated_at = now()
where code = 'comeco';