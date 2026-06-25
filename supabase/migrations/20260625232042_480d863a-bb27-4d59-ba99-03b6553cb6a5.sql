
-- 1. user_contacts table holds sensitive email + phone separately from profiles
CREATE TABLE public.user_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  phone_number text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_contacts TO authenticated;
GRANT ALL ON public.user_contacts TO service_role;

ALTER TABLE public.user_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners view own contact info"
  ON public.user_contacts FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER user_contacts_touch_updated_at
  BEFORE UPDATE ON public.user_contacts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Backfill from existing profiles
INSERT INTO public.user_contacts (user_id, email, phone_number)
SELECT id, email, phone_number FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- 2. Update new-user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, gender, dob, location)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'gender')::public.gender_type, 'other'),
    COALESCE((NEW.raw_user_meta_data->>'dob')::date, '2000-01-01'::date),
    COALESCE(NEW.raw_user_meta_data->>'location', '')
  );
  INSERT INTO public.user_contacts (user_id, email, phone_number)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;

-- 3. Drop sensitive columns from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS email;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS phone_number;

-- 4. matches: INSERT/DELETE restricted to participants
CREATE POLICY "Participants create their matches"
  ON public.matches FOR INSERT
  TO authenticated
  WITH CHECK (user_one = auth.uid() OR user_two = auth.uid());

CREATE POLICY "Participants or admins delete matches"
  ON public.matches FOR DELETE
  TO authenticated
  USING (
    user_one = auth.uid()
    OR user_two = auth.uid()
    OR private.has_role(auth.uid(), 'admin'::app_role)
  );

-- 5. number_reveals: INSERT viewer-only, DELETE viewer/admin
CREATE POLICY "Viewers record their own reveals"
  ON public.number_reveals FOR INSERT
  TO authenticated
  WITH CHECK (viewer_id = auth.uid());

CREATE POLICY "Viewer or admin deletes reveals"
  ON public.number_reveals FOR DELETE
  TO authenticated
  USING (viewer_id = auth.uid() OR private.has_role(auth.uid(), 'admin'::app_role));

-- 6. payments: INSERT own only; UPDATE/DELETE admin only (server uses service role bypass)
CREATE POLICY "Users create own payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins update payments"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete payments"
  ON public.payments FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 7. subscriptions: writes admin-only (server uses service role bypass)
CREATE POLICY "Admins create subscriptions"
  ON public.subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update subscriptions"
  ON public.subscriptions FOR UPDATE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete subscriptions"
  ON public.subscriptions FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
