-- Create the initial tenant workspace as one atomic, authenticated operation.
-- This avoids the RLS bootstrap deadlock where the first owner membership
-- cannot be inserted until after a tenant is visible to its members.
DROP FUNCTION IF EXISTS public.create_tenant_with_owner(
  text, text, public.tenant_segment, text, text, text, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
  p_name text,
  p_slug text,
  p_segment public.tenant_segment,
  p_unit_name text,
  p_timezone text DEFAULT 'America/Sao_Paulo',
  p_currency text DEFAULT 'BRL',
  p_unit_phone text DEFAULT NULL,
  p_brand_primary text DEFAULT NULL,
  p_brand_secondary text DEFAULT NULL,
  p_brand_accent text DEFAULT NULL,
  p_whatsapp_phone text DEFAULT NULL,
  p_initial_professionals jsonb DEFAULT '[]'::jsonb,
  p_initial_services jsonb DEFAULT '[]'::jsonb
)
RETURNS TABLE (tenant_id uuid, unit_id uuid, slug text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_base_slug text;
  v_candidate_slug text;
  v_suffix integer := 1;
  v_tenant_id uuid;
  v_unit_id uuid;
  v_item jsonb;
  v_item_name text;
  v_price_text text;
  v_price numeric;
  v_service_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sessão não encontrada. Faça login novamente.'
      USING ERRCODE = '42501';
  END IF;

  IF nullif(btrim(p_name), '') IS NULL OR length(btrim(p_name)) > 120 THEN
    RAISE EXCEPTION 'O nome do estabelecimento deve conter entre 1 e 120 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_unit_name), '') IS NULL OR length(btrim(p_unit_name)) > 120 THEN
    RAISE EXCEPTION 'O nome da unidade deve conter entre 1 e 120 caracteres.'
      USING ERRCODE = '22023';
  END IF;
  IF nullif(btrim(p_timezone), '') IS NULL OR length(btrim(p_timezone)) > 64 THEN
    RAISE EXCEPTION 'Fuso horário inválido.' USING ERRCODE = '22023';
  END IF;
  IF p_currency IS NULL OR upper(btrim(p_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'Moeda inválida.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce(p_initial_professionals, '[]'::jsonb)) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A lista inicial de profissionais deve ser um array JSON.'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(coalesce(p_initial_professionals, '[]'::jsonb)) > 100 THEN
    RAISE EXCEPTION 'A lista inicial de profissionais é inválida ou excede 100 itens.'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(coalesce(p_initial_services, '[]'::jsonb)) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A lista inicial de serviços deve ser um array JSON.'
      USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(coalesce(p_initial_services, '[]'::jsonb)) > 100 THEN
    RAISE EXCEPTION 'A lista inicial de serviços é inválida ou excede 100 itens.'
      USING ERRCODE = '22023';
  END IF;

  -- Normalize the client-provided slug again on the server. The client is
  -- untrusted; the unique constraint below remains the final concurrency guard.
  v_base_slug := left(
    trim(both '-' FROM lower(regexp_replace(coalesce(p_slug, ''), '[^a-zA-Z0-9]+', '-', 'g'))),
    60
  );
  IF v_base_slug = '' THEN
    v_base_slug := 'cativa-' || left(replace(gen_random_uuid()::text, '-', ''), 12);
  END IF;

  -- Retry only slug collisions. A subtransaction rolls back each failed
  -- candidate insert while keeping the remainder of this function atomic.
  LOOP
    v_candidate_slug := CASE
      WHEN v_suffix = 1 THEN v_base_slug
      ELSE left(v_base_slug, 60 - length(v_suffix::text) - 1) || '-' || v_suffix::text
    END;

    BEGIN
      INSERT INTO public.tenants (
        name, slug, segment, timezone, currency, created_by, trial_ends_at
      ) VALUES (
        btrim(p_name), v_candidate_slug, p_segment, btrim(p_timezone),
        upper(btrim(p_currency)), v_user_id, now() + interval '14 days'
      )
      RETURNING id INTO v_tenant_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_suffix := v_suffix + 1;
      IF v_suffix > 10000 THEN
        RAISE EXCEPTION 'Não foi possível gerar um identificador único para o estabelecimento.'
          USING ERRCODE = '23505';
      END IF;
    END;
  END LOOP;

  INSERT INTO public.tenant_memberships (
    tenant_id, user_id, role, status, accepted_at
  ) VALUES (
    v_tenant_id, v_user_id, 'owner', 'active', now()
  );

  -- New workspaces are marked trialing during onboarding; create the matching
  -- subscription in the same transaction so the app does not block the owner.
  PERFORM public.start_default_trial(v_tenant_id);

  INSERT INTO public.units (tenant_id, name, is_default, phone)
  VALUES (v_tenant_id, btrim(p_unit_name), true, nullif(btrim(p_unit_phone), ''))
  RETURNING id INTO v_unit_id;

  INSERT INTO public.tenant_settings (
    tenant_id, brand_primary, brand_secondary, brand_accent,
    whatsapp_phone, default_unit_id
  ) VALUES (
    v_tenant_id, nullif(btrim(p_brand_primary), ''),
    nullif(btrim(p_brand_secondary), ''), nullif(btrim(p_brand_accent), ''),
    nullif(btrim(p_whatsapp_phone), ''), v_unit_id
  );

  INSERT INTO public.unit_settings (unit_id, tenant_id)
  VALUES (v_unit_id, v_tenant_id);

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_initial_professionals, '[]'::jsonb))
  LOOP
    v_item_name := nullif(btrim(v_item->>'name'), '');
    IF jsonb_typeof(v_item) <> 'object' OR v_item_name IS NULL OR length(v_item_name) > 120 THEN
      RAISE EXCEPTION 'Cada profissional inicial precisa ter um nome de até 120 caracteres.'
        USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.professionals (tenant_id, unit_id, display_name, is_active)
    VALUES (v_tenant_id, v_unit_id, v_item_name, true);
  END LOOP;

  FOR v_item IN SELECT value FROM jsonb_array_elements(coalesce(p_initial_services, '[]'::jsonb))
  LOOP
    v_item_name := nullif(btrim(v_item->>'name'), '');
    v_price_text := nullif(btrim(v_item->>'price'), '');
    IF jsonb_typeof(v_item) <> 'object' OR v_item_name IS NULL OR length(v_item_name) > 120 THEN
      RAISE EXCEPTION 'Cada serviço inicial precisa ter um nome de até 120 caracteres.'
        USING ERRCODE = '22023';
    END IF;
    IF v_price_text IS NULL THEN
      RAISE EXCEPTION 'Cada serviço inicial precisa ter um preço válido.'
        USING ERRCODE = '22023';
    END IF;
    BEGIN
      v_price := v_price_text::numeric;
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'O preço do serviço inicial é inválido.' USING ERRCODE = '22023';
    END;
    IF v_price < 0 OR v_price > 21474836.47 THEN
      RAISE EXCEPTION 'O preço do serviço inicial está fora do limite permitido.'
        USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.services (tenant_id, name, duration_minutes, is_active)
    VALUES (v_tenant_id, v_item_name, 30, true)
    RETURNING id INTO v_service_id;

    INSERT INTO public.service_prices (
      tenant_id, service_id, amount_cents, currency, is_default
    ) VALUES (
      v_tenant_id, v_service_id, round(v_price * 100)::integer,
      upper(btrim(p_currency)), true
    );
  END LOOP;

  INSERT INTO public.audit_logs (
    tenant_id, actor_id, action, entity, entity_id, metadata
  ) VALUES (
    v_tenant_id, v_user_id, 'tenant.created', 'tenant', v_tenant_id,
    jsonb_build_object(
      'name', btrim(p_name), 'segment', p_segment::text,
      'initial_professionals', jsonb_array_length(coalesce(p_initial_professionals, '[]'::jsonb)),
      'initial_services', jsonb_array_length(coalesce(p_initial_services, '[]'::jsonb))
    )
  );

  RETURN QUERY SELECT v_tenant_id, v_unit_id, v_candidate_slug;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_tenant_with_owner(
  text, text, public.tenant_segment, text, text, text, text, text, text, text, text, jsonb, jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner(
  text, text, public.tenant_segment, text, text, text, text, text, text, text, text, jsonb, jsonb
) TO authenticated;
