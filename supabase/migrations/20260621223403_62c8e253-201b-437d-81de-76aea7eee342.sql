
REVOKE EXECUTE ON FUNCTION public.partner_can_see(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.partner_can_see(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.partner_can_see(uuid, text) TO authenticated, service_role;
