-- Keep draft vehicle records and their direct storage objects staff-only.
DROP POLICY IF EXISTS "public reads photos" ON public.vehicle_photos;
CREATE POLICY "public reads published photos" ON public.vehicle_photos
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.vehicles
      WHERE public.vehicles.id = vehicle_photos.vehicle_id
        AND (public.vehicles.status <> 'draft' OR public.is_staff(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "public reads vehicle photo files" ON storage.objects;
CREATE POLICY "staff reads vehicle photo files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'vehicle-photos' AND public.is_staff(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_vin_unique_idx ON public.vehicles (vin);
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_photos_vehicle_position_idx
  ON public.vehicle_photos (vehicle_id, position);
