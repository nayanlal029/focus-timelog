
-- Lock down user_profiles SELECT (was public)
DROP POLICY IF EXISTS "user_profiles public select" ON public.user_profiles;

CREATE POLICY "user_profiles owner select"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RPC: resolve handle -> email for sign-in (callable by anon, no enumeration of arbitrary data beyond what login needs)
CREATE OR REPLACE FUNCTION public.get_email_for_handle(_handle text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.user_profiles
  WHERE handle = lower(trim(_handle))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_email_for_handle(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_email_for_handle(text) TO anon, authenticated;

-- RPC: check handle availability without exposing other rows
CREATE OR REPLACE FUNCTION public.is_handle_available(_handle text, _exclude_user uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE handle = lower(trim(_handle))
      AND (_exclude_user IS NULL OR user_id <> _exclude_user)
  );
$$;

REVOKE ALL ON FUNCTION public.is_handle_available(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_handle_available(text, uuid) TO authenticated;
