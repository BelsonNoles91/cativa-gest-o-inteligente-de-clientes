-- Recepção e profissionais precisam saber se o plano do estabelecimento está
-- ativo para usar o sistema; hoje só owner/manager liam a assinatura e os
-- demais papéis ficavam presos na tela "Aguardando ativação".
DROP POLICY IF EXISTS "tenant_subs: membros leem o próprio" ON public.tenant_subscriptions;
CREATE POLICY "tenant_subs: membros leem o próprio"
ON public.tenant_subscriptions FOR SELECT TO authenticated
USING (public.is_tenant_member(auth.uid(), tenant_id));