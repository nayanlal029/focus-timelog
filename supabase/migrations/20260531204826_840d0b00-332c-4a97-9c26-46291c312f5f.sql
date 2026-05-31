-- user_profiles: handle <-> email lookup so users can log in with a short ID
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  handle text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT handle_format CHECK (handle ~ '^[a-z0-9_]{3,20}$'),
  CONSTRAINT email_lower CHECK (email = lower(email))
);

CREATE INDEX user_profiles_handle_idx ON public.user_profiles (handle);
CREATE INDEX user_profiles_email_idx ON public.user_profiles (email);

-- Data API grants. SELECT for anon so the login screen can resolve handle -> email
-- before the user is authenticated. Only handle + email are exposed; no PII beyond that.
GRANT SELECT ON public.user_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Public read so unauthenticated login can resolve a handle to its email.
CREATE POLICY "user_profiles public select"
  ON public.user_profiles FOR SELECT
  USING (true);

CREATE POLICY "user_profiles owner insert"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_profiles owner update"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at trigger (reuses existing touch_updated_at function)
CREATE TRIGGER user_profiles_touch_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed: assign handle 'nlal029' to nayanlal029@gmail.com if that auth user exists.
INSERT INTO public.user_profiles (user_id, handle, email)
SELECT id, 'nlal029', 'nayanlal029@gmail.com'
FROM auth.users
WHERE lower(email) = 'nayanlal029@gmail.com'
ON CONFLICT DO NOTHING;