CREATE TABLE public.payment_settings (
  provider text PRIMARY KEY,
  api_username text NOT NULL,
  api_password text NOT NULL,
  channel_id text NOT NULL,
  verified_at timestamptz,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.payment_settings TO service_role;
REVOKE ALL ON public.payment_settings FROM anon, authenticated;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;