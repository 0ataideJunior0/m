# Reset de conclusão de treino + redesign do card de dia

## Contexto

Hoje, marcar um treino como concluído (`user_progress.completed = true`) é permanente: o dia fica marcado com um ✓ verde para sempre, o botão "Marcar como Concluído" some, e não há como a aluna refazer aquele treino e marcar o checklist de exercícios de novo. Como o catálogo de treinos (Avançado/Iniciante) é uma rotina semanal fixa e recorrente — não um desafio de 30 dias único — faz sentido que cada dia seja sempre refazível: concluir um treino deve contar para as estatísticas da aluna, mas devolver aquele dia ao estado "a fazer" imediatamente.

Aproveitando a mudança, o card de cada dia na tela do treino (`ProgramDays.tsx`) é redesenhado usando os componentes de design system da fase 1 (`Card`, `Button`), removendo o ✓ e simplificando pra sempre mostrar "Ver Treino".

## Modelo de dados

`user_progress` ganha uma coluna nova: `completion_count integer not null default 0`.

Ao clicar em "Marcar como Concluído" em `WorkoutDay.tsx`:
- Incrementa `completion_count` (+1) e atualiza `completed_at = now()` — registro histórico permanente, nunca reseta.
- Grava `completed = false` (em vez de `true`) — o dia nunca fica travado como "feito".
- Apaga as linhas de `user_exercise_progress` daquele `workout_id` para aquela usuária (limpa o checklist de exercícios no servidor).
- Limpa o espelho local (localStorage) do checklist daquele treino — sem isso, o merge local+servidor "ressuscitaria" os itens marcados mesmo após o servidor ser limpo.

Backfill na migração: contas que já tinham `completed = true` em algum treino recebem `completion_count = 1`, preservando o número que já apareciam no "Treinos Concluídos" do Perfil.

O incremento é feito com leitura-depois-escrita (sem função Postgres dedicada) — consistente com o padrão já usado em todo o restante do código (chamadas diretas do client Supabase, sem RPCs). Aceitável dado o padrão de uso do app (uma aluna clicando em "concluir" no seu próprio dispositivo, sem concorrência real).

## Comportamento por tela

### WorkoutDay.tsx
- `handleCompleteWorkout` passa a: (1) ler `completion_count` atual, (2) upsert com `completed: false, completed_at: now(), completion_count: atual + 1`, (3) apagar as linhas de `user_exercise_progress` do treino, (4) limpar o cache local do checklist, (5) navegar de volta para `/program/:slug` (like já faz hoje).
- O conceito `isDayCompleted` sai do arquivo: como `completed` nunca mais fica `true` de forma persistente, o botão "Marcar como Concluído" passa a aparecer sempre, e a faixa verde "Treino concluído!" (que só aparecia ao reabrir um dia já feito) é removida por não fazer mais sentido.

### ProgramDays.tsx
- Remove o ✓ verde e toda a lógica de `day.completed`.
- Cada dia vira um `Card` (componente de UI, mobile-first, full-width, empilhados verticalmente):
  - Título: nome do dia da semana (ex: "Segunda-feira").
  - Subtítulo: nome do treino daquele dia (ex: "Treino A — Superior"), ou "Em breve" se o dia ainda não tem treino cadastrado (caso do Iniciante vazio).
  - Botão `Button variant="primary"` full-width com o texto **"Ver Treino"** (sempre o mesmo texto, sem distinguir primeira vez de repetição) — só aparece se houver treino cadastrado naquele dia; dias vazios não têm botão.

### Profile.tsx
- `completedDays` passa a somar `completion_count` de todos os treinos da usuária (total histórico de conclusões, contando repetições), em vez de contar linhas com `completed = true`.
- As metas das conquistas (Frequência 10 / Desempenho 20 / Consistência 30) continuam iguais — agora incentivam genuinamente repetir treinos, já que cada repetição soma.

## Arquivos afetados
- `supabase/migrations/` — nova migração (coluna `completion_count` + backfill).
- `src/types/index.ts` — `UserProgress` ganha `completion_count`.
- `src/utils/workouts.ts` — `markWorkoutComplete` reescrito.
- `src/utils/exerciseProgressRemote.ts` — nova função para apagar o checklist de um treino.
- `src/utils/exerciseProgress.ts` — nova função (ou reuso) para limpar o cache local de um treino.
- `src/pages/WorkoutDay.tsx` — fluxo de conclusão atualizado, remove `isDayCompleted`/faixa verde.
- `src/pages/ProgramDays.tsx` — card redesenhado com `Card`/`Button`, remove ✓.
- `src/pages/Profile.tsx` — cálculo de `completedDays` atualizado.
- `src/__tests__/WorkoutDay.test.tsx`, `src/__tests__/exerciseProgress.test.ts` — ajustar aos novos nomes/comportamento.

## Escopo excluído (YAGNI)
- Sem histórico detalhado de cada conclusão (sem tabela de eventos/log) — só o contador agregado por treino.
- Sem distinção visual entre "nunca feito" e "já feito antes" no card do dia — todos os dias sempre mostram o mesmo card "Ver Treino".
- Sem RPC/função Postgres para incremento atômico — leitura-depois-escrita é suficiente pro padrão de uso real do app.
