-- Keep full profile rows private. Members use public_profiles for the
-- intentionally limited discovery projection.
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile or admins view all" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view non-suspended or own profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated can view member profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;

CREATE POLICY "Members view own profile and admins view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- The auth trigger creates profiles. Clients may update only ordinary profile
-- fields and their own last-seen timestamp; moderation and lifecycle flags are
-- writable only by trusted server-side code.
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (
  full_name, location, bio, occupation, relationship_goal, interests,
  avatar_url, last_seen_at
) ON public.profiles TO authenticated;
GRANT SELECT (
  id, full_name, gender, dob, location, bio, avatar_url, interests,
  occupation, relationship_goal, deactivated_at, last_seen_at, created_at,
  updated_at
) ON public.profiles TO authenticated;

-- Birth dates are private and immutable from the member client. Enforce adult
-- eligibility in the database so a direct Auth API call cannot bypass the UI.
CREATE OR REPLACE FUNCTION private.require_adult_profile()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.dob IS NULL OR NEW.dob > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'registration_requires_adult';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_require_adult ON public.profiles;
CREATE TRIGGER profiles_require_adult
  BEFORE INSERT OR UPDATE OF dob ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.require_adult_profile();

-- Record the versioned acceptance supplied during signup. No IP address or
-- extra device identifiers are collected for this audit record.
CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('terms', 'profile_visibility')),
  consent_version text NOT NULL,
  consented_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_type, consent_version)
);
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_consents FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_consents TO service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dob date;
  v_terms_version text;
BEGIN
  IF NEW.raw_user_meta_data->>'terms_accepted' IS DISTINCT FROM 'true'
     OR NEW.raw_user_meta_data->>'profile_visibility_accepted' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'registration_requires_consent';
  END IF;

  v_terms_version := NEW.raw_user_meta_data->>'terms_version';
  IF v_terms_version IS DISTINCT FROM '2026-10-13' THEN
    RAISE EXCEPTION 'registration_requires_current_terms';
  END IF;

  v_dob := (NEW.raw_user_meta_data->>'dob')::date;
  IF v_dob > (CURRENT_DATE - INTERVAL '18 years')::date THEN
    RAISE EXCEPTION 'registration_requires_adult';
  END IF;

  INSERT INTO public.profiles (id, full_name, gender, dob, location)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', ''),
    coalesce((NEW.raw_user_meta_data->>'gender')::public.gender_type, 'other'),
    v_dob,
    coalesce(NEW.raw_user_meta_data->>'location', '')
  );
  INSERT INTO public.user_contacts (user_id, email, phone_number)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data->>'phone_number', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.user_consents (user_id, consent_type, consent_version)
  VALUES
    (NEW.id, 'terms', v_terms_version),
    (NEW.id, 'profile_visibility', v_terms_version);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Keep conversation updates participant-only and limit client updates to the
-- read receipt field. Message content and sender identity are immutable from
-- the browser after insert.
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;

-- Rebuild the discovery projection with safe fields only. Full rows remain
-- available to their owner and trusted admin code; the birthday is reduced to
-- age for member-facing discovery.
DROP VIEW IF EXISTS public.public_profiles;
DROP FUNCTION IF EXISTS private.get_public_profiles();
CREATE FUNCTION private.get_public_profiles()
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
  created_at timestamptz,
  last_seen_at timestamptz
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
    EXTRACT(YEAR FROM age(p.dob))::int,
    p.suspended,
    p.created_at,
    p.last_seen_at
  FROM public.profiles p
  WHERE p.suspended IS FALSE
    AND p.deactivated_at IS NULL
    AND auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = p.id AND r.role = 'admin'::public.app_role
    );
$$;
REVOKE ALL ON FUNCTION private.get_public_profiles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.get_public_profiles() TO authenticated;
CREATE VIEW public.public_profiles WITH (security_invoker = true) AS
  SELECT * FROM private.get_public_profiles();
GRANT SELECT ON public.public_profiles TO authenticated;
