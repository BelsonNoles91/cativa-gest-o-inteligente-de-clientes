-- Reabrir SELECT para membros do tenant e usar GRANT por coluna para
-- proteger commission_pct. Postgres suporta GRANT SELECT (col1, col2, ...).

-- Reativar leitura por membros
CREATE POLICY "professionals: membros leem"
ON public.professionals
FOR SELECT
TO authenticated
USING (
  is_tenant_member(auth.uid(), tenant_id)
  OR is_super_admin(auth.uid())
);

-- Reativar leitura para clientes ativos do portal (igual ao comportamento antigo)
CREATE POLICY "professionals: portal client lê ativos do tenant"
ON public.professionals
FOR SELECT
TO authenticated
USING (
  is_active = true AND EXISTS (
    SELECT 1 FROM public.client_users cu
    WHERE cu.user_id = auth.uid()
      AND cu.tenant_id = professionals.tenant_id
      AND cu.status = 'active'
  )
);

-- Bloquear leitura da coluna commission_pct para o role 'authenticated'
-- (e portanto para qualquer cliente/serviço que use anon key + JWT do usuário).
-- Em seguida concedemos novamente SELECT em todas as outras colunas.
REVOKE SELECT ON public.professionals FROM authenticated;
GRANT SELECT (
  id, tenant_id, unit_id, user_id,
  display_name, role_title, bio, color, specialty,
  email, phone, is_active, created_at, updated_at
) ON public.professionals TO authenticated;

-- A RPC get_my_commission(...) usa SECURITY DEFINER e ignora o GRANT,
-- então o próprio profissional continua conseguindo ler a sua comissão.
-- A RPC admin_*/security definer e os roles owner/manager continuam podendo
-- atualizar o valor via UPDATE/INSERT (a coluna não foi removida do GRANT
-- de write — apenas SELECT foi restrito). Confirmamos:
GRANT INSERT, UPDATE, DELETE ON public.professionals TO authenticated;