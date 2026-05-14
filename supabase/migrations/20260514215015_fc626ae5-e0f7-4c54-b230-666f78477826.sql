ALTER TABLE public.categories DROP CONSTRAINT categories_pkey;
ALTER TABLE public.categories ADD PRIMARY KEY (user_id, id);
ALTER TABLE public.time_blocks DROP CONSTRAINT time_blocks_pkey;
ALTER TABLE public.time_blocks ADD PRIMARY KEY (user_id, id);