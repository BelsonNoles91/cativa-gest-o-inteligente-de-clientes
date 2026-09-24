DROP POLICY IF EXISTS "plans: público lê" ON public.plans;
CREATE POLICY "plans: visitantes leem públicos" ON public.plans FOR SELECT TO anon USING (status = 'public'::plan_status);
CREATE POLICY "plans: usuários leem públicos ou super admin" ON public.plans FOR SELECT TO authenticated USING (status = 'public'::plan_status OR public.is_super_admin(auth.uid()));