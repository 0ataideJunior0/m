-- Atualiza constraints para suportar 30 dias

ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_day_number_check;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_day_number_check CHECK (day_number >= 1 AND day_number <= 30);

ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_day_number_check;
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_day_number_check CHECK (day_number >= 1 AND day_number <= 30);

