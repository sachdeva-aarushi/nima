
CREATE TABLE public.partner_care_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mother_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('emotional_support', 'check_in', 'milestone')),
  alert_context TEXT NOT NULL,
  nima_guidance JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seen_at TIMESTAMPTZ
);

CREATE INDEX partner_care_alerts_partner_idx ON public.partner_care_alerts (partner_user_id, seen_at, created_at DESC);
CREATE INDEX partner_care_alerts_mother_idx ON public.partner_care_alerts (mother_user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_care_alerts TO authenticated;
GRANT ALL ON public.partner_care_alerts TO service_role;

ALTER TABLE public.partner_care_alerts ENABLE ROW LEVEL SECURITY;

-- Mother can see her own sent alerts (for the small "partner notified" indicator)
CREATE POLICY "mother_can_read_own_alerts" ON public.partner_care_alerts
  FOR SELECT TO authenticated
  USING (auth.uid() = mother_user_id);

-- Partner can read alerts addressed to them, ONLY if mother consented to share_mood
CREATE POLICY "partner_can_read_alerts_with_consent" ON public.partner_care_alerts
  FOR SELECT TO authenticated
  USING (
    auth.uid() = partner_user_id
    AND EXISTS (
      SELECT 1 FROM public.partner_consent_settings pcs
      WHERE pcs.mother_user_id = partner_care_alerts.mother_user_id
        AND pcs.share_mood = true
    )
  );

-- Partner can mark their alerts seen
CREATE POLICY "partner_can_mark_seen" ON public.partner_care_alerts
  FOR UPDATE TO authenticated
  USING (auth.uid() = partner_user_id)
  WITH CHECK (auth.uid() = partner_user_id);

-- Inserts happen via service_role through the notify_partner tool path; no direct user inserts needed.
