CREATE OR REPLACE FUNCTION public.is_partner_linked_to_mother(_mother uuid)
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

REVOKE ALL ON FUNCTION public.is_partner_linked_to_mother(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_partner_linked_to_mother(uuid) TO authenticated;

DROP POLICY IF EXISTS "linked partner reads mother profile" ON public.profiles;
CREATE POLICY "linked partner reads mother profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_partner_linked_to_mother(id));

DROP POLICY IF EXISTS "linked partner reads consent" ON public.partner_consent_settings;
CREATE POLICY "linked partner reads consent"
ON public.partner_consent_settings
FOR SELECT
TO authenticated
USING (public.is_partner_linked_to_mother(mother_user_id));