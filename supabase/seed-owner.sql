-- ==============================================================================
-- 👑 SCRIPT: CONFIGURAÇÃO TOTAL DO AMBIENTE (SUPER ADMIN + TENANTS)
-- 
-- 1. Promove elciocorrea@gmail.com a Super Admin
-- 2. Cria Tenant A (Cativa Studio) e Tenant B (Studio B) para testes de isolamento
-- 3. Configura horários e clientes de teste
-- ==============================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_tenant_id uuid;
  v_unit_id uuid;
  v_now timestamptz := now();
  v_w int;
BEGIN
  -- 1. Obter ou criar usuário Elcio
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'elciocorrea@gmail.com';
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000001';
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_user_id, '00000000-0000-0000-0000-000000000000', 'elciocorrea@gmail.com', crypt('DJECool321', gen_salt('bf')), v_now, '{"provider":"email","providers":["email"]}', '{"full_name": "Elcio Correa"}', v_now, v_now, 'authenticated', 'authenticated');
  END IF;

  -- 2. Promoção a Super Admin
  INSERT INTO public.profiles (id, full_name, is_super_admin, updated_at)
  VALUES (v_user_id, 'Elcio Correa', true, v_now)
  ON CONFLICT (id) DO UPDATE SET is_super_admin = true, updated_at = v_now;

  -- 3. Tenant A (Cativa Studio)
  SELECT id INTO v_tenant_id FROM public.tenants WHERE name = 'Cativa Studio' LIMIT 1;
  IF v_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, slug, segment, status, created_by)
    VALUES ('Cativa Studio', 'cativa-studio', 'clinica_estetica', 'active', v_user_id)
    RETURNING id INTO v_tenant_id;
  END IF;

  -- Unidade A
  IF NOT EXISTS (SELECT 1 FROM public.units WHERE tenant_id = v_tenant_id) THEN
    INSERT INTO public.units (tenant_id, name, is_default)
    VALUES (v_tenant_id, 'Unidade Principal', true) RETURNING id INTO v_unit_id;

    FOR v_w IN 1..6 LOOP
      INSERT INTO public.unit_business_hours (tenant_id, unit_id, weekday, opens_at, closes_at, is_closed)
      VALUES (v_tenant_id, v_unit_id, v_w, '08:00', '20:00', false);
    END LOOP;
    INSERT INTO public.unit_business_hours (tenant_id, unit_id, weekday, opens_at, closes_at, is_closed)
    VALUES (v_tenant_id, v_unit_id, 0, '08:00', '12:00', true);
  END IF;

  -- Membership A
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (v_tenant_id, v_user_id, 'owner', 'active') ON CONFLICT DO NOTHING;

  -- Cliente A
  INSERT INTO public.clients (tenant_id, full_name, email)
  VALUES (v_tenant_id, 'Cliente do Tenant A', 'cliente.a@test.com') ON CONFLICT DO NOTHING;

  -- Usuarios de Teste Adicionais (Tenant A)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'owner.a@cativa.test') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'owner.a@cativa.test', crypt('Cativa@Test2026', gen_salt('bf')), v_now, '{"provider":"email","providers":["email"]}', '{"full_name": "Owner A"}', v_now, v_now, 'authenticated', 'authenticated');
    INSERT INTO public.profiles (id, full_name) VALUES ('00000000-0000-0000-0000-000000000003', 'Owner A') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status) VALUES (v_tenant_id, '00000000-0000-0000-0000-000000000003', 'owner', 'active') ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'recepcao@cativa.test') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'recepcao@cativa.test', crypt('Cativa@Test2026', gen_salt('bf')), v_now, '{"provider":"email","providers":["email"]}', '{"full_name": "Recepção"}', v_now, v_now, 'authenticated', 'authenticated');
    INSERT INTO public.profiles (id, full_name) VALUES ('00000000-0000-0000-0000-000000000004', 'Recepção') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status) VALUES (v_tenant_id, '00000000-0000-0000-0000-000000000004', 'frontdesk', 'active') ON CONFLICT DO NOTHING;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'profissional@cativa.test') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'profissional@cativa.test', crypt('Cativa@Test2026', gen_salt('bf')), v_now, '{"provider":"email","providers":["email"]}', '{"full_name": "Profissional Teste"}', v_now, v_now, 'authenticated', 'authenticated');
    INSERT INTO public.profiles (id, full_name) VALUES ('00000000-0000-0000-0000-000000000005', 'Profissional Teste') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status) VALUES (v_tenant_id, '00000000-0000-0000-0000-000000000005', 'professional', 'active') ON CONFLICT DO NOTHING;
  END IF;

  -- 4. Tenant B (Studio B) para Isolamento
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'owner.b@cativa.test') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'owner.b@cativa.test', crypt('Cativa@Test2026', gen_salt('bf')), v_now, '{"provider":"email","providers":["email"]}', '{"full_name": "Owner B"}', v_now, v_now, 'authenticated', 'authenticated');
    
    INSERT INTO public.tenants (name, slug, segment, status, created_by)
    VALUES ('Studio B', 'studio-b', 'clinica_estetica', 'active', '00000000-0000-0000-0000-000000000002')
    RETURNING id INTO v_tenant_id;

    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
    VALUES (v_tenant_id, '00000000-0000-0000-0000-000000000002', 'owner', 'active');

    INSERT INTO public.clients (tenant_id, full_name, email)
    VALUES (v_tenant_id, 'Cliente do Tenant B', 'cliente.b@test.com');
  END IF;

  RAISE NOTICE '✅ Super Admin e Dados de Teste configurados.';
END $$;
