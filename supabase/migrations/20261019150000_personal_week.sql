-- Treino pessoal vira uma semana: até 7 dias por aluna (um por weekday),
-- em vez de um único treino sem dia.

ALTER TABLE public.workouts DROP CONSTRAINT workouts_catalog_or_personal;

-- O treino pessoal antigo (sem dia) passa a ser a segunda-feira.
UPDATE public.workouts SET weekday = 1 WHERE user_id IS NOT NULL AND weekday IS NULL;

ALTER TABLE public.workouts ADD CONSTRAINT workouts_catalog_or_personal CHECK (
  weekday IS NOT NULL AND (
    (program_id IS NOT NULL AND user_id IS NULL)
    OR (program_id IS NULL AND user_id IS NOT NULL)
  )
);

ALTER TABLE public.workouts DROP CONSTRAINT workouts_user_unique;
ALTER TABLE public.workouts ADD CONSTRAINT workouts_user_weekday_unique UNIQUE (user_id, weekday);

-- Preferências do plano pessoal. Só a admin escreve; a aluna lê o próprio.
CREATE TABLE public.personal_plans (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Esconde os programas do catálogo da Home da aluna.
  hide_catalog boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.personal_plans ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_plans TO authenticated;

CREATE POLICY "Own plan or admin can view" ON public.personal_plans
  FOR SELECT USING (user_id = (select auth.uid()) OR public.is_admin());

CREATE POLICY "Admins can insert plans" ON public.personal_plans
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update plans" ON public.personal_plans
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete plans" ON public.personal_plans
  FOR DELETE USING (public.is_admin());
