-- Reestruturação do sistema de treino: catálogo de programas (Avançado/Iniciante).
-- Passo 3/4 (destrutivo, rodar isolado): os dias 8-30 do antigo "desafio" de
-- 30 dias não pertencem a nenhum programa novo. Antes de removê-los das
-- tabelas ativas, cria-se uma cópia de backup de cada tabela afetada.
-- Verificar as contagens de linha antes e depois de rodar este arquivo.

CREATE TABLE public.workouts_archive_20260720 AS
SELECT * FROM public.workouts WHERE day_number BETWEEN 8 AND 30;

CREATE TABLE public.user_progress_archive_20260720 AS
SELECT * FROM public.user_progress WHERE day_number BETWEEN 8 AND 30;

CREATE TABLE public.user_exercise_progress_archive_20260720 AS
SELECT * FROM public.user_exercise_progress WHERE day_number BETWEEN 8 AND 30;

-- As tabelas de arquivo não têm RLS/policies — sem GRANT explícito, ficam
-- inacessíveis via API (anon/authenticated), só consultáveis via SQL direto.
REVOKE ALL ON public.workouts_archive_20260720 FROM anon, authenticated;
REVOKE ALL ON public.user_progress_archive_20260720 FROM anon, authenticated;
REVOKE ALL ON public.user_exercise_progress_archive_20260720 FROM anon, authenticated;

-- Deleta filhos antes do pai (mesmo com ON DELETE CASCADE) para manter cada
-- passo explícito e auditável.
DELETE FROM public.user_exercise_progress WHERE day_number BETWEEN 8 AND 30;
DELETE FROM public.user_progress WHERE day_number BETWEEN 8 AND 30;
DELETE FROM public.workouts WHERE day_number BETWEEN 8 AND 30;
