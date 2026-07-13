
-- Fix: profiles must be browsable by authenticated users (non-suspended), plus self and admins
DROP POLICY IF EXISTS "Users view own profile or admins view all" ON public.profiles;
CREATE POLICY "Authenticated can view non-suspended or own profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR private.has_role(auth.uid(), 'admin'::app_role)
  OR suspended IS NOT TRUE
);

-- Fix: prevent users from inserting arbitrary matches. Matches are created only by
-- the SECURITY DEFINER trigger handle_mutual_like (which runs as table owner and
-- bypasses RLS), or by service_role. Remove the permissive INSERT policy.
DROP POLICY IF EXISTS "Participants create their matches" ON public.matches;
