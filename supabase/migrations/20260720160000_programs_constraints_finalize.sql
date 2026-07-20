-- Reestruturação do sistema de treino: catálogo de programas (Avançado/Iniciante).
-- Passo 4/4 (finalização — NÃO RODAR AINDA).
--
-- Só executar depois que o código novo (que já usa program_id/weekday/
-- workout_id) estiver validado em produção. É o único passo irreversível
-- sem recorrer às tabelas *_archive_20260720 criadas no passo 3.
--
-- Antes de rodar, confirmar os nomes reais dos constraints com
-- `\d+ workouts`, `\d+ user_progress`, `\d+ user_exercise_progress` no
-- Supabase — os nomes abaixo assumem a convenção padrão do Postgres para
-- constraints inline sem nome explícito (confirmada em
-- alter_day_number_30.sql para os CHECKs). Todos os DROP usam IF EXISTS
-- como rede de segurança.

ALTER TABLE public.workouts
  ALTER COLUMN program_id SET NOT NULL,
  ALTER COLUMN weekday SET NOT NULL;

ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_day_number_check;
ALTER TABLE public.workouts DROP CONSTRAINT IF EXISTS workouts_day_number_key;
ALTER TABLE public.workouts DROP COLUMN IF EXISTS day_number;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_program_weekday_unique UNIQUE (program_id, weekday);

ALTER TABLE public.user_progress
  ALTER COLUMN workout_id SET NOT NULL;

ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_day_number_check;
ALTER TABLE public.user_progress DROP CONSTRAINT IF EXISTS user_progress_user_id_day_number_key;
ALTER TABLE public.user_progress DROP COLUMN IF EXISTS day_number;
ALTER TABLE public.user_progress ADD CONSTRAINT user_progress_user_workout_unique UNIQUE (user_id, workout_id);

ALTER TABLE public.user_exercise_progress
  ALTER COLUMN workout_id SET NOT NULL;

ALTER TABLE public.user_exercise_progress DROP CONSTRAINT IF EXISTS user_exercise_progress_day_number_check;
DROP INDEX IF EXISTS public.user_ex_progress_unique;
ALTER TABLE public.user_exercise_progress DROP COLUMN IF EXISTS day_number;
CREATE UNIQUE INDEX user_ex_progress_unique ON public.user_exercise_progress (user_id, workout_id, exercise_key);

-- Índices antigos que referenciavam day_number deixam de existir junto com a coluna.
DROP INDEX IF EXISTS public.idx_workouts_day_number;
DROP INDEX IF EXISTS public.idx_user_progress_user_day;
DROP INDEX IF EXISTS public.idx_user_ex_progress_user_day_key;
