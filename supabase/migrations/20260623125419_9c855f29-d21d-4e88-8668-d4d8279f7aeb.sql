-- 1. Add UPDATE policy for experience-covers bucket (mirror INSERT/DELETE scope)
CREATE POLICY "Users can update their own experience covers"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'experience-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'experience-covers'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. Add a RESTRICTIVE deny-all baseline on partner_invites SELECT so the only
-- way to read a row is via one of the two permissive policies
-- (mother owner OR accepted partner). Defense-in-depth against future
-- permissive policies accidentally widening access.
CREATE POLICY "partner_invites restrictive select baseline"
ON public.partner_invites
AS RESTRICTIVE
FOR SELECT
TO authenticated
USING (
  auth.uid() = mother_user_id
  OR (accepted_by = auth.uid() AND status = 'accepted')
);