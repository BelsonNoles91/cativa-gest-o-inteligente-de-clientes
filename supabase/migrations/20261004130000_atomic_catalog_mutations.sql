-- Catalog parent/child writes must be one database transaction. These RPCs
-- remain SECURITY INVOKER so the existing RLS policies still apply.

CREATE OR REPLACE FUNCTION public.catalog_create_service_with_price(
  _service jsonb,
  _amount_cents integer,
  _currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_service public.services%ROWTYPE;
  v_currency text := upper(btrim(_currency));
BEGIN
  IF _service IS NULL OR jsonb_typeof(_service) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Os dados do serviço devem ser um objeto JSON.' USING ERRCODE = '22023';
  END IF;
  v_tenant_id := (_service ->> 'tenant_id')::uuid;
  IF v_tenant_id IS NULL OR v_actor IS NULL OR NOT (
    public.is_super_admin(v_actor)
    OR public.has_any_tenant_role(
      v_actor, v_tenant_id, ARRAY['owner'::public.app_role, 'manager'::public.app_role]
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o catálogo deste tenant.' USING ERRCODE = '42501';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents < 0 THEN
    RAISE EXCEPTION 'O preço-base deve ser um valor não negativo.' USING ERRCODE = '22023';
  END IF;
  IF v_currency IS NULL OR v_currency !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'A moeda deve usar um código ISO de três letras.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.services (
    tenant_id, category_id, cancellation_policy_id, name, description, internal_code,
    duration_minutes, buffer_before_minutes, buffer_after_minutes, processing_minutes,
    min_advance_hours, max_advance_days, ideal_return_window_days, requires_resource,
    resource_label, eligible_for_package, eligible_for_membership,
    pre_appointment_instructions, post_appointment_instructions, is_active, is_featured
  ) VALUES (
    v_tenant_id,
    (_service ->> 'category_id')::uuid,
    (_service ->> 'cancellation_policy_id')::uuid,
    _service ->> 'name',
    _service ->> 'description',
    _service ->> 'internal_code',
    COALESCE((_service ->> 'duration_minutes')::integer, 30),
    COALESCE((_service ->> 'buffer_before_minutes')::integer, 0),
    COALESCE((_service ->> 'buffer_after_minutes')::integer, 0),
    COALESCE((_service ->> 'processing_minutes')::integer, 0),
    COALESCE((_service ->> 'min_advance_hours')::integer, 0),
    COALESCE((_service ->> 'max_advance_days')::integer, 60),
    (_service ->> 'ideal_return_window_days')::integer,
    COALESCE((_service ->> 'requires_resource')::boolean, false),
    _service ->> 'resource_label',
    COALESCE((_service ->> 'eligible_for_package')::boolean, true),
    COALESCE((_service ->> 'eligible_for_membership')::boolean, true),
    _service ->> 'pre_appointment_instructions',
    _service ->> 'post_appointment_instructions',
    COALESCE((_service ->> 'is_active')::boolean, true),
    COALESCE((_service ->> 'is_featured')::boolean, false)
  ) RETURNING * INTO v_service;

  INSERT INTO public.service_prices (tenant_id, service_id, currency, amount_cents, is_default)
  VALUES (v_tenant_id, v_service.id, v_currency, _amount_cents, true);

  RETURN to_jsonb(v_service);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_update_service_with_price(
  _service_id uuid,
  _patch jsonb,
  _amount_cents integer,
  _currency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_service public.services%ROWTYPE;
  v_price_id uuid;
  v_currency text;
BEGIN
  IF _patch IS NULL OR jsonb_typeof(_patch) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Os dados do serviço devem ser um objeto JSON.' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_service FROM public.services WHERE id = _service_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Serviço não encontrado.' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor IS NULL OR NOT (
    public.is_super_admin(v_actor)
    OR public.has_any_tenant_role(
      v_actor, v_service.tenant_id, ARRAY['owner'::public.app_role, 'manager'::public.app_role]
    )
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o catálogo deste tenant.' USING ERRCODE = '42501';
  END IF;
  IF _patch ? 'tenant_id' AND (_patch ->> 'tenant_id')::uuid <> v_service.tenant_id THEN
    RAISE EXCEPTION 'O serviço não pode ser reatribuído a outro tenant.' USING ERRCODE = '23514';
  END IF;
  IF _amount_cents IS NULL OR _amount_cents < 0 THEN
    RAISE EXCEPTION 'O preço-base deve ser um valor não negativo.' USING ERRCODE = '22023';
  END IF;
  IF _currency IS NOT NULL AND upper(btrim(_currency)) !~ '^[A-Z]{3}$' THEN
    RAISE EXCEPTION 'A moeda deve usar um código ISO de três letras.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.services SET
    name = CASE WHEN _patch ? 'name' THEN _patch ->> 'name' ELSE name END,
    description = CASE WHEN _patch ? 'description' THEN _patch ->> 'description' ELSE description END,
    category_id = CASE WHEN _patch ? 'category_id' THEN (_patch ->> 'category_id')::uuid ELSE category_id END,
    cancellation_policy_id = CASE WHEN _patch ? 'cancellation_policy_id' THEN (_patch ->> 'cancellation_policy_id')::uuid ELSE cancellation_policy_id END,
    internal_code = CASE WHEN _patch ? 'internal_code' THEN _patch ->> 'internal_code' ELSE internal_code END,
    duration_minutes = CASE WHEN _patch ? 'duration_minutes' THEN (_patch ->> 'duration_minutes')::integer ELSE duration_minutes END,
    buffer_before_minutes = CASE WHEN _patch ? 'buffer_before_minutes' THEN (_patch ->> 'buffer_before_minutes')::integer ELSE buffer_before_minutes END,
    buffer_after_minutes = CASE WHEN _patch ? 'buffer_after_minutes' THEN (_patch ->> 'buffer_after_minutes')::integer ELSE buffer_after_minutes END,
    processing_minutes = CASE WHEN _patch ? 'processing_minutes' THEN (_patch ->> 'processing_minutes')::integer ELSE processing_minutes END,
    min_advance_hours = CASE WHEN _patch ? 'min_advance_hours' THEN (_patch ->> 'min_advance_hours')::integer ELSE min_advance_hours END,
    max_advance_days = CASE WHEN _patch ? 'max_advance_days' THEN (_patch ->> 'max_advance_days')::integer ELSE max_advance_days END,
    ideal_return_window_days = CASE WHEN _patch ? 'ideal_return_window_days' THEN (_patch ->> 'ideal_return_window_days')::integer ELSE ideal_return_window_days END,
    requires_resource = CASE WHEN _patch ? 'requires_resource' THEN (_patch ->> 'requires_resource')::boolean ELSE requires_resource END,
    resource_label = CASE WHEN _patch ? 'resource_label' THEN _patch ->> 'resource_label' ELSE resource_label END,
    eligible_for_package = CASE WHEN _patch ? 'eligible_for_package' THEN (_patch ->> 'eligible_for_package')::boolean ELSE eligible_for_package END,
    eligible_for_membership = CASE WHEN _patch ? 'eligible_for_membership' THEN (_patch ->> 'eligible_for_membership')::boolean ELSE eligible_for_membership END,
    pre_appointment_instructions = CASE WHEN _patch ? 'pre_appointment_instructions' THEN _patch ->> 'pre_appointment_instructions' ELSE pre_appointment_instructions END,
    post_appointment_instructions = CASE WHEN _patch ? 'post_appointment_instructions' THEN _patch ->> 'post_appointment_instructions' ELSE post_appointment_instructions END,
    is_active = CASE WHEN _patch ? 'is_active' THEN (_patch ->> 'is_active')::boolean ELSE is_active END,
    is_featured = CASE WHEN _patch ? 'is_featured' THEN (_patch ->> 'is_featured')::boolean ELSE is_featured END
  WHERE id = _service_id
  RETURNING * INTO v_service;

  UPDATE public.service_prices SET
    amount_cents = _amount_cents,
    currency = CASE WHEN _currency IS NULL THEN currency ELSE upper(btrim(_currency)) END
  WHERE service_id = _service_id AND is_default = true
  RETURNING id INTO v_price_id;
  IF v_price_id IS NULL THEN
    v_currency := COALESCE(upper(btrim(_currency)), 'BRL');
    INSERT INTO public.service_prices (tenant_id, service_id, currency, amount_cents, is_default)
    VALUES (v_service.tenant_id, _service_id, v_currency, _amount_cents, true);
  END IF;

  RETURN to_jsonb(v_service);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_replace_service_unit_prices(
  _tenant_id uuid,
  _service_id uuid,
  _overrides jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_service_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_service_tenant FROM public.services WHERE id = _service_id FOR UPDATE;
  IF NOT FOUND OR v_service_tenant <> _tenant_id THEN
    RAISE EXCEPTION 'Serviço não encontrado neste tenant.' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor IS NULL OR NOT (
    public.is_super_admin(v_actor)
    OR public.has_any_tenant_role(v_actor, v_service_tenant, ARRAY['owner'::public.app_role, 'manager'::public.app_role])
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o catálogo deste tenant.' USING ERRCODE = '42501';
  END IF;
  IF _overrides IS NULL OR jsonb_typeof(_overrides) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A lista de preços por unidade deve ser um array JSON.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_overrides) > 200 THEN
    RAISE EXCEPTION 'A lista de preços por unidade deve conter no máximo 200 itens.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_overrides) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR NULLIF(item.value ->> 'unit_id', '') IS NULL
       OR COALESCE((item.value ->> 'amount_cents')::integer, -1) < 0
       OR (
         item.value ? 'duration_minutes'
         AND item.value ->> 'duration_minutes' IS NOT NULL
         AND (item.value ->> 'duration_minutes')::integer <= 0
       )
  ) THEN
    RAISE EXCEPTION 'Preço por unidade contém identificador ou valor inválido.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.service_unit_prices WHERE service_id = _service_id;
  INSERT INTO public.service_unit_prices (tenant_id, service_id, unit_id, amount_cents, duration_minutes)
  SELECT _tenant_id, _service_id, (item.value ->> 'unit_id')::uuid,
         (item.value ->> 'amount_cents')::integer, (item.value ->> 'duration_minutes')::integer
  FROM jsonb_array_elements(_overrides) AS item(value);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_replace_service_professional_prices(
  _tenant_id uuid,
  _service_id uuid,
  _overrides jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_service_tenant uuid;
BEGIN
  SELECT tenant_id INTO v_service_tenant FROM public.services WHERE id = _service_id FOR UPDATE;
  IF NOT FOUND OR v_service_tenant <> _tenant_id THEN
    RAISE EXCEPTION 'Serviço não encontrado neste tenant.' USING ERRCODE = 'P0002';
  END IF;
  IF v_actor IS NULL OR NOT (
    public.is_super_admin(v_actor)
    OR public.has_any_tenant_role(v_actor, v_service_tenant, ARRAY['owner'::public.app_role, 'manager'::public.app_role])
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o catálogo deste tenant.' USING ERRCODE = '42501';
  END IF;
  IF _overrides IS NULL OR jsonb_typeof(_overrides) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'A lista de preços por profissional deve ser um array JSON.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_overrides) > 200 THEN
    RAISE EXCEPTION 'A lista de preços por profissional deve conter no máximo 200 itens.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(_overrides) AS item(value)
    WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
       OR NULLIF(item.value ->> 'professional_id', '') IS NULL
       OR COALESCE((item.value ->> 'amount_cents')::integer, -1) < 0
       OR (
         item.value ? 'duration_minutes'
         AND item.value ->> 'duration_minutes' IS NOT NULL
         AND (item.value ->> 'duration_minutes')::integer <= 0
       )
  ) THEN
    RAISE EXCEPTION 'Preço por profissional contém identificador ou valor inválido.' USING ERRCODE = '22023';
  END IF;
  DELETE FROM public.service_professional_prices WHERE service_id = _service_id;
  INSERT INTO public.service_professional_prices (tenant_id, service_id, professional_id, amount_cents, duration_minutes)
  SELECT _tenant_id, _service_id, (item.value ->> 'professional_id')::uuid,
         (item.value ->> 'amount_cents')::integer, (item.value ->> 'duration_minutes')::integer
  FROM jsonb_array_elements(_overrides) AS item(value);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_save_package_bundle(
  _id uuid,
  _tenant_id uuid,
  _values jsonb,
  _items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_package public.packages%ROWTYPE;
BEGIN
  IF _values IS NULL OR jsonb_typeof(_values) IS DISTINCT FROM 'object'
     OR _items IS NULL OR jsonb_typeof(_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados inválidos para gravar o pacote.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_items) > 200 THEN
    RAISE EXCEPTION 'Dados inválidos para gravar o pacote.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE((_values ->> 'price_cents')::integer, 0) < 0
     OR ((_values ->> 'validity_days') IS NOT NULL AND (_values ->> 'validity_days')::integer <= 0)
     OR ((_values ->> 'recommended_interval_days') IS NOT NULL AND (_values ->> 'recommended_interval_days')::integer <= 0)
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(_items) AS item(value)
       WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
          OR NULLIF(item.value ->> 'service_id', '') IS NULL
          OR COALESCE((item.value ->> 'sessions')::integer, 1) <= 0
     ) THEN
    RAISE EXCEPTION 'O pacote contém preço, validade, intervalo ou itens inválidos.' USING ERRCODE = '22023';
  END IF;
  IF _id IS NULL THEN
    v_tenant_id := _tenant_id;
  ELSE
    SELECT * INTO v_package FROM public.packages WHERE id = _id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pacote não encontrado.' USING ERRCODE = 'P0002'; END IF;
    v_tenant_id := v_package.tenant_id;
    IF _tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'O pacote não pode ser reatribuído a outro tenant.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF v_tenant_id IS NULL OR v_actor IS NULL OR NOT (
    public.is_super_admin(v_actor)
    OR public.has_any_tenant_role(v_actor, v_tenant_id, ARRAY['owner'::public.app_role, 'manager'::public.app_role])
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o catálogo deste tenant.' USING ERRCODE = '42501';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.packages (
      tenant_id, kind, name, description, price_cents, validity_days,
      recommended_interval_days, usage_rules, notes, is_active
    ) VALUES (
      v_tenant_id, COALESCE((_values ->> 'kind')::public.package_kind, 'package'::public.package_kind),
      _values ->> 'name', _values ->> 'description', COALESCE((_values ->> 'price_cents')::integer, 0),
      (_values ->> 'validity_days')::integer, (_values ->> 'recommended_interval_days')::integer,
      _values ->> 'usage_rules', _values ->> 'notes', COALESCE((_values ->> 'is_active')::boolean, true)
    ) RETURNING * INTO v_package;
  ELSE
    UPDATE public.packages SET
      kind = CASE WHEN _values ? 'kind' THEN (_values ->> 'kind')::public.package_kind ELSE kind END,
      name = CASE WHEN _values ? 'name' THEN _values ->> 'name' ELSE name END,
      description = CASE WHEN _values ? 'description' THEN _values ->> 'description' ELSE description END,
      price_cents = CASE WHEN _values ? 'price_cents' THEN (_values ->> 'price_cents')::integer ELSE price_cents END,
      validity_days = CASE WHEN _values ? 'validity_days' THEN (_values ->> 'validity_days')::integer ELSE validity_days END,
      recommended_interval_days = CASE WHEN _values ? 'recommended_interval_days' THEN (_values ->> 'recommended_interval_days')::integer ELSE recommended_interval_days END,
      usage_rules = CASE WHEN _values ? 'usage_rules' THEN _values ->> 'usage_rules' ELSE usage_rules END,
      notes = CASE WHEN _values ? 'notes' THEN _values ->> 'notes' ELSE notes END,
      is_active = CASE WHEN _values ? 'is_active' THEN (_values ->> 'is_active')::boolean ELSE is_active END
    WHERE id = _id RETURNING * INTO v_package;
  END IF;

  IF _id IS NOT NULL THEN DELETE FROM public.package_items WHERE package_id = _id; END IF;
  INSERT INTO public.package_items (tenant_id, package_id, service_id, sessions, position)
  SELECT v_tenant_id, v_package.id, (item.value ->> 'service_id')::uuid,
         COALESCE((item.value ->> 'sessions')::integer, 1), (item.ordinality - 1)::integer
  FROM jsonb_array_elements(_items) WITH ORDINALITY AS item(value, ordinality);
  RETURN to_jsonb(v_package);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_save_membership_bundle(
  _id uuid,
  _tenant_id uuid,
  _values jsonb,
  _benefits jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_membership public.memberships%ROWTYPE;
BEGIN
  IF _values IS NULL OR jsonb_typeof(_values) IS DISTINCT FROM 'object'
     OR _benefits IS NULL OR jsonb_typeof(_benefits) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados inválidos para gravar a assinatura.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_benefits) > 200 THEN
    RAISE EXCEPTION 'Dados inválidos para gravar a assinatura.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE((_values ->> 'price_cents')::integer, 0) < 0
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(_benefits) AS item(value)
       WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
          OR NULLIF(item.value ->> 'service_id', '') IS NULL
          OR COALESCE((item.value ->> 'sessions_per_cycle')::integer, 1) <= 0
          OR COALESCE((item.value ->> 'discount_pct')::integer, 0) < 0
          OR COALESCE((item.value ->> 'discount_pct')::integer, 0) > 100
     ) THEN
    RAISE EXCEPTION 'A assinatura contém preço ou benefícios inválidos.' USING ERRCODE = '22023';
  END IF;
  IF _id IS NULL THEN
    v_tenant_id := _tenant_id;
  ELSE
    SELECT * INTO v_membership FROM public.memberships WHERE id = _id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assinatura não encontrada.' USING ERRCODE = 'P0002'; END IF;
    v_tenant_id := v_membership.tenant_id;
    IF _tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'A assinatura não pode ser reatribuída a outro tenant.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF v_tenant_id IS NULL OR v_actor IS NULL OR NOT (
    public.is_super_admin(v_actor)
    OR public.has_any_tenant_role(v_actor, v_tenant_id, ARRAY['owner'::public.app_role, 'manager'::public.app_role])
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o catálogo deste tenant.' USING ERRCODE = '42501';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.memberships (tenant_id, name, description, price_cents, billing_cycle, is_active, notes)
    VALUES (
      v_tenant_id, _values ->> 'name', _values ->> 'description', COALESCE((_values ->> 'price_cents')::integer, 0),
      COALESCE((_values ->> 'billing_cycle')::public.membership_billing_cycle, 'monthly'::public.membership_billing_cycle),
      COALESCE((_values ->> 'is_active')::boolean, true), _values ->> 'notes'
    ) RETURNING * INTO v_membership;
  ELSE
    UPDATE public.memberships SET
      name = CASE WHEN _values ? 'name' THEN _values ->> 'name' ELSE name END,
      description = CASE WHEN _values ? 'description' THEN _values ->> 'description' ELSE description END,
      price_cents = CASE WHEN _values ? 'price_cents' THEN (_values ->> 'price_cents')::integer ELSE price_cents END,
      billing_cycle = CASE WHEN _values ? 'billing_cycle' THEN (_values ->> 'billing_cycle')::public.membership_billing_cycle ELSE billing_cycle END,
      is_active = CASE WHEN _values ? 'is_active' THEN (_values ->> 'is_active')::boolean ELSE is_active END,
      notes = CASE WHEN _values ? 'notes' THEN _values ->> 'notes' ELSE notes END
    WHERE id = _id RETURNING * INTO v_membership;
  END IF;

  IF _id IS NOT NULL THEN DELETE FROM public.membership_benefits WHERE membership_id = _id; END IF;
  INSERT INTO public.membership_benefits (tenant_id, membership_id, service_id, sessions_per_cycle, discount_pct)
  SELECT v_tenant_id, v_membership.id, (item.value ->> 'service_id')::uuid,
         COALESCE((item.value ->> 'sessions_per_cycle')::integer, 1),
         COALESCE((item.value ->> 'discount_pct')::integer, 0)
  FROM jsonb_array_elements(_benefits) AS item(value);
  RETURN to_jsonb(v_membership);
END;
$$;

CREATE OR REPLACE FUNCTION public.catalog_save_protocol_bundle(
  _id uuid,
  _tenant_id uuid,
  _values jsonb,
  _steps jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_tenant_id uuid;
  v_protocol public.protocols%ROWTYPE;
BEGIN
  IF _values IS NULL OR jsonb_typeof(_values) IS DISTINCT FROM 'object'
     OR _steps IS NULL OR jsonb_typeof(_steps) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Dados inválidos para gravar o protocolo.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(_steps) > 200 THEN
    RAISE EXCEPTION 'Dados inválidos para gravar o protocolo.' USING ERRCODE = '22023';
  END IF;
  IF ((_values ->> 'total_price_cents') IS NOT NULL AND (_values ->> 'total_price_cents')::integer < 0)
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(_steps) AS item(value)
       WHERE jsonb_typeof(item.value) IS DISTINCT FROM 'object'
          OR NULLIF(item.value ->> 'service_id', '') IS NULL
          OR (
            item.value ? 'interval_days'
            AND item.value ->> 'interval_days' IS NOT NULL
            AND (item.value ->> 'interval_days')::integer < 0
          )
     ) THEN
    RAISE EXCEPTION 'O protocolo contém preço, intervalo ou etapas inválidos.' USING ERRCODE = '22023';
  END IF;
  IF _id IS NULL THEN
    v_tenant_id := _tenant_id;
  ELSE
    SELECT * INTO v_protocol FROM public.protocols WHERE id = _id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Protocolo não encontrado.' USING ERRCODE = 'P0002'; END IF;
    v_tenant_id := v_protocol.tenant_id;
    IF _tenant_id IS DISTINCT FROM v_tenant_id THEN
      RAISE EXCEPTION 'O protocolo não pode ser reatribuído a outro tenant.' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF v_tenant_id IS NULL OR v_actor IS NULL OR NOT (
    public.is_super_admin(v_actor)
    OR public.has_any_tenant_role(v_actor, v_tenant_id, ARRAY['owner'::public.app_role, 'manager'::public.app_role])
  ) THEN
    RAISE EXCEPTION 'Sem permissão para alterar o catálogo deste tenant.' USING ERRCODE = '42501';
  END IF;

  IF _id IS NULL THEN
    INSERT INTO public.protocols (
      tenant_id, name, description, total_sessions, recommended_interval_days,
      total_price_cents, pre_instructions, post_instructions, is_active
    ) VALUES (
      v_tenant_id, _values ->> 'name', _values ->> 'description',
      COALESCE((_values ->> 'total_sessions')::integer, jsonb_array_length(_steps), 1),
      (_values ->> 'recommended_interval_days')::integer, (_values ->> 'total_price_cents')::integer,
      _values ->> 'pre_instructions', _values ->> 'post_instructions',
      COALESCE((_values ->> 'is_active')::boolean, true)
    ) RETURNING * INTO v_protocol;
  ELSE
    UPDATE public.protocols SET
      name = CASE WHEN _values ? 'name' THEN _values ->> 'name' ELSE name END,
      description = CASE WHEN _values ? 'description' THEN _values ->> 'description' ELSE description END,
      total_sessions = CASE WHEN _values ? 'total_sessions' THEN (_values ->> 'total_sessions')::integer ELSE total_sessions END,
      recommended_interval_days = CASE WHEN _values ? 'recommended_interval_days' THEN (_values ->> 'recommended_interval_days')::integer ELSE recommended_interval_days END,
      total_price_cents = CASE WHEN _values ? 'total_price_cents' THEN (_values ->> 'total_price_cents')::integer ELSE total_price_cents END,
      pre_instructions = CASE WHEN _values ? 'pre_instructions' THEN _values ->> 'pre_instructions' ELSE pre_instructions END,
      post_instructions = CASE WHEN _values ? 'post_instructions' THEN _values ->> 'post_instructions' ELSE post_instructions END,
      is_active = CASE WHEN _values ? 'is_active' THEN (_values ->> 'is_active')::boolean ELSE is_active END
    WHERE id = _id RETURNING * INTO v_protocol;
  END IF;

  IF _id IS NOT NULL THEN DELETE FROM public.protocol_sessions WHERE protocol_id = _id; END IF;
  INSERT INTO public.protocol_sessions (tenant_id, protocol_id, service_id, step, interval_days, notes)
  SELECT v_tenant_id, v_protocol.id, (item.value ->> 'service_id')::uuid,
         item.ordinality::integer, (item.value ->> 'interval_days')::integer, item.value ->> 'notes'
  FROM jsonb_array_elements(_steps) WITH ORDINALITY AS item(value, ordinality);
  RETURN to_jsonb(v_protocol);
END;
$$;

REVOKE ALL ON FUNCTION public.catalog_create_service_with_price(jsonb, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_update_service_with_price(uuid, jsonb, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_replace_service_unit_prices(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_replace_service_professional_prices(uuid, uuid, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_save_package_bundle(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_save_membership_bundle(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.catalog_save_protocol_bundle(uuid, uuid, jsonb, jsonb) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.catalog_create_service_with_price(jsonb, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_update_service_with_price(uuid, jsonb, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_replace_service_unit_prices(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_replace_service_professional_prices(uuid, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_save_package_bundle(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_save_membership_bundle(uuid, uuid, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.catalog_save_protocol_bundle(uuid, uuid, jsonb, jsonb) TO authenticated;
