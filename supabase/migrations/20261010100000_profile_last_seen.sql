ALTER TABLE public.profiles
  ADD COLUMN last_seen_at timestamptz;

GRANT SELECT (last_seen_at) ON public.profiles TO authenticated;
