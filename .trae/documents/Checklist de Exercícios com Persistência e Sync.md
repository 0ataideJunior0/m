## Visão Geral
- Adicionar marcação individual de conclusão para cada exercício (checklist) na aba de exercícios (WorkoutDay).
- Persistência local imediata + sincronização com backend (Supabase) de forma otimista, resiliente e acessível.

## Modelo de Dados
- Frontend: chave de armazenamento local por usuária e dia: `exerciseProgress:{userId}:{day}` → `{ [exerciseKey]: { completed: boolean, ts: number } }`.
- Backend (Supabase – novo recurso): tabela `user_exercise_progress` com colunas: `id (uuid)`, `user_id (uuid)`, `day_number (int)`, `exercise_key (text)`, `completed (bool)`, `completed_at (timestamptz)`, `updated_at (timestamptz)`; índice único `(user_id, day_number, exercise_key)`.
- `exercise_key`: slug normalizado do nome do exercício (ex.: `agachamento-livre`), incluindo `group` quando aplicável.

## API/Utils
- Utils: `getExerciseKey(ex: Exercise)` (normalização), `loadLocalProgress(userId, day)`, `saveLocalProgress(userId, day, state)`.
- Supabase utils:
  - `fetchExerciseProgress(userId, day)` → mapa `{ exercise_key: completed }`.
  - `upsertExerciseProgress(userId, day, exercise_key, completed)` (upsert único).
  - `syncAll(userId, day, localState)` (envio em lote com upserts, com retry exponencial, cancelável).

## UI/Componente
- Novo componente `ExerciseItem` (acessível): props `{exercise, isCompleted, onToggle}`.
  - Checkbox/Toggle visível à esquerda; texto e meta à direita.
  - Estados visuais:
    - Concluído: bg `green-50`, borda `green-300`, título `line-through`, ícone `CheckCircle`.
    - Pendente: estilo atual (cinza) com hover.
  - Feedback imediato: animação de transição (Tailwind) e micro-efeito (fade/scale). Tempo de resposta < 300ms via atualização otimista.
- Integração no `WorkoutDay`:
  - Para bi-set (grupos) e exercícios individuais, renderizar `ExerciseItem` com controle comum.
  - Contador superior: `X/Y concluídos` + barra de progresso do dia (apenas visual, não interfere na marcação do dia completo).
  - Botão “Desfazer” (undo) contextual (última ação), com timeout de 5s.

## Persistência e Sincronização
- Carregamento:
  - 1) Ler `localStorage` (imediato) → estado inicial.
  - 2) Buscar Supabase em paralelo e mesclar (prioridade servidor, mantendo marcas locais não enviadas).
- Toggle (otimista):
  - Atualiza UI + localStorage instantaneamente.
  - Dispara upsert Supabase em background (debounce 300ms).
  - Retry com backoff (0.5s, 2s, 5s) em falhas; exibir toast discreto somente em falhas repetidas.
- Inatividade/offline:
  - Fila de pendentes em memória; sincronização quando a conectividade volta (`online` event).

## Acessibilidade (WCAG AA)
- Checkbox com `role="checkbox"`, `aria-checked`, `aria-label` descritivo (nome do exercício).
- Foco visível (`focus:ring-*`), navegação por teclado (Enter/Espaço alterna).
- Leitores de tela: texto auxiliares (“Concluído/Pendente”).

## UX Consistência
- Tipografia e cores seguindo Home/WorkoutDay (Tailwind existente).
- Animações suaves (`transition`, `animate-fade-in`), sem jitter.
- Responsividade: grid atual + largura mínima dos itens para não quebrar.

## Tratamento de Erros
- Token inválido/expirado: relogar silenciosamente (autoRefresh), caso falhe → notificar e manter estado local.
- Rede instável: retry/backoff e fila offline.
- Undo disponível para marcação acidental.

## Desempenho
- Tempo de resposta < 300ms garantido via atualização otimista e leitura local.
- Debounce para chamadas ao backend.
- Renderização memoizada de itens (`React.memo`) quando possível.

## Segurança
- Não armazenar informação sensível; apenas estado de conclusão.
- Requests com cabeçalhos CSRF/Origin já incluídos no cliente Supabase.

## Testes
- Unitários: `getExerciseKey`, mesclagem local/servidor, toggle/undo.
- Integração: `WorkoutDay` renderiza estados, contador é correto, debounce de sync.
- Simulação offline/online.

## Migração (quando aprovado)
- Criar tabela `user_exercise_progress` com índice único e RLS por `user_id`.
- Adicionar funções utilitárias no `utils/workouts` para leitura/escrita.

## Entregáveis
- Componentes e utils implementados.
- Sincronização robusta com Supabase.
- Documentação rápida de uso/estrutura.

Confirma implementar conforme o plano e prosseguir com a migração no Supabase e ajustes no `WorkoutDay`?