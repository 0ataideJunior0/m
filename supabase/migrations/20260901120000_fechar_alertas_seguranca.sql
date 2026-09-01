-- Fecha os alertas de segurança do Supabase que são de fato acionáveis.
--
-- Contexto da checagem feita em 2026-09-01: o linter aponta 3 funções
-- SECURITY DEFINER expostas, mas só UMA deve ser revogada. Ver a nota no fim
-- do arquivo sobre as outras duas — revogá-las derrubaria o gate inteiro.

-- ---------------------------------------------------------------------------
-- 1. Tabelas de arquivo sem RLS  (o alerta crítico)
-- ---------------------------------------------------------------------------
-- Sobraram do arquivamento de 2026-07-20. Estão com RLS desligada e sem
-- policy, ou seja: qualquer pessoa com a chave anônima (que é pública, vai no
-- bundle do front) podia ler e escrever nelas. A pior é
-- user_progress_archive_20260720, com 266 linhas de progresso de usuárias.
--
-- Nenhum código do app referencia essas tabelas (verificado por grep em
-- src/ e api/), então ligar RLS sem nenhuma policy é exatamente o certo:
-- ninguém acessa pelo cliente, e o service_role — que ignora RLS — continua
-- podendo ler para eventual consulta administrativa. Os dados ficam
-- preservados; só deixam de estar expostos.

ALTER TABLE public.program_workouts_archive_20260720 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs_archive_20260720 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts_archive_20260720 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress_archive_20260720 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_progress_archive_20260720 ENABLE ROW LEVEL SECURITY;

-- Defesa em profundidade: sem os GRANTs, a tabela nem aparece para esses
-- papéis, em vez de aparecer vazia por causa da RLS.
REVOKE ALL ON public.program_workouts_archive_20260720 FROM anon, authenticated;
REVOKE ALL ON public.programs_archive_20260720 FROM anon, authenticated;
REVOKE ALL ON public.workouts_archive_20260720 FROM anon, authenticated;
REVOKE ALL ON public.user_progress_archive_20260720 FROM anon, authenticated;
REVOKE ALL ON public.user_exercise_progress_archive_20260720 FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. handle_new_user() exposta como RPC
-- ---------------------------------------------------------------------------
-- É a função do gatilho `on_auth_user_created` em auth.users, que cria a linha
-- em profiles quando alguém se cadastra. O gatilho é disparado pelo serviço de
-- autenticação do Supabase, não por anon/authenticated — então revogar o
-- EXECUTE não afeta o cadastro, só fecha o endpoint /rest/v1/rpc/handle_new_user
-- que nunca deveria ter existido.

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;

-- ---------------------------------------------------------------------------
-- NÃO revogar is_admin() nem has_active_subscription()
-- ---------------------------------------------------------------------------
-- O linter também aponta as duas, e seguir essa sugestão QUEBRA O APP.
--
-- Sete policies as chamam, todas com o papel `public`:
--   workouts (SELECT e UPDATE), meal_plans, profiles, subscriptions,
--   pix_payments, user_progress
--
-- A expressão de uma policy é avaliada com as permissões de quem consulta. Sem
-- EXECUTE, a consulta falha com permission denied em vez de aplicar a regra —
-- ou seja, ninguém acessa mais nada.
--
-- E o alerta é, na prática, um falso positivo: as duas não recebem argumento e
-- respondem apenas sobre quem chamou, via auth.uid(). Não é possível perguntar
-- sobre outra pessoa. Um anônimo recebe `false`, que é a resposta correta.
