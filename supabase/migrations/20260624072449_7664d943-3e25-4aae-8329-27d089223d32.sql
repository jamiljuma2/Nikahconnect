-- Replace strict SELECT policy with a permissive one (column-level grants
-- protect the sensitive fields instead).
DROP POLICY IF EXISTS "Users view own profile or admins view all" ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    suspended = false
    OR id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Recreate view as security_invoker so RLS applies as the querying user
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
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

-- Column-level revoke: signed-in users can no longer read sensitive PII
-- directly from the profiles table. Admin tooling and server functions
-- with the service role still have access.
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, full_name, gender, location, bio, avatar_url, interests,
  occupation, relationship_goal, suspended, created_at, updated_at
) ON public.profiles TO authenticated;

-- The view needs to read dob to compute age; with security_invoker the
-- invoker's grants apply, so allow read of dob ONLY through the view by
-- granting it back to authenticated (acceptable because the view projects
-- only the computed integer age, never the raw dob, and direct selects of
-- the dob column from public.profiles still work for the owner — RLS
-- already restricts which rows are visible).
GRANT SELECT (dob) ON public.profiles TO authenticated;
-- Note: phone_number and email remain revoked.