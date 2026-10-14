-- Private member safety reports. Only trusted server functions may read or write reports.
CREATE TABLE public.user_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN (
    'harassment', 'inappropriate_content', 'scam', 'fake_profile', 'underage', 'other'
  )),
  details text NOT NULL DEFAULT '' CHECK (char_length(details) <= 1000),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT user_reports_no_self_report CHECK (reporter_id <> reported_user_id)
);

CREATE INDEX user_reports_status_created_idx ON public.user_reports(status, created_at DESC);
CREATE INDEX user_reports_reported_user_idx ON public.user_reports(reported_user_id, created_at DESC);
CREATE UNIQUE INDEX user_reports_one_open_per_pair_idx
  ON public.user_reports(reporter_id, reported_user_id)
  WHERE status IN ('pending', 'reviewing');

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_reports FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_reports TO service_role;
