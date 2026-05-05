-- Permitir que QUALQUER membro ativo do tenant possa ler a assinatura.
-- Isso é necessário para que o SubscriptionBlocker funcione para
-- frontdesk e professional (não apenas owner/manager).

-- Primeiro, dropar qualquer policy de SELECT existente que seja restritiva
DO $$
BEGIN
  -- Tentar dropar policies de leitura existentes (ignora se não existirem)
  BEGIN
    DROP POLICY IF EXISTS "Membros leem assinatura do próprio tenant" ON public.tenant_subscriptions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "tenant_subscriptions_select" ON public.tenant_subscriptions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  BEGIN
    DROP POLICY IF EXISTS "allow_select_own_tenant_subscription" ON public.tenant_subscriptions;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- Criar policy de leitura que permite qualquer membro ativo do tenant
CREATE POLICY "Qualquer membro lê assinatura do tenant"
  ON public.tenant_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tenant_memberships tm
      WHERE tm.tenant_id = tenant_subscriptions.tenant_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_super_admin = true
    )
  );

-- Também garantir que plan_features e feature_flags sejam legíveis
-- por qualquer membro
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "plan_features_public_read" ON public.plan_features;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY "Qualquer autenticado lê features de planos"
  ON public.plan_features
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Plans devem ser legíveis por todos os autenticados
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "plans_public_read" ON public.plans;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY "Qualquer autenticado lê planos"
  ON public.plans
  FOR SELECT
  USING (auth.role() = 'authenticated');
