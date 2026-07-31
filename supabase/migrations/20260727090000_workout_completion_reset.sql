-- Reset de conclusão de treino: mantém um contador histórico permanente
-- (completion_count) em vez de um boolean travado — permite que a aluna
-- refaça o mesmo treino e marque o checklist de exercícios novamente.

ALTER TABLE public.user_progress
  ADD COLUMN completion_count INTEGER NOT NULL DEFAULT 0;

-- Preserva o número que já aparecia no "Treinos Concluídos" do Perfil
-- para quem já tinha treinos marcados como concluídos.
UPDATE public.user_progress
SET completion_count = 1
WHERE completed = true;
