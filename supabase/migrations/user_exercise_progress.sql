-- Tabela de progresso por exercício
create table if not exists public.user_exercise_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  day_number integer not null check (day_number >= 1 and day_number <= 30),
  exercise_key text not null,
  completed boolean default false,
  completed_at timestamptz,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create unique index if not exists user_ex_progress_unique
  on public.user_exercise_progress (user_id, day_number, exercise_key);

alter table public.user_exercise_progress enable row level security;

create policy if not exists "own read"
  on public.user_exercise_progress for select
  using (auth.uid() = user_id);

create policy if not exists "own upsert"
  on public.user_exercise_progress for insert
  with check (auth.uid() = user_id);

create policy if not exists "own update"
  on public.user_exercise_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

