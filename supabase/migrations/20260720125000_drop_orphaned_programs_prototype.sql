-- Remove um protótipo órfão de "programs"/"program_workouts" encontrado no banco
-- ao vincular o projeto via CLI. Essas tabelas foram criadas por uma tentativa
-- anterior (fora do histórico de migrações rastreado aqui) de embrulhar o
-- desafio de 30 dias como "1 programa" ("musa30"), mas nunca foram usadas por
-- nenhum código do app (confirmado por busca no frontend). Antes de remover,
-- cria-se um backup, já que program_workouts tinha 30 linhas reais.

CREATE TABLE public.program_workouts_archive_20260720 AS
SELECT * FROM public.program_workouts;

CREATE TABLE public.programs_archive_20260720 AS
SELECT * FROM public.programs;

REVOKE ALL ON public.program_workouts_archive_20260720 FROM anon, authenticated;
REVOKE ALL ON public.programs_archive_20260720 FROM anon, authenticated;

DROP TABLE IF EXISTS public.program_workouts;
DROP TABLE IF EXISTS public.programs;
