-- ==============================================================================
-- 🚀 SCRIPT DE GERAÇÃO DE CONTAS E DADOS (MOCK) PARA TESTE E VALIDAÇÃO DE USABILIDADE
-- 
-- IMPORTANTE: Cole este script no "SQL Editor" do painel web do seu Supabase 
-- e clique no botão "RUN" (não "Explain"!)
-- (https://supabase.com/dashboard/project/...)
-- ==============================================================================

CREATE OR REPLACE FUNCTION pg_temp.mock_cativa_data() RETURNS void AS $$
DECLARE
  v_tenant_id uuid;
  v_unit_id uuid;
  v_owner_id uuid;
  v_front_id uuid := gen_random_uuid();
  v_pro_id uuid := gen_random_uuid();
  v_manager_id uuid := gen_random_uuid();
  -- Senha padrão para todas as contas: "senha123"
  v_pw_hash text := crypt('senha123', gen_salt('bf')); 
  v_now timestamptz := now();
  v_client_id uuid;
  v_service_id uuid;
  v_appt_id uuid;
  i int;
  w int;
BEGIN
  -- 1. IDENTIFICAR O TENANT ATUAL 
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION '⚠️ Nenhum tenant encontrado! Crie sua conta no app primeiro.';
  END IF;

  -- Capturar o owner atual
  SELECT user_id INTO v_owner_id FROM public.tenant_memberships WHERE tenant_id = v_tenant_id AND role = 'owner' LIMIT 1;

  -- Garantir que haja pelo menos 1 unidade
  SELECT id INTO v_unit_id FROM public.units WHERE tenant_id = v_tenant_id LIMIT 1;
  IF v_unit_id IS NULL THEN
    INSERT INTO public.units (tenant_id, name) VALUES (v_tenant_id, 'Unidade Principal') RETURNING id INTO v_unit_id;
  END IF;

  -- Garantir Horário de Funcionamento (evita barramento pela trigger de conflitos)
  IF (SELECT count(*) FROM public.unit_business_hours WHERE unit_id = v_unit_id) = 0 THEN
    FOR w IN 0..6 LOOP
      INSERT INTO public.unit_business_hours (tenant_id, unit_id, weekday, opens_at, closes_at, is_closed)
      VALUES (v_tenant_id, v_unit_id, w, '00:00', '23:59', false);
    END LOOP;
  END IF;

  -- ==========================================
  -- 2. CRIAR OS USUÁRIOS/CONTAS DE CADA TIPO
  -- Senha de todas as contas: senha123
  -- ==========================================

  -- 2.A) RECEPÇÃO (FRONTDESK)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'recepcao@cativa.com') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_front_id, '00000000-0000-0000-0000-000000000000', 'recepcao@cativa.com', v_pw_hash, v_now, '{"provider":"email","providers":["email"]}', '{"full_name": "Recepção Cativa"}', v_now, v_now, 'authenticated', 'authenticated');
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
    VALUES (v_tenant_id, v_front_id, 'frontdesk', 'active');
  END IF;

  -- 2.B) PROFISSIONAL
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'profissional@cativa.com') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_pro_id, '00000000-0000-0000-0000-000000000000', 'profissional@cativa.com', v_pw_hash, v_now, '{"provider":"email","providers":["email"]}', '{"full_name": "Dra. Especialista"}', v_now, v_now, 'authenticated', 'authenticated');
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
    VALUES (v_tenant_id, v_pro_id, 'professional', 'active');
    INSERT INTO public.professionals (tenant_id, user_id, display_name, is_active)
    VALUES (v_tenant_id, v_pro_id, 'Dra. Especialista', true);
  END IF;

  -- 2.C) GERENTE (MANAGER)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'gerente@cativa.com') THEN
    INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
    VALUES (v_manager_id, '00000000-0000-0000-0000-000000000000', 'gerente@cativa.com', v_pw_hash, v_now, '{"provider":"email","providers":["email"]}', '{"full_name": "Gerência Cativa"}', v_now, v_now, 'authenticated', 'authenticated');
    INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
    VALUES (v_tenant_id, v_manager_id, 'manager', 'active');
  END IF;

  -- ==========================================
  -- 3. SERVIÇOS E CLIENTES
  -- ==========================================

  -- Serviço de exemplo
  IF NOT EXISTS (SELECT 1 FROM public.services WHERE tenant_id = v_tenant_id AND name = 'Protocolo Facial Cativa') THEN
    INSERT INTO public.services (tenant_id, name, description, duration_minutes, is_active)
    VALUES (v_tenant_id, 'Protocolo Facial Cativa', 'Procedimento premium completo (Limpeza, hidratação e peeling).', 90, true)
    RETURNING id INTO v_service_id;
    -- Preço base do serviço em tabela separada (R$ 250,00)
    INSERT INTO public.service_prices (tenant_id, service_id, amount_cents)
    VALUES (v_tenant_id, v_service_id, 25000);
  ELSE
    SELECT id INTO v_service_id FROM public.services WHERE tenant_id = v_tenant_id LIMIT 1;
  END IF;
  
  -- 15 Clientes de Teste
  IF (SELECT count(*) FROM public.clients WHERE tenant_id = v_tenant_id) < 10 THEN
    FOR i IN 1..15 LOOP
      INSERT INTO public.clients (tenant_id, full_name, email, phone, risk_level, origin)
      VALUES (
        v_tenant_id, 
        'Cliente Premium ' || i, 
        'cliente' || i || '@testecativa.com', 
        '1199000' || lpad(i::text, 4, '0'), 
        (CASE WHEN (i % 3) = 0 THEN 'low' WHEN (i % 4) = 0 THEN 'medium' ELSE 'low' END)::public.client_risk_level,
        CASE WHEN (i % 2) = 0 THEN 'Instagram' ELSE 'Indicação' END
      );
    END LOOP;
  END IF;

  -- ==========================================
  -- 4. AGENDAMENTOS MOCKADOS PARA HOJE
  -- ==========================================

  SELECT id INTO v_pro_id FROM public.professionals WHERE tenant_id = v_tenant_id LIMIT 1;

  IF v_service_id IS NOT NULL AND v_pro_id IS NOT NULL THEN
    FOR i IN 1..4 LOOP
      SELECT id INTO v_client_id FROM public.clients WHERE tenant_id = v_tenant_id ORDER BY random() LIMIT 1;
      
      -- is_overbooked=true evita bloqueio da trigger de conflito de horário (dados de teste)
      -- offset por epoch garante horários únicos entre execuções do script
      INSERT INTO public.appointments (
        tenant_id, client_id, unit_id, professional_id, 
        starts_at, ends_at, duration_minutes, status, total_price_cents, is_overbooked
      ) VALUES (
        v_tenant_id, v_client_id, v_unit_id, v_pro_id, 
        date_trunc('day', now()) + ((8 + (extract(epoch from now())::bigint % 100) + (i * 2)) || ' hours')::interval,
        date_trunc('day', now()) + ((8 + (extract(epoch from now())::bigint % 100) + (i * 2)) || ' hours 45 minutes')::interval,
        90,
        (CASE 
          WHEN i = 1 THEN 'pending' 
          WHEN i = 2 THEN 'pending' 
          WHEN i = 3 THEN 'confirmed' 
          ELSE 'in_service' 
        END)::public.appointment_status,
        25000,
        true
      ) RETURNING id INTO v_appt_id;
      
      -- Serviço vinculado ao agendamento (tabela appointment_items)
      INSERT INTO public.appointment_items (
        tenant_id, appointment_id, service_id, duration_minutes, price_cents
      ) VALUES (
        v_tenant_id, v_appt_id, v_service_id, 90, 25000
      );
    END LOOP;
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Executa a função na sessão atual
SELECT pg_temp.mock_cativa_data();
