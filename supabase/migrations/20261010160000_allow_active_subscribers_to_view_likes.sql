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

REVOKE ALL ON FUNCTION public.can_view_incoming_likes() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_incoming_likes() TO authenticated;
