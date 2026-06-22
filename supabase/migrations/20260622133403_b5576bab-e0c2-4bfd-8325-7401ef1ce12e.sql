
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('user', 'admin');
CREATE TYPE public.gender_type AS ENUM ('male', 'female', 'other');
CREATE TYPE public.plan_type AS ENUM ('starter', 'standard', 'premium');
CREATE TYPE public.payment_status AS ENUM ('pending', 'success', 'failed');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  phone_number text NOT NULL,
  gender public.gender_type NOT NULL,
  dob date NOT NULL,
  location text NOT NULL,
  bio text DEFAULT '',
  avatar_url text,
  interests text[] DEFAULT '{}',
  occupation text DEFAULT '',
  relationship_goal text DEFAULT '',
  suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ PROFILE PHOTOS ============
CREATE TABLE public.profile_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  sort int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_photos TO authenticated;
GRANT ALL ON public.profile_photos TO service_role;
ALTER TABLE public.profile_photos ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ LIKES ============
CREATE TABLE public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id),
  CHECK (sender_id <> receiver_id)
);
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- ============ MATCHES ============
-- user_one < user_two (canonical ordering) to enforce uniqueness
CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_one uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_two uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_one, user_two),
  CHECK (user_one < user_two)
);
GRANT SELECT, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- ============ MESSAGES (with strict digit block via CHECK) ============
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_no_digits CHECK (content !~ '[0-9]'),
  CONSTRAINT messages_not_empty CHECK (length(btrim(content)) > 0)
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- ============ SUBSCRIPTIONS ============
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan public.plan_type NOT NULL,
  remaining_reveals int NOT NULL DEFAULT 0,
  is_unlimited boolean NOT NULL DEFAULT false,
  start_date timestamptz NOT NULL DEFAULT now(),
  expiry_date timestamptz
);
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- ============ NUMBER REVEALS ============
CREATE TABLE public.number_reveals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  revealed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(viewer_id, profile_owner_id)
);
GRANT SELECT ON public.number_reveals TO authenticated;
GRANT ALL ON public.number_reveals TO service_role;
ALTER TABLE public.number_reveals ENABLE ROW LEVEL SECURITY;

-- ============ PAYMENTS ============
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  transaction_id text UNIQUE,
  amount int NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  plan_type public.plan_type NOT NULL,
  mpesa_phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated USING (suspended = false OR id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Admins delete profiles"
  ON public.profiles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profile_photos
CREATE POLICY "Photos viewable by authenticated"
  ON public.profile_photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users manage own photos insert"
  ON public.profile_photos FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users manage own photos delete"
  ON public.profile_photos FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users manage own photos update"
  ON public.profile_photos FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- user_roles
CREATE POLICY "Users view own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- likes
CREATE POLICY "Users view likes they sent or received"
  ON public.likes FOR SELECT TO authenticated USING (sender_id = auth.uid() OR receiver_id = auth.uid());
CREATE POLICY "Users create their own likes"
  ON public.likes FOR INSERT TO authenticated WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users remove their own likes"
  ON public.likes FOR DELETE TO authenticated USING (sender_id = auth.uid());

-- matches
CREATE POLICY "Users view their matches"
  ON public.matches FOR SELECT TO authenticated USING (user_one = auth.uid() OR user_two = auth.uid());

-- messages
CREATE POLICY "Users view messages in their matches"
  ON public.messages FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_one = auth.uid() OR m.user_two = auth.uid()))
  );
CREATE POLICY "Users send messages in their matches"
  ON public.messages FOR INSERT TO authenticated WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_one = auth.uid() OR m.user_two = auth.uid()))
  );
CREATE POLICY "Recipients mark messages as read"
  ON public.messages FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_one = auth.uid() OR m.user_two = auth.uid()))
    AND sender_id <> auth.uid()
  );

-- subscriptions
CREATE POLICY "Users view own subscriptions"
  ON public.subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- number_reveals
CREATE POLICY "Users view their reveals"
  ON public.number_reveals FOR SELECT TO authenticated USING (viewer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- payments
CREATE POLICY "Users view own payments"
  ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ TRIGGERS ============

-- Auto-create profile on signup using user metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone_number, gender, dob, location)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
    COALESCE((NEW.raw_user_meta_data->>'gender')::public.gender_type, 'other'),
    COALESCE((NEW.raw_user_meta_data->>'dob')::date, '2000-01-01'::date),
    COALESCE(NEW.raw_user_meta_data->>'location', '')
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-create match when reverse like exists
CREATE OR REPLACE FUNCTION public.handle_mutual_like()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u1 uuid; u2 uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.likes WHERE sender_id = NEW.receiver_id AND receiver_id = NEW.sender_id) THEN
    u1 := LEAST(NEW.sender_id, NEW.receiver_id);
    u2 := GREATEST(NEW.sender_id, NEW.receiver_id);
    INSERT INTO public.matches (user_one, user_two) VALUES (u1, u2) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_like_insert
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.handle_mutual_like();

-- updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER payments_touch BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Indexes
CREATE INDEX idx_messages_match ON public.messages(match_id, created_at);
CREATE INDEX idx_likes_receiver ON public.likes(receiver_id);
CREATE INDEX idx_matches_users ON public.matches(user_one, user_two);
CREATE INDEX idx_subs_user ON public.subscriptions(user_id, start_date DESC);
