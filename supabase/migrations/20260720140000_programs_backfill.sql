-- Reestruturação do sistema de treino: catálogo de programas (Avançado/Iniciante).
-- Passo 2/4 (backfill): cria os 2 programas e migra os dias 1-7 (dos 30
-- existentes) para "Avançado", propagando o novo workout_id no progresso do
-- usuário. "Iniciante" nasce sem nenhum treino (conteúdo definido depois via
-- admin). Os dias 8-30 são tratados no próximo arquivo (arquivamento).

INSERT INTO public.programs (slug, name, sort_order) VALUES
  ('avancado', 'Avançado', 1),
  ('iniciante', 'Iniciante', 2)
ON CONFLICT (slug) DO NOTHING;

UPDATE public.workouts
SET program_id = (SELECT id FROM public.programs WHERE slug = 'avancado'),
    weekday = day_number
WHERE day_number BETWEEN 1 AND 7;

UPDATE public.user_progress up
SET workout_id = w.id
FROM public.workouts w
WHERE w.day_number = up.day_number
  AND up.day_number BETWEEN 1 AND 7;

UPDATE public.user_exercise_progress uep
SET workout_id = w.id
FROM public.workouts w
WHERE w.day_number = uep.day_number
  AND uep.day_number BETWEEN 1 AND 7;
