ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

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
    AND auth.uid() IS NOT NULL;
$$;

-- Keep completed financial records for revenue reporting while unlinking them
-- from the deleted account and removing the customer's M-Pesa number.
ALTER TABLE public.payments
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_user_id_fkey,
  ADD CONSTRAINT payments_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION private.prepare_account_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  DELETE FROM public.payments
  WHERE user_id = OLD.id AND status = 'pending';

  UPDATE public.payments
  SET user_id = NULL, mpesa_phone = NULL
  WHERE user_id = OLD.id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS prepare_account_deletion ON public.profiles;
CREATE TRIGGER prepare_account_deletion
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.prepare_account_deletion();
