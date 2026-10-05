-- Tenant-reference integrity for catalog, packages, balances and CRM metadata.
-- All synthetic identities and records are rolled back at the end.

BEGIN;

DO $test$
DECLARE
  tenant_a uuid := '00000000-0000-4900-8900-00000000e001';
  tenant_b uuid := '00000000-0000-4900-8900-00000000e002';
  owner_a uuid := '00000000-0000-4900-8900-000000000e01';
  owner_b uuid := '00000000-0000-4900-8900-000000000e02';
  unit_a uuid := '00000000-0000-4900-8900-00000000e101';
  unit_b uuid := '00000000-0000-4900-8900-00000000e102';
  client_a uuid := '00000000-0000-4900-8900-00000000e201';
  client_b uuid := '00000000-0000-4900-8900-00000000e202';
  professional_a uuid := '00000000-0000-4900-8900-00000000e301';
  professional_b uuid := '00000000-0000-4900-8900-00000000e302';
  policy_a uuid := '00000000-0000-4900-8900-00000000e401';
  policy_b uuid := '00000000-0000-4900-8900-00000000e402';
  category_a uuid := '00000000-0000-4900-8900-00000000e501';
  category_b uuid := '00000000-0000-4900-8900-00000000e502';
  service_a uuid := '00000000-0000-4900-8900-00000000e601';
  service_b uuid := '00000000-0000-4900-8900-00000000e602';
  package_a uuid := '00000000-0000-4900-8900-00000000e701';
  package_b uuid := '00000000-0000-4900-8900-00000000e702';
  membership_a uuid := '00000000-0000-4900-8900-00000000e801';
  membership_b uuid := '00000000-0000-4900-8900-00000000e802';
  protocol_a uuid := '00000000-0000-4900-8900-00000000e901';
  protocol_b uuid := '00000000-0000-4900-8900-00000000e902';
  balance_a uuid := '00000000-0000-4900-8900-00000000ea01';
  balance_b uuid := '00000000-0000-4900-8900-00000000ea02';
  subscription_a uuid := '00000000-0000-4900-8900-00000000eb01';
  subscription_b uuid := '00000000-0000-4900-8900-00000000eb02';
  tag_a uuid := '00000000-0000-4900-8900-00000000ec01';
  tag_b uuid := '00000000-0000-4900-8900-00000000ec02';
  field_a uuid := '00000000-0000-4900-8900-00000000ed01';
  template_a uuid := '00000000-0000-4900-8900-00000000ee01';
  template_b uuid := '00000000-0000-4900-8900-00000000ee02';
  actor_id uuid;
  event_id uuid;
  actual_actor uuid;
  denied boolean;
  visible_rows bigint;
