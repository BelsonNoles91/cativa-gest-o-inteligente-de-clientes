-- Atualiza a política de visualização de planos para permitir acesso anônimo aos planos públicos
DROP POLICY IF EXISTS "plans: público lê" ON public.plans;
CREATE POLICY "plans: público lê" ON public.plans
FOR SELECT
TO anon, authenticated
USING (status = 'public' OR is_super_admin(auth.uid()));
