-- Admin dashboard: profiles table (role storage), auth trigger + backfill,
-- and RLS so only is_admin=true users can write workouts / read all progress.

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT SELECT ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true);
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own profile, admins view all" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin()
  );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, created_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'username', NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users (the trigger above only covers future signups)
INSERT INTO public.profiles (id, email, username, created_at)
SELECT id, email, raw_user_meta_data->>'username', created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;

GRANT UPDATE ON public.workouts TO authenticated;

CREATE POLICY "Admins can update workouts" ON public.workouts
  FOR UPDATE USING (
    public.is_admin()
  );

CREATE POLICY "Admins can view all progress" ON public.user_progress
  FOR SELECT USING (
    public.is_admin()
  );
