-- Allow blog cover uploads for staff and public reads for the blog photo bucket.
-- This fixes the "new row violates row-level security policy" error when uploading images
-- into the `blog photo` bucket used by the blog editor.

DROP POLICY IF EXISTS "public reads blog photo files" ON storage.objects;
CREATE POLICY "public reads blog photo files"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'blog photo');

DROP POLICY IF EXISTS "staff manages blog photo files" ON storage.objects;
CREATE POLICY "staff manages blog photo files"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'blog photo' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'blog photo' AND public.is_staff(auth.uid()));
