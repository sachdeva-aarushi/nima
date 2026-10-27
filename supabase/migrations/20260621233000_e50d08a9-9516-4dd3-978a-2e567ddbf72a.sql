DROP POLICY IF EXISTS "linked partner reads mother profile" ON public.profiles;
DROP POLICY IF EXISTS "linked partner reads consent" ON public.partner_consent_settings;
DROP POLICY IF EXISTS "partner reads accepted invites" ON public.partner_invites;
DROP POLICY IF EXISTS "partner reads consented checkins" ON public.checkins;
DROP POLICY IF EXISTS "partner reads consented appointments" ON public.health_records;

CREATE POLICY "partner reads accepted invites"
ON public.partner_invites
FOR SELECT
TO authenticated
USING (accepted_by = auth.uid() AND status = 'accepted');

CREATE POLICY "linked partner reads mother profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partner_invites i
    WHERE i.accepted_by = auth.uid()
      AND i.status = 'accepted'
      AND i.mother_user_id = profiles.id
  )
);

CREATE POLICY "linked partner reads consent"
ON public.partner_consent_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partner_invites i
    WHERE i.accepted_by = auth.uid()
      AND i.status = 'accepted'
      AND i.mother_user_id = partner_consent_settings.mother_user_id
  )
);

CREATE POLICY "partner reads consented checkins"
ON public.checkins
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partner_invites i
    JOIN public.partner_consent_settings c ON c.mother_user_id = i.mother_user_id
    WHERE i.accepted_by = auth.uid()
      AND i.status = 'accepted'
      AND i.mother_user_id = checkins.user_id
      AND (c.share_mood OR c.share_symptoms OR c.share_checkin_streak)
  )
);

CREATE POLICY "partner reads consented appointments"
ON public.health_records
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.partner_invites i
    JOIN public.partner_consent_settings c ON c.mother_user_id = i.mother_user_id
    WHERE i.accepted_by = auth.uid()
      AND i.status = 'accepted'
      AND i.mother_user_id = health_records.user_id
      AND c.share_appointments
  )
);

DROP FUNCTION IF EXISTS private.is_partner_linked_to_mother(uuid);
DROP FUNCTION IF EXISTS private.partner_can_see(uuid, text);