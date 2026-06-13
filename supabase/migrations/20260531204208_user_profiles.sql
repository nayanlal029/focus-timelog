CREATE TABLE public.user_profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle     TEXT UNIQUE NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX user_profiles_handle_idx ON public.user_profiles(handle);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Public SELECT so unauthenticated clients can resolve handle → email during login
CREATE POLICY "public handle lookup" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "own profile insert"   ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update"   ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER user_profiles_touch BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed nlal for nayanlal029@gmail.com (idempotent; no-op if user doesn't exist yet)
DO $$
BEGIN
  INSERT INTO public.user_profiles (user_id, handle, email)
  SELECT id, 'nlal', email FROM auth.users WHERE email = 'nayanlal029@gmail.com'
  ON CONFLICT (user_id) DO UPDATE SET handle = 'nlal';
END $$;
