-- Mercado Pago recurring billing: subscriptions table, has_active_subscription()
-- helper, and RLS gating workouts/user_progress reads behind an active
-- subscription (admins remain exempt via the existing is_admin() checks).

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  preapproval_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL, -- 'pending' | 'authorized' | 'paused' | 'cancelled'
  next_payment_date TIMESTAMPTZ,
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT ON public.subscriptions TO authenticated;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own subscription, admins view all" ON public.subscriptions
  FOR SELECT USING (
    auth.uid() = user_id
    OR public.is_admin()
  );

-- No INSERT/UPDATE/DELETE policy: only service_role (inside Vercel Functions) writes.

CREATE OR REPLACE FUNCTION public.has_active_subscription()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = auth.uid() AND status = 'authorized'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription() TO authenticated;

-- Replace (not add to) the existing fully-public workouts SELECT policy —
-- a USING(true) policy left in place would OR-combine and make any new
-- policy a no-op.
DROP POLICY IF EXISTS "Anyone can view workouts" ON public.workouts;
CREATE POLICY "Subscribers and admins can view workouts" ON public.workouts
  FOR SELECT USING (
    public.has_active_subscription()
    OR public.is_admin()
  );

-- Replace the existing self-view policy on user_progress to also require
-- an active subscription (or admin). The separate "Admins can view all
-- progress" policy from the admin-dashboard migration is untouched and
-- keeps working exactly as before (admins always see everyone's progress).
DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_progress;
CREATE POLICY "Users can view their own progress" ON public.user_progress
  FOR SELECT USING (
    auth.uid() = user_id
    AND (public.has_active_subscription() OR public.is_admin())
  );
