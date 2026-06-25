
-- Replace the security-definer view with a security-invoker view backed by
-- a security-definer function, which is the Supabase-recommended pattern.

DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.get_public_profiles()
RETURNS TABLE (
  id uuid,
  full_name text,
  gender public.gender_type,
  location text,
  bio text,
  avatar_url text,
  interests text[],
  occupation text,
  relationship_goal text,
  age int,
  suspended boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.gender,
    p.location,
    p.bio,
    p.avatar_url,
    p.interests,
    p.occupation,
    p.relationship_goal,
    EXTRACT(YEAR FROM age(p.dob))::int AS age,
    p.suspended,
    p.created_at
  FROM public.profiles p
  WHERE p.suspended = false
    AND auth.uid() IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_public_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profiles() TO authenticated;

CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT * FROM public.get_public_profiles();

GRANT SELECT ON public.public_profiles TO authenticated;
