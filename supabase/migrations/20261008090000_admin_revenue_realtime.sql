CREATE OR REPLACE FUNCTION public.admin_collected_revenue()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN COALESCE(
    (SELECT SUM(amount)::bigint FROM public.payments WHERE status = 'success'),
    0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_collected_revenue() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_collected_revenue() TO authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'payments'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
  END IF;
END;
$$;