BEGIN
  IF has_function_privilege('anon', 'public.enforce_catalog_crm_tenant_scope()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_catalog_crm_tenant_scope()', 'EXECUTE')
     OR has_function_privilege('service_role', 'public.enforce_catalog_crm_tenant_scope()', 'EXECUTE') THEN
    RAISE EXCEPTION 'A função de integridade catálogo/CRM pode ser chamada diretamente.';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (owner_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner+catalog-crm-scope@example.test', '', now(), now(), now()),
    (owner_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-b+catalog-crm-scope@example.test', '', now(), now(), now());
  INSERT INTO public.profiles (id, full_name, is_super_admin)
  VALUES (owner_a, 'Catalog Scope Owner A', false), (owner_b, 'Catalog Scope Owner B', false)
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, is_super_admin = false;
  INSERT INTO public.tenants (id, name, slug, segment, created_by)
  VALUES
    (tenant_a, 'Catalog Scope A', 'catalog-crm-scope-a', 'salao', owner_a),
    (tenant_b, 'Catalog Scope B', 'catalog-crm-scope-b', 'salao', owner_b);
  INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
  VALUES (tenant_a, owner_a, 'owner', 'active'), (tenant_b, owner_b, 'owner', 'active');
  INSERT INTO public.units (id, tenant_id, name, is_default)
  VALUES (unit_a, tenant_a, 'Catalog Unit A', true), (unit_b, tenant_b, 'Catalog Unit B', true);
  INSERT INTO public.clients (id, tenant_id, full_name, email, origin)
  VALUES
    (client_a, tenant_a, 'Catalog Client A', 'client-a+catalog-crm-scope@example.test', 'qa-catalog-crm-scope'),
    (client_b, tenant_b, 'Catalog Client B', 'client-b+catalog-crm-scope@example.test', 'qa-catalog-crm-scope');
  INSERT INTO public.professionals (id, tenant_id, unit_id, display_name)
  VALUES (professional_a, tenant_a, unit_a, 'Catalog Professional A'), (professional_b, tenant_b, unit_b, 'Catalog Professional B');
  INSERT INTO public.cancellation_policies (id, tenant_id, name)
  VALUES (policy_a, tenant_a, 'Catalog Policy A'), (policy_b, tenant_b, 'Catalog Policy B');
  INSERT INTO public.service_categories (id, tenant_id, name)
  VALUES (category_a, tenant_a, 'Catalog Category A'), (category_b, tenant_b, 'Catalog Category B');
  INSERT INTO public.services (id, tenant_id, category_id, cancellation_policy_id, name, duration_minutes)
  VALUES
    (service_a, tenant_a, category_a, policy_a, 'Catalog Service A', 30),
    (service_b, tenant_b, category_b, policy_b, 'Catalog Service B', 30);
  INSERT INTO public.packages (id, tenant_id, name) VALUES (package_a, tenant_a, 'Catalog Package A'), (package_b, tenant_b, 'Catalog Package B');
  INSERT INTO public.memberships (id, tenant_id, name) VALUES (membership_a, tenant_a, 'Catalog Membership A'), (membership_b, tenant_b, 'Catalog Membership B');
  INSERT INTO public.protocols (id, tenant_id, name) VALUES (protocol_a, tenant_a, 'Catalog Protocol A'), (protocol_b, tenant_b, 'Catalog Protocol B');
  INSERT INTO public.client_package_balances (id, tenant_id, client_id, package_id, service_id, sessions_total)
  VALUES
    (balance_a, tenant_a, client_a, package_a, service_a, 3),
    (balance_b, tenant_b, client_b, package_b, service_b, 3);
  INSERT INTO public.client_membership_subscriptions (id, tenant_id, client_id, membership_id)
  VALUES
    (subscription_a, tenant_a, client_a, membership_a),
    (subscription_b, tenant_b, client_b, membership_b);
  INSERT INTO public.client_membership_balances (tenant_id, subscription_id, service_id, sessions_total)
  VALUES (tenant_a, subscription_a, service_a, 3), (tenant_b, subscription_b, service_b, 3);
  INSERT INTO public.client_tags (id, tenant_id, name) VALUES (tag_a, tenant_a, 'Catalog Tag A'), (tag_b, tenant_b, 'Catalog Tag B');
  INSERT INTO public.custom_field_definitions (id, tenant_id, entity, key, label, field_type)
  VALUES (field_a, tenant_a, 'client', 'qa_field', 'QA Field', 'text');
  INSERT INTO public.consent_form_templates (id, tenant_id, title, body)
  VALUES (template_a, tenant_a, 'Consent A', 'Consent body'), (template_b, tenant_b, 'Consent B', 'Consent body');

  -- Service-role bypasses RLS; these assertions prove scope guards are not
  -- dependent on policy filters and cover the high-risk cross-table joins.
  EXECUTE 'SET LOCAL ROLE service_role';
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);

  denied := false;
  BEGIN INSERT INTO public.service_prices (tenant_id, service_id, amount_cents) VALUES (tenant_a, service_b, 100);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Preço base aceitou serviço de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.service_unit_prices (tenant_id, service_id, unit_id, amount_cents) VALUES (tenant_a, service_a, unit_b, 100);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Preço por unidade aceitou unidade de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.service_professional_prices (tenant_id, service_id, professional_id, amount_cents) VALUES (tenant_a, service_a, professional_b, 100);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Preço por profissional aceitou profissional de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.package_items (tenant_id, package_id, service_id) VALUES (tenant_a, package_a, service_b);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Item de pacote aceitou serviço de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.membership_benefits (tenant_id, membership_id, service_id) VALUES (tenant_a, membership_a, service_b);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Benefício aceitou serviço de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.protocol_sessions (tenant_id, protocol_id, service_id) VALUES (tenant_a, protocol_a, service_b);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Sessão de protocolo aceitou serviço de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.service_categories (tenant_id, parent_id, name) VALUES (tenant_a, category_b, 'Invalid child');
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Categoria aceitou parent de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.services (tenant_id, category_id, name, duration_minutes) VALUES (tenant_a, category_b, 'Invalid category', 30);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Serviço aceitou categoria de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.services (tenant_id, cancellation_policy_id, name, duration_minutes) VALUES (tenant_a, policy_b, 'Invalid policy', 30);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Serviço aceitou política de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_package_balances (tenant_id, client_id, package_id, service_id) VALUES (tenant_a, client_b, package_a, service_a);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Saldo de pacote aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_membership_subscriptions (tenant_id, client_id, membership_id) VALUES (tenant_a, client_a, membership_b);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Assinatura de cliente aceitou membership de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_membership_balances (tenant_id, subscription_id, service_id) VALUES (tenant_a, subscription_b, service_a);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Saldo de membership aceitou assinatura de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_tag_relations (tenant_id, client_id, tag_id) VALUES (tenant_a, client_a, tag_b);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Relação de tag aceitou tag de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_custom_field_values (tenant_id, client_id, definition_id, value) VALUES (tenant_a, client_b, field_a, '"x"'::jsonb);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Valor customizado aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_custom_field_values (tenant_id, client_id, definition_id, value) VALUES (tenant_a, client_a, gen_random_uuid(), '"x"'::jsonb);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Valor customizado aceitou definição inexistente/incompatível.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_timeline_events (tenant_id, client_id, event_type, title) VALUES (tenant_a, client_b, 'note', 'Invalid timeline');
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Linha do tempo aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.consent_form_responses (tenant_id, client_id, template_id) VALUES (tenant_a, client_a, template_b);
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Resposta de consentimento aceitou modelo de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_files (tenant_id, client_id, storage_path, file_name) VALUES (tenant_a, client_b, tenant_a::text || '/' || client_b::text || '/x.pdf', 'x.pdf');
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Arquivo CRM aceitou cliente de outro tenant.'; END IF;

  denied := false;
  BEGIN INSERT INTO public.client_photos (tenant_id, client_id, storage_path) VALUES (tenant_a, client_a, tenant_b::text || '/' || client_a::text || '/x.png');
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Foto CRM aceitou caminho de outro tenant.'; END IF;

  denied := false;
  BEGIN UPDATE public.client_tags SET tenant_id = tenant_b WHERE id = tag_a;
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Tag existente foi transferida para outro tenant.'; END IF;

  denied := false;
  BEGIN UPDATE public.packages SET tenant_id = tenant_b WHERE id = package_a;
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Pacote existente foi transferido para outro tenant.'; END IF;

  denied := false;
  BEGIN UPDATE public.client_package_balances SET tenant_id = tenant_b WHERE id = balance_a;
  EXCEPTION WHEN check_violation THEN denied := true; END;
  IF NOT denied THEN RAISE EXCEPTION 'Saldo existente foi transferido para outro tenant.'; END IF;
  RESET ROLE;

  -- Legitimate same-tenant work remains possible and actor fields cannot be
  -- forged by authenticated clients.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', owner_a::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', owner_a, 'role', 'authenticated')::text, true);
  INSERT INTO public.client_tag_relations (tenant_id, client_id, tag_id) VALUES (tenant_a, client_a, tag_a);
  INSERT INTO public.client_custom_field_values (tenant_id, client_id, definition_id, value)
  VALUES (tenant_a, client_a, field_a, '"valid"'::jsonb);
  INSERT INTO public.client_timeline_events (tenant_id, client_id, actor_id, event_type, title)
  VALUES (tenant_a, client_a, owner_b, 'note', 'actor should be owner A') RETURNING id INTO event_id;
  SELECT event.actor_id INTO actual_actor
  FROM public.client_timeline_events AS event
  WHERE event.id = event_id;
  IF actual_actor IS DISTINCT FROM owner_a THEN RAISE EXCEPTION 'Linha do tempo aceitou autoria forjada.'; END IF;

  INSERT INTO public.client_files (tenant_id, client_id, uploaded_by, storage_path, file_name)
  VALUES (tenant_a, client_a, owner_b, tenant_a::text || '/' || client_a::text || '/owner-file.pdf', 'owner-file.pdf')
  RETURNING uploaded_by INTO actual_actor;
  IF actual_actor IS DISTINCT FROM owner_a THEN RAISE EXCEPTION 'Arquivo CRM aceitou autoria forjada.'; END IF;
  INSERT INTO public.client_photos (tenant_id, client_id, uploaded_by, storage_path, caption)
  VALUES (tenant_a, client_a, owner_b, tenant_a::text || '/' || client_a::text || '/owner-photo.png', 'valid')
  RETURNING uploaded_by INTO actual_actor;
  IF actual_actor IS DISTINCT FROM owner_a THEN RAISE EXCEPTION 'Foto CRM aceitou autoria forjada.'; END IF;
  SELECT count(*) INTO visible_rows FROM public.client_files WHERE tenant_id = tenant_b;
  IF visible_rows <> 0 THEN RAISE EXCEPTION 'Owner A leu metadados de mídia do tenant B.'; END IF;

  RESET ROLE;
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claims', NULL, true);
  RAISE NOTICE 'Catálogo/CRM: 22 referências cross-tenant bloqueadas; autoria, paths e operações legítimas passaram.';
END
$test$;

ROLLBACK;
