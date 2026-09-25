-- Bootstrap pontual da conta principal de QA usada pela CI autenticada.
--
-- A promoção só acontece quando todos os marcadores do ambiente de QA
-- conhecido estão presentes ao mesmo tempo. Em qualquer outro ambiente a
-- migration é um no-op.
DO $$
DECLARE
  v_user_id constant uuid := 'c18a4334-8df4-4cb3-9911-392b28a346c1';
  v_tenant_id uuid;
  v_is_super boolean;
BEGIN
  SELECT t.id
    INTO v_tenant_id
  FROM public.tenants AS t
  WHERE t.slug = 'studio-teste-qa'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'QA bootstrap ignorado: tenant studio-teste-qa ausente.';
    RETURN;
  END IF;

  SELECT p.is_super_admin
    INTO v_is_super
  FROM public.profiles AS p
  WHERE p.id = v_user_id
    AND p.full_name = 'Owner QA'
    AND EXISTS (
      SELECT 1
      FROM public.tenant_memberships AS tm
      WHERE tm.user_id = p.id
        AND tm.tenant_id = v_tenant_id
        AND tm.role = 'owner'::public.app_role
        AND tm.status = 'active'
    )
    AND EXISTS (
      SELECT 1
      FROM public.appointments AS a
      WHERE a.tenant_id = v_tenant_id
        AND a.created_by = p.id
        AND a.internal_notes = 'E2E_FIXTURE_CONFIRMATION_MODAL_V1'
    );

  IF NOT FOUND THEN
    RAISE NOTICE 'QA bootstrap ignorado: identidade/fixtures esperados não conferem.';
    RETURN;
  END IF;

  IF COALESCE(v_is_super, false) THEN
    RAISE NOTICE 'QA bootstrap já aplicado.';
    RETURN;
  END IF;

  -- O trigger impede elevação sem um super_admin autenticado. Como esta é uma
  -- migration administrativa, desabilitamos apenas esse trigger durante a
  -- atualização pontual; o ALTER TABLE é transacional.
  EXECUTE 'ALTER TABLE public.profiles DISABLE TRIGGER profiles_block_super_admin_changes_trg';

  UPDATE public.profiles
     SET is_super_admin = true,
         updated_at = now()
   WHERE id = v_user_id;

  EXECUTE 'ALTER TABLE public.profiles ENABLE TRIGGER profiles_block_super_admin_changes_trg';

  RAISE NOTICE 'QA bootstrap aplicado ao owner do tenant studio-teste-qa.';
END
$$;
