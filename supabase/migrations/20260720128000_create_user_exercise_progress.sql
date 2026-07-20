-- Cria a tabela user_exercise_progress, que na verdade nunca existiu em
-- produção: o arquivo local `user_exercise_progress.sql` usava
-- `CREATE POLICY IF NOT EXISTS`, sintaxe inválida no Postgres, então a
-- migração original nunca foi aplicada com sucesso. O código do app já
-- assume essa tabela (src/utils/exerciseProgressRemote.ts) — o checklist por
-- exercício vinha falhando silenciosamente (try/catch) e nunca persistia no
-- servidor. Corrigido aqui antes de adicionar a coluna workout_id.

CREATE TABLE public.user_exercise_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  day_number INTEGER NOT NULL CHECK (day_number >= 1 AND day_number <= 30),
  exercise_key TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX user_ex_progress_unique
  ON public.user_exercise_progress (user_id, day_number, exercise_key);

ALTER TABLE public.user_exercise_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own read" ON public.user_exercise_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "own upsert" ON public.user_exercise_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own update" ON public.user_exercise_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.user_exercise_progress TO authenticated;
