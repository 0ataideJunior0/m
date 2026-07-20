-- Reverts the Mercado Pago recurring billing feature (20260718090000_subscriptions.sql).
-- The integration is being abandoned; this restores pre-billing access rules
-- (any authenticated user can view workouts/progress again) and removes the
-- subscriptions table and its helper function. The old migration file is kept
-- as a historical record rather than deleted.

DROP POLICY IF EXISTS "Subscribers and admins can view workouts" ON public.workouts;
CREATE POLICY "Anyone can view workouts" ON public.workouts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view their own progress" ON public.user_progress;
CREATE POLICY "Users can view their own progress" ON public.user_progress
  FOR SELECT USING (auth.uid() = user_id);

DROP TABLE IF EXISTS public.subscriptions;
DROP FUNCTION IF EXISTS public.has_active_subscription();
