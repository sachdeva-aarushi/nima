DROP POLICY IF EXISTS "linked partner reads mother profile" ON public.profiles;
DROP POLICY IF EXISTS "linked partner reads consent" ON public.partner_consent_settings;

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_partner_linked_to_mother(_mother uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'partner'::public.account_role
      AND p.linked_user_id = _mother
  );
$$;

REVOKE ALL ON FUNCTION private.is_partner_linked_to_mother(uuid) FROM PUBLIC;
DROP FUNCTION IF EXISTS public.is_partner_linked_to_mother(uuid);

CREATE POLICY "linked partner reads mother profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (private.is_partner_linked_to_mother(id));

CREATE POLICY "linked partner reads consent"
ON public.partner_consent_settings
FOR SELECT
TO authenticated
USING (private.is_partner_linked_to_mother(mother_user_id));