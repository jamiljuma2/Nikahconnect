-- Keep admin accounts out of member-facing profile discovery.
CREATE OR REPLACE FUNCTION private.get_public_profiles()
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
    AND p.deactivated_at IS NULL
    AND auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_roles r
      WHERE r.user_id = p.id AND r.role = 'admin'::public.app_role
    );
$$;

-- Direct profile reads are also used by messaging and must not expose admins.
DROP POLICY IF EXISTS "Authenticated can view non-suspended or own profiles" ON public.profiles;
CREATE POLICY "Authenticated can view member profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::public.app_role)
    OR (
      suspended IS NOT TRUE
      AND deactivated_at IS NULL
      AND NOT private.has_role(id, 'admin'::public.app_role)
    )
  );

-- Hide existing admin matches from member inboxes and chat queries.
DROP POLICY IF EXISTS "Users view their matches" ON public.matches;
CREATE POLICY "Users view member matches"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    (user_one = auth.uid() OR user_two = auth.uid())
    AND (
      private.has_role(auth.uid(), 'admin'::public.app_role)
      OR (
        NOT private.has_role(user_one, 'admin'::public.app_role)
        AND NOT private.has_role(user_two, 'admin'::public.app_role)
      )
    )
  );

-- Prevent new likes to admin accounts from regular members.
DROP POLICY IF EXISTS "Users create their own likes" ON public.likes;
CREATE POLICY "Users like member profiles"
  ON public.likes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND NOT private.has_role(receiver_id, 'admin'::public.app_role)
  );
