-- Reestruturação do sistema de treino: catálogo de programas (Avançado/Iniciante).
-- Passo 1/4 (aditivo): cria a tabela `programs` e adiciona colunas novas e
-- NULLable em `workouts`, `user_progress` e `user_exercise_progress`. As
-- colunas `day_number` antigas NÃO são tocadas aqui — o app continua
-- funcionando com o código antigo até o deploy do código novo estar pronto.

CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view programs" ON public.programs
  FOR SELECT USING (true);

GRANT SELECT ON public.programs TO anon;
GRANT SELECT ON public.programs TO authenticated;

-- workouts: novo par (program_id, weekday) substituirá day_number.
ALTER TABLE public.workouts
  ADD COLUMN program_id UUID NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  ADD COLUMN weekday INTEGER NULL CHECK (weekday >= 1 AND weekday <= 7);

-- user_progress / user_exercise_progress: novo workout_id substituirá day_number.
ALTER TABLE public.user_progress
  ADD COLUMN workout_id UUID NULL REFERENCES public.workouts(id) ON DELETE CASCADE;

ALTER TABLE public.user_exercise_progress
  ADD COLUMN workout_id UUID NULL REFERENCES public.workouts(id) ON DELETE CASCADE;

-- Antes só existia UPDATE para admins editarem dias já existentes. Com o
-- catálogo "Iniciante" nascendo vazio, o admin agora também precisa criar
-- linhas novas para os slots de dia da semana ainda sem treino.
GRANT INSERT ON public.workouts TO authenticated;

CREATE POLICY "Admins can insert workouts" ON public.workouts
  FOR INSERT WITH CHECK (
    public.is_admin()
  );

CREATE INDEX idx_workouts_program_weekday ON public.workouts (program_id, weekday);
CREATE INDEX idx_user_progress_workout_id ON public.user_progress (workout_id);
CREATE INDEX idx_user_ex_progress_workout_id ON public.user_exercise_progress (workout_id);
