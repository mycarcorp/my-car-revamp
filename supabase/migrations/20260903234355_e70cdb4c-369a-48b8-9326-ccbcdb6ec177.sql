ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS legacy_user_id INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_legacy_user_id_key ON public.profiles (legacy_user_id) WHERE legacy_user_id IS NOT NULL;