
DROP VIEW IF EXISTS public.public_profiles;

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.get_public_profiles() TO authenticated;

CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT * FROM private.get_public_profiles();

GRANT SELECT ON public.public_profiles TO authenticated;
