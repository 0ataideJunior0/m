-- =====================================================================
-- DIAGNÓSTICO DO SCHEMA REAL — Musa Fit
-- Fase 0 do docs/PLANO-CORRECOES.md
-- =====================================================================
--
-- SEGURANÇA: este arquivo contém APENAS SELECTs.
--            Zero DDL, zero DML. Não altera absolutamente nada.
--            Pode ser rodado em produção com segurança.
--
-- POR QUÊ:   a migration 20260720160000_programs_constraints_finalize.sql
--            está marcada no próprio cabeçalho como
--            "Passo 4/4 (finalização — NÃO RODAR AINDA)".
--            Ninguém sabe se ela foi aplicada. A Fase 4 inteira e a
--            Tarefa 6.1 dependem dessa resposta, e agir às cegas pode
--            corromper dados de produção.
--
-- COMO USAR: 1. abrir o Supabase → SQL Editor
--            2. rodar cada bloco numerado abaixo (um de cada vez, para
--               que as saídas não se misturem)
--            3. colar as saídas de volta na conversa com o agente
--            4. o agente grava docs/diagnostico-schema-2026-08.md
--               classificando o resultado em cenário A, B ou C
--
-- =====================================================================


-- ---------------------------------------------------------------------
-- BLOCO 1 — A coluna day_number ainda existe?
-- ---------------------------------------------------------------------
-- Sinal principal. A finalize dropa day_number das três tabelas.
-- Se ela aparecer aqui, a finalize NÃO foi aplicada.
-- ---------------------------------------------------------------------
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('workouts', 'user_progress', 'user_exercise_progress')
ORDER BY table_name, ordinal_position;


-- ---------------------------------------------------------------------
-- BLOCO 2 — Constraints reais (NOMES EXATOS)
-- ---------------------------------------------------------------------
-- Crítico para a Tarefa 4.0: a finalize assume nomes pela convenção
-- padrão do Postgres. Estes são os nomes de verdade. Se divergirem,
-- a migration precisa ser reescrita antes de rodar.
-- Procurar especificamente por: workouts_program_weekday_unique
-- ---------------------------------------------------------------------
SELECT conrelid::regclass AS tabela, conname, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conrelid::regclass::text IN (
    'workouts', 'user_progress', 'user_exercise_progress', 'profiles', 'programs'
  )
ORDER BY 1, 2;


-- ---------------------------------------------------------------------
-- BLOCO 3 — Índices reais
-- ---------------------------------------------------------------------
-- Procurar por: user_ex_progress_unique (user_id, workout_id, exercise_key)
-- É o índice que consolida silenciosamente as chaves colididas da Fase 2.
-- Também conferir se sobrou algum índice sobre day_number.
-- ---------------------------------------------------------------------
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ---------------------------------------------------------------------
-- BLOCO 4 — Policies de RLS em vigor
-- ---------------------------------------------------------------------
-- Alimenta a Tarefa 6.1 (documento de arquitetura de acesso).
-- Atenção especial a workouts: se houver uma policy FOR SELECT
-- USING (true), todo o conteúdo de treino é legível por qualquer
-- pessoa com a anon key — que está no bundle JS por design.
-- ---------------------------------------------------------------------
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ---------------------------------------------------------------------
-- BLOCO 5 — Integridade dos dados
-- ---------------------------------------------------------------------
-- Se QUALQUER uma destas contagens for > 0 e day_number ainda existir
-- (Bloco 1), o estado é o CENÁRIO C: há linhas órfãs que impedem a
-- criação das constraints. PARAR e escalar — precisa de decisão de
-- produto antes de qualquer DDL.
-- ---------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.workouts               WHERE program_id IS NULL) AS workouts_sem_program_id,
  (SELECT COUNT(*) FROM public.workouts               WHERE weekday    IS NULL) AS workouts_sem_weekday,
  (SELECT COUNT(*) FROM public.user_progress          WHERE workout_id IS NULL) AS progress_sem_workout,
  (SELECT COUNT(*) FROM public.user_exercise_progress WHERE workout_id IS NULL) AS ex_progress_sem_workout;


-- ---------------------------------------------------------------------
-- BLOCO 6 — As tabelas de arquivo do passo 3 existem?
-- ---------------------------------------------------------------------
-- São a única rota de rollback da finalize. Se não existirem, a
-- Tarefa 4.0 é irreversível e o snapshot prévio passa a ser obrigatório.
-- ---------------------------------------------------------------------
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE '%archive_20260720%'
ORDER BY table_name;


-- ---------------------------------------------------------------------
-- BLOCO 7 — Escala atual
-- ---------------------------------------------------------------------
-- Dimensiona o risco de qualquer backfill.
-- linhas_checklist é o número que decide a Tarefa 2.4: se for baixo,
-- o DELETE do checklist em andamento é indolor; se for alto, escalar.
-- ---------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.profiles)               AS usuarias,
  (SELECT COUNT(*) FROM public.workouts)               AS treinos,
  (SELECT COUNT(*) FROM public.user_progress)          AS linhas_progresso,
  (SELECT COUNT(*) FROM public.user_exercise_progress) AS linhas_checklist;


-- ---------------------------------------------------------------------
-- BLOCO 8 — A coluna completed ainda diverge de completion_count?
-- ---------------------------------------------------------------------
-- Pré-requisito da Tarefa 4.1 (DROP COLUMN completed).
-- Se divergentes > 0, há histórico que só existe no boolean antigo e
-- seria perdido no drop. Deve ser 0 antes de remover a coluna.
--
-- Contexto: markWorkoutComplete grava completed: false em TODO upsert
-- (workouts.ts:134), inclusive para quem já tinha true — por isso a
-- Tarefa 3.4 precisa ir para produção antes desta verificação valer.
-- ---------------------------------------------------------------------
SELECT
  COUNT(*) FILTER (WHERE completed = true AND completion_count = 0) AS divergentes,
  COUNT(*) FILTER (WHERE completed = true)                          AS com_completed_true,
  COUNT(*) FILTER (WHERE completion_count > 0)                      AS com_contador_positivo
FROM public.user_progress;
