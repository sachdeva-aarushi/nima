
-- 1. experience-covers bucket: replace blanket "any authenticated user" read
DROP POLICY IF EXISTS "Authenticated users can view experience covers" ON storage.objects;

CREATE POLICY "View experience covers (owner or published)"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'experience-covers'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1
      FROM public.experience_posts ep
      WHERE ep.cover_image_path = storage.objects.name
        AND ep.status = 'published'
    )
  )
);

-- 2. experience_posts.ai_flag_reason: never expose via PostgREST to the
--    authenticated role. Service role keeps full access for admin reads.
REVOKE SELECT ON public.experience_posts FROM authenticated;
GRANT SELECT (
  id,
  user_id,
  display_name,
  title,
  content,
  topic_tags,
  status,
  crisis_flagged,
  ai_flagged,
  like_count,
  view_count,
  week_postpartum,
  created_at,
  updated_at,
  cover_image_path
) ON public.experience_posts TO authenticated;

-- 3. partner_invites: only the mother who owns the invite may read it.
DROP POLICY IF EXISTS "partner reads accepted invites" ON public.partner_invites;
DROP POLICY IF EXISTS "partner_invites restrictive select baseline" ON public.partner_invites;

CREATE POLICY "partner_invites restrictive select baseline"
ON public.partner_invites
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (auth.uid() = mother_user_id);
