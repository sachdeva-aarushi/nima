
-- 1. Extend profiles
DO $$ BEGIN
  CREATE TYPE public.account_role AS ENUM ('mother', 'partner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role public.account_role NOT NULL DEFAULT 'mother',
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. partner_invites
CREATE TABLE IF NOT EXISTS public.partner_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text NOT NULL UNIQUE,
  email text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','expired','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_invites TO authenticated;
GRANT ALL ON public.partner_invites TO service_role;
ALTER TABLE public.partner_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mother manages own invites" ON public.partner_invites
  FOR ALL TO authenticated
  USING (auth.uid() = mother_user_id)
  WITH CHECK (auth.uid() = mother_user_id);

-- Partners (unauthenticated lookup happens via server fn with service role; no anon policy here)

-- 3. partner_consent_settings
CREATE TABLE IF NOT EXISTS public.partner_consent_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mother_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  share_mood boolean NOT NULL DEFAULT false,
  share_symptoms boolean NOT NULL DEFAULT false,
  share_checkin_streak boolean NOT NULL DEFAULT false,
  share_appointments boolean NOT NULL DEFAULT false,
  share_chat_summary boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_consent_settings TO authenticated;
GRANT ALL ON public.partner_consent_settings TO service_role;
ALTER TABLE public.partner_consent_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mother manages own consent" ON public.partner_consent_settings
  FOR ALL TO authenticated
  USING (auth.uid() = mother_user_id)
  WITH CHECK (auth.uid() = mother_user_id);

CREATE POLICY "linked partner reads consent" ON public.partner_consent_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'partner'
        AND p.linked_user_id = partner_consent_settings.mother_user_id
    )
  );

CREATE TRIGGER trg_consent_updated_at BEFORE UPDATE ON public.partner_consent_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. partner_chat_messages
CREATE TABLE IF NOT EXISTS public.partner_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mother_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('partner','nima')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.partner_chat_messages TO authenticated;
GRANT ALL ON public.partner_chat_messages TO service_role;
ALTER TABLE public.partner_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partner manages own partner chat" ON public.partner_chat_messages
  FOR ALL TO authenticated
  USING (auth.uid() = partner_user_id)
  WITH CHECK (auth.uid() = partner_user_id);

-- 5. Consent-gated SELECT policies for partner access on mother's data
-- Helper: check if caller is the linked partner AND mother enabled a given flag
CREATE OR REPLACE FUNCTION public.partner_can_see(_mother uuid, _field text)
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
      AND p.role = 'partner'
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

-- Allow partner to SELECT mother's checkins when mood OR symptoms OR streak consented
DROP POLICY IF EXISTS "partner reads consented checkins" ON public.checkins;
CREATE POLICY "partner reads consented checkins" ON public.checkins
  FOR SELECT TO authenticated
  USING (
    public.partner_can_see(user_id, 'mood')
    OR public.partner_can_see(user_id, 'symptoms')
    OR public.partner_can_see(user_id, 'checkin_streak')
  );

-- Allow partner to SELECT mother's appointment-type health records when consented
DROP POLICY IF EXISTS "partner reads consented appointments" ON public.health_records;
CREATE POLICY "partner reads consented appointments" ON public.health_records
  FOR SELECT TO authenticated
  USING (
    public.partner_can_see(user_id, 'appointments')
  );

-- Allow partner to read linked mother's profile (limited via app projection)
DROP POLICY IF EXISTS "linked partner reads mother profile" ON public.profiles;
CREATE POLICY "linked partner reads mother profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role = 'partner'
        AND me.linked_user_id = profiles.id
    )
  );
