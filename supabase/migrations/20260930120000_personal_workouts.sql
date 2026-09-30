-- Treino pessoal: uma linha de `workouts` passa a poder pertencer a UMA
-- usuária (user_id) em vez de a um programa (program_id+weekday). As duas
-- formas são mutuamente exclusivas (CHECK abaixo) — nunca um treino é as
-- duas coisas ao mesmo tempo. Progresso (user_progress) e checklist de
-- exercício (user_exercise_progress) já são inteiramente escopados por
-- user_id+workout_id, sem depender de program_id, então funcionam sem
-- nenhuma mudança aqui.
ALTER TABLE public.workouts
  ALTER COLUMN program_id DROP NOT NULL,
  ALTER COLUMN weekday DROP NOT NULL,
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.workouts
  ADD CONSTRAINT workouts_catalog_or_personal CHECK (
    (program_id IS NOT NULL AND weekday IS NOT NULL AND user_id IS NULL)
    OR (program_id IS NULL AND weekday IS NULL AND user_id IS NOT NULL)
  ),
  ADD CONSTRAINT workouts_user_unique UNIQUE (user_id);

-- Substitui a policy de leitura: treino de catálogo (user_id null) continua
-- liberado pra qualquer assinante ativa ou admin; treino pessoal só é
-- visível pra própria dona ou admin — e também exige assinatura ativa,
-- mesma regra do catálogo (decisão confirmada: não é um perk que ignora
-- pagamento).
DROP POLICY "Subscribers and admins can view workouts" ON public.workouts;
CREATE POLICY "Subscribers and admins can view workouts" ON public.workouts
  FOR SELECT USING (
    public.is_admin()
    OR (public.has_active_subscription() AND (user_id IS NULL OR user_id = auth.uid()))
  );

-- DELETE nunca foi concedido nesta tabela (só existia UPDATE/INSERT pra
-- admin). Só libera apagar treino pessoal — catálogo continua sem poder
-- ser removido, não é uma capacidade que existia antes e não faz parte
-- deste trabalho.
GRANT DELETE ON public.workouts TO authenticated;
CREATE POLICY "Admins can delete personal workouts" ON public.workouts
  FOR DELETE USING (public.is_admin() AND user_id IS NOT NULL);
