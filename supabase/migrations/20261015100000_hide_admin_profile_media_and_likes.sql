-- Keep administrator accounts out of member-facing profile media and likes.
-- The public profile projection already omits admin accounts; these policies
-- close direct table and storage listing paths that bypass that projection.

-- Keep this migration independent of whether the earlier likes migration has
-- already created its entitlement helper in the hosted database.
CREATE OR REPLACE FUNCTION public.can_view_incoming_likes()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.subscriptions AS s
    JOIN public.payments AS p ON p.id = s.payment_id
    WHERE s.user_id = auth.uid()
      AND (s.expiry_date IS NULL OR s.expiry_date > now())
      AND p.user_id = auth.uid()
      AND p.status = 'success'
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_incoming_likes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_incoming_likes() TO authenticated;

DROP POLICY IF EXISTS "Photos viewable by authenticated" ON public.profile_photos;
CREATE POLICY "Members view member profile photos"
  ON public.profile_photos
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM private.get_public_profiles() AS member
      WHERE member.id = profile_photos.user_id
    )
  );

DROP POLICY IF EXISTS "Authenticated can view profile photos" ON storage.objects;
CREATE POLICY "Authenticated can view member profile photos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'profile-photos'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (
        SELECT 1
        FROM private.get_public_profiles() AS member
        WHERE member.id::text = (storage.foldername(name))[1]
      )
    )
  );

DROP POLICY IF EXISTS "Users view sent likes and paid-tier incoming likes" ON public.likes;
DROP POLICY IF EXISTS "Users view likes they sent or received" ON public.likes;
CREATE POLICY "Users view likes between member accounts"
  ON public.likes
  FOR SELECT
  TO authenticated
  USING (
    (
      sender_id = auth.uid()
      AND NOT private.has_role(receiver_id, 'admin'::public.app_role)
    )
    OR (
      receiver_id = auth.uid()
      AND public.can_view_incoming_likes()
      AND NOT private.has_role(sender_id, 'admin'::public.app_role)
    )
  );
