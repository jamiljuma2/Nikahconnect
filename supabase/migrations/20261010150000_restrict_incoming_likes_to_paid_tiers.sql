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
      AND s.plan IN ('standard', 'premium')
      AND (s.expiry_date IS NULL OR s.expiry_date > now())
      AND p.user_id = auth.uid()
      AND p.status = 'success'
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_incoming_likes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_incoming_likes() TO authenticated;

DROP POLICY IF EXISTS "Users view likes they sent or received" ON public.likes;
CREATE POLICY "Users view sent likes and paid-tier incoming likes"
  ON public.likes FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR (receiver_id = auth.uid() AND public.can_view_incoming_likes())
  );
