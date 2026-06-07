-- ============================================================================
-- Focus-TimeLog — Full schema for a fresh Supabase project
-- ============================================================================
-- This consolidates all 4 migrations in supabase/migrations/ into the FINAL
-- state, so you can paste it directly into a new project's SQL Editor
-- (Dashboard → SQL Editor → New query → paste → Run) without the CLI.
--
-- Safe to run once on an EMPTY project. Idempotent guards included where
-- practical. Run order matters — execute top to bottom in a single run.
-- ============================================================================

-- 1) Enum for category type ---------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.category_type AS ENUM ('focus','distraction','neutral');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2) updated_at trigger function (search_path pinned) -------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- 3) categories ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id         TEXT NOT NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       public.category_type NOT NULL,
  "order"    INTEGER NOT NULL DEFAULT 0,
  builtin    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)            -- composite PK (final state)
);

CREATE INDEX IF NOT EXISTS categories_user_idx ON public.categories(user_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own categories select" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own categories insert" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own categories update" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own categories delete" ON public.categories FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER categories_touch BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4) time_blocks --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.time_blocks (
  id            TEXT NOT NULL,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id   TEXT NOT NULL,           -- references categories.id (no FK; app-managed)
  category_name TEXT NOT NULL,           -- snapshot, survives category renames
  type          public.category_type NOT NULL,
  start_ms      BIGINT NOT NULL,
  end_ms        BIGINT NOT NULL,
  note          TEXT,
  link          TEXT,
  is_break      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, id)             -- composite PK (final state)
);

CREATE INDEX IF NOT EXISTS time_blocks_user_start_idx ON public.time_blocks(user_id, start_ms DESC);

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own blocks select" ON public.time_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own blocks insert" ON public.time_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own blocks update" ON public.time_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own blocks delete" ON public.time_blocks FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER time_blocks_touch BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 5) user_profiles (handle → email lookup for cross-device login) -------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handle     TEXT UNIQUE NOT NULL,
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_profiles_handle_idx ON public.user_profiles(handle);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Public SELECT so unauthenticated clients can resolve handle → email at login.
CREATE POLICY "public handle lookup" ON public.user_profiles FOR SELECT USING (true);
CREATE POLICY "own profile insert"   ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile update"   ON public.user_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER user_profiles_touch BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 6) Realtime — broadcast row changes to connected clients --------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;

-- 7) Seed your handle ---------------------------------------------------------
-- NOTE: this only works AFTER you have signed up with this email on the NEW
-- project (auth.users must contain the row). If you run this script before
-- signing up, it's a harmless no-op — re-run just this block after signup.
DO $$
BEGIN
  INSERT INTO public.user_profiles (user_id, handle, email)
  SELECT id, 'nlal029', email FROM auth.users WHERE email = 'nayanlal029@gmail.com'
  ON CONFLICT (user_id) DO UPDATE SET handle = 'nlal029';
END $$;

-- ============================================================================
-- Done. Verify in Dashboard → Table Editor: categories, time_blocks,
-- user_profiles all present with RLS enabled (shield icon).
-- ============================================================================
