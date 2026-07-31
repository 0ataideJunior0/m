-- Fix: resetExerciseProgress (added for the workout-completion-reset feature)
-- was silently failing — DELETE was never granted or policy'd on this table.

GRANT DELETE ON public.user_exercise_progress TO authenticated;

CREATE POLICY "own delete" ON public.user_exercise_progress
  FOR DELETE USING (auth.uid() = user_id);
