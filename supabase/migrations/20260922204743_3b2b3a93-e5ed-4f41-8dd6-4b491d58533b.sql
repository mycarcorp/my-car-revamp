-- appointments: constrain public booking inserts
DROP POLICY IF EXISTS "anyone books" ON public.appointments;
CREATE POLICY "anyone books" ON public.appointments
  FOR INSERT TO anon, authenticated
  WITH CHECK (confirmed = false AND scheduled_for > now());

-- leads: constrain public submissions
DROP POLICY IF EXISTS "anyone submits a lead" ON public.leads;
CREATE POLICY "anyone submits a lead" ON public.leads
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'new'::lead_status
    AND internal_notes IS NULL
    AND assigned_to IS NULL
    AND (user_id IS NULL OR user_id = auth.uid())
    AND length(full_name) BETWEEN 1 AND 200
    AND length(email) BETWEEN 3 AND 320
    AND (phone IS NULL OR length(phone) <= 40)
    AND (message IS NULL OR length(message) <= 5000)
  );

-- vehicle_photos: only photos of publicly listed vehicles
DROP POLICY IF EXISTS "public reads photos" ON public.vehicle_photos;
CREATE POLICY "public reads photos" ON public.vehicle_photos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = vehicle_photos.vehicle_id
        AND v.status <> 'draft'::vehicle_status
    )
    OR public.is_staff(auth.uid())
  );

-- site_settings: only the single settings row
DROP POLICY IF EXISTS "public reads settings" ON public.site_settings;
CREATE POLICY "public reads settings" ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (id = 1);

-- service_areas: publish flag
ALTER TABLE public.service_areas
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
DROP POLICY IF EXISTS "public reads areas" ON public.service_areas;
CREATE POLICY "public reads areas" ON public.service_areas
  FOR SELECT TO anon, authenticated
  USING (active OR public.is_staff(auth.uid()));

-- storage: vehicle photo files are served through the app proxy, not downloaded directly
DROP POLICY IF EXISTS "public reads vehicle photo files" ON storage.objects;
CREATE POLICY "staff reads vehicle photo files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-photos' AND public.is_staff(auth.uid()));