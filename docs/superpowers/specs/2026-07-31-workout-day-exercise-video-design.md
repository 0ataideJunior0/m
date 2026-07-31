# Reformulação da tela de treino (WorkoutDay) — vídeo de execução por exercício

## Contexto

A tela `WorkoutDay` (`src/pages/WorkoutDay.tsx`) já exibe um vídeo geral do treino
(`workout.video_url`), com embed do YouTube resolvido por `resolveVideoUrl`. Cada
exercício também já possui um campo `video` opcional, editável pelo admin em
`src/pages/admin/AdminWorkoutEdit.tsx` — nenhuma mudança é necessária no admin ou no
modelo de dados.

O botão "Assistir vídeo" por exercício, no entanto, só está implementado para
exercícios agrupados (bi-set), montado fora do card em `WorkoutDay.tsx` (bloco do
grupo). Exercícios normais (a maioria dos casos) não têm essa opção — `ExerciseItem`
não recebe nem usa nenhuma prop relacionada a vídeo.

Isso é confirmado por um teste já existente, `src/__tests__/WorkoutDay.test.tsx`, que
espera abrir o modal de vídeo ao interagir com um exercício simples com `video`
definido — e que falha na main atual, porque essa função nunca foi conectada para
exercícios não agrupados.

Além disso, `WorkoutDay.tsx` usa cores fixas (`bg-white`, `text-gray-900`,
`bg-gray-200` etc.) em vez dos tokens de tema (`bg-surface`, `text`, `text-muted`,
`border`, `bg`) já definidos em `tailwind.config.js` / `src/index.css` e usados por
`src/components/ui/Card.tsx`. O app já tem alternância de tema funcional (Profile →
dark mode), mas a maioria das telas — incluindo esta — não respeita o tema.

## Objetivo

Reformular a tela `WorkoutDay` para que:

1. Cada card de exercício mantenha as informações atuais (nome, séries/reps, nota,
   check de concluído).
2. Cada card de exercício ganhe uma opção "Ver execução" que abre o vídeo daquele
   exercício, funcionando com o mesmo mecanismo do vídeo geral do treino (URL do
   YouTube fornecida pelo admin → embed).
3. O visual da tela seja atualizado, mobile-first, e consistente com o design system
   existente (tokens de tema, incluindo suporte a dark mode).

## Fora de escopo

- Qualquer mudança no admin (`AdminWorkoutEdit.tsx`) — o campo de vídeo por exercício
  já existe e já é editável.
- Qualquer mudança no modelo de dados / schema / Supabase.
- Lógica de progresso, toggle de conclusão, ou conclusão de treino — permanece
  inalterada.
- Dark mode em outras telas do app (Home, Login, etc.) — fora do escopo desta tela.

## Design

### `ExerciseItem` (`src/components/ExerciseItem.tsx`)

- Passa a receber duas novas props: `hasVideo: boolean` e `onWatchVideo?: () => void`.
- Mantém a estrutura atual (nome, séries/reps, nota, botão de check) sem remoção de
  informação.
- Adiciona uma linha de ação abaixo das informações do exercício com um botão
  "Ver execução" (ícone `Play`), visível apenas quando `hasVideo` é `true`. Quando
  `false`, mantém o texto "Vídeo indisponível" que já existe hoje no bloco de bi-set,
  agora unificado dentro do próprio componente.
- Troca as cores fixas por tokens de tema (`bg-surface`/`bg-white` via classe padrão do
  Card, `text`, `text-muted`, `border`) para funcionar em dark mode.
- Toca alvos de toque com no mínimo 44px (check e "Ver execução"), organizados para
  caber em uma coluna em telas pequenas (mobile-first) sem exigir `md:` para o layout
  básico do card.

### `WorkoutDay.tsx`

- Exercícios simples e agrupados (bi-set) passam a usar a mesma prop `onWatchVideo` /
  `hasVideo` de `ExerciseItem`. Remove o bloco de botão duplicado que hoje existe só
  para o caso de bi-set (linhas ~250-259 na versão atual), já que a lógica passa a
  viver dentro de `ExerciseItem`.
- `hasVideo` é calculado com a mesma regra já usada em `openExerciseVideoFactory`:
  `!!(exercise.video || workout.video_url)`.
- `onWatchVideo` continua chamando `openExerciseVideo(exercise)`, que já resolve a URL
  (YouTube ou direta), aplica cache e abre o modal existente — nenhuma mudança na
  lógica de resolução/abertura de vídeo.
- Aplica tokens de tema no cabeçalho, card do vídeo geral, card de progresso e botão
  fixo de concluir treino. Adiciona variante dark ao gradiente de fundo da página
  (`dark:from-bg dark:to-bg`), replicando o padrão de `Card.tsx`.
- O modal de vídeo por exercício mantém o comportamento atual (fullscreen, fundo
  preto, spinner de carregamento); apenas o cabeçalho do modal (fundo branco e texto)
  passa a usar tokens de tema.
- Estados de loading e "treino não encontrado" também recebem os tokens de tema no
  lugar das cores fixas, para consistência dentro da mesma tela.

### Testes

- `src/__tests__/WorkoutDay.test.tsx`: o teste existente clica no texto do nome do
  exercício esperando que o modal abra. Isso não corresponde ao novo padrão de
  interação (botão explícito "Ver execução", não o card inteiro clicável). O teste
  será ajustado para clicar no botão "Ver execução" do exercício, mantendo a asserção
  de que um `role="dialog"` com `<iframe>` aparece.
- Nenhum outro teste existente (`AdminWorkoutEdit`, `adminWorkouts`, etc.) é afetado,
  pois nenhuma mudança ocorre no admin ou nos utilitários de dados.

## Riscos e mitigação

- **Regressão no fluxo de bi-set:** ao remover o bloco de botão específico de bi-set e
  substituí-lo pela prop unificada, é preciso garantir visualmente que o layout de
  grid 2 colunas (`md:grid-cols-2`) dos bi-sets continua correto — o `ExerciseItem`
  simplesmente passa a ser reaproveitado dentro do wrapper existente do grupo, sem
  mudança na estrutura do grid.
- **Dark mode parcial no app:** como outras telas (Home, etc.) não têm dark mode,
  navegar entre elas com o tema escuro ativo vai alternar entre telas claras e
  escuras. Isso já é o comportamento atual do app fora desta tela e não é resolvido
  por este trabalho — mitigação: nenhuma, está explicitamente fora de escopo.
