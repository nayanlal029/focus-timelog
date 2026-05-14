
-- Enum for category type
DO $$ BEGIN
  CREATE TYPE public.category_type AS ENUM ('focus','distraction','neutral');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE public.categories (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.category_type NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  builtin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX categories_user_idx ON public.categories(user_id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own categories select" ON public.categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own categories insert" ON public.categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own categories update" ON public.categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own categories delete" ON public.categories FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.time_blocks (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL,
  category_name TEXT NOT NULL,
  type public.category_type NOT NULL,
  start_ms BIGINT NOT NULL,
  end_ms BIGINT NOT NULL,
  note TEXT,
  link TEXT,
  is_break BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX time_blocks_user_start_idx ON public.time_blocks(user_id, start_ms DESC);

ALTER TABLE public.time_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own blocks select" ON public.time_blocks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own blocks insert" ON public.time_blocks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own blocks update" ON public.time_blocks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own blocks delete" ON public.time_blocks FOR DELETE USING (auth.uid() = user_id);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER categories_touch BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER time_blocks_touch BEFORE UPDATE ON public.time_blocks
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.time_blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
