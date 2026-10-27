DROP POLICY IF EXISTS "partner reads consented checkins" ON public.checkins;
DROP POLICY IF EXISTS "partner reads consented appointments" ON public.health_records;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.partner_can_see(_mother uuid, _field text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.partner_consent_settings c ON c.mother_user_id = p.linked_user_id
    WHERE p.id = auth.uid()
      AND p.role = 'partner'::public.account_role
      AND p.linked_user_id = _mother
      AND CASE _field
        WHEN 'mood' THEN c.share_mood
        WHEN 'symptoms' THEN c.share_symptoms
        WHEN 'checkin_streak' THEN c.share_checkin_streak
        WHEN 'appointments' THEN c.share_appointments
        WHEN 'chat_summary' THEN c.share_chat_summary
        ELSE false
      END
  );
$$;

REVOKE ALL ON FUNCTION private.partner_can_see(uuid, text) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.partner_can_see(uuid, text);

CREATE POLICY "partner reads consented checkins"
ON public.checkins
FOR SELECT
TO authenticated
USING (
  private.partner_can_see(user_id, 'mood')
  OR private.partner_can_see(user_id, 'symptoms')
  OR private.partner_can_see(user_id, 'checkin_streak')
);

CREATE POLICY "partner reads consented appointments"
ON public.health_records
FOR SELECT
TO authenticated
USING (private.partner_can_see(user_id, 'appointments'));