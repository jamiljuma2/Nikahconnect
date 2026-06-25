
-- Tighten profiles RLS so only the owner (and admins) can read full rows.
-- Public discoverable fields are exposed via public_profiles view, which
-- is switched to SECURITY DEFINER so it can read profile rows on behalf of
-- authenticated users without exposing phone_number or email.

DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;

CREATE POLICY "Users view own profile or admins view all"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Recreate the public_profiles view as security_definer so authenticated
-- users can discover other (non-suspended) profiles through safe columns
-- only, without needing direct row-level access to the profiles table.
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = false) AS
SELECT
  id,
  full_name,
  gender,
  location,
  bio,
  avatar_url,
  interests,
  occupation,
  relationship_goal,
  EXTRACT(YEAR FROM age(dob))::int AS age,
  suspended,
  created_at
FROM public.profiles
WHERE suspended = false;

GRANT SELECT ON public.public_profiles TO authenticated;

-- Revoke the previously granted dob column read; no longer needed since
-- the view runs as definer.
REVOKE SELECT (dob) ON public.profiles FROM authenticated;
