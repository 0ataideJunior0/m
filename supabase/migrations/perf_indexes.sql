-- Índices de performance
create index if not exists idx_workouts_day_number on public.workouts (day_number);
create index if not exists idx_user_progress_user_day on public.user_progress (user_id, day_number);
create index if not exists idx_user_ex_progress_user_day_key on public.user_exercise_progress (user_id, day_number, exercise_key);

