
CREATE OR REPLACE FUNCTION public.week_postpartum(_birth_date DATE)
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _birth_date IS NULL THEN NULL
              ELSE GREATEST(0, ((CURRENT_DATE - _birth_date) / 7))::int
         END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
