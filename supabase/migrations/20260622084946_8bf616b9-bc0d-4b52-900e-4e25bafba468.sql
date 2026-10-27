
ALTER TABLE public.experience_posts ADD COLUMN IF NOT EXISTS cover_image_path text;

-- Storage policies for experience-covers bucket
CREATE POLICY "Authenticated users can view experience covers"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'experience-covers');

CREATE POLICY "Users can upload their own experience covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'experience-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own experience covers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'experience-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
