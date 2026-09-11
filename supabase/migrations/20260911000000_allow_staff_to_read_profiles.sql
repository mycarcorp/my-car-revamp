CREATE POLICY "staff reads profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));