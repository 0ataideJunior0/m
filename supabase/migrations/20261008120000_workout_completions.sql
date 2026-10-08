-- Log de conclusões: uma linha por vez que a usuária marca um treino como
-- concluído. user_progress guarda só o contador e a data da ÚLTIMA conclusão
-- (markWorkoutComplete sobrescreve), então não dá pra montar heatmap,
-- sequência ou conquistas a partir dele. Esta tabela só cresce (append-only).
--
-- workout_id é SET NULL no delete: apagar um treino pessoal não deve apagar
-- o histórico de quem treinou.
CREATE TABLE public.workout_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX workout_completions_user_completed_idx
  ON public.workout_completions (user_id, completed_at DESC);

ALTER TABLE public.workout_completions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.workout_completions TO authenticated;

CREATE POLICY "Usuárias veem as próprias conclusões" ON public.workout_completions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Usuárias registram as próprias conclusões" ON public.workout_completions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Histórico anterior: só existe a data da última conclusão de cada treino
-- (user_progress.completed_at). Entra uma linha por treino, o que preenche
-- parcialmente o passado — conclusões repetidas do mesmo treino não têm data.
INSERT INTO public.workout_completions (user_id, workout_id, completed_at)
SELECT user_id, workout_id, completed_at
FROM public.user_progress
WHERE completed_at IS NOT NULL;
