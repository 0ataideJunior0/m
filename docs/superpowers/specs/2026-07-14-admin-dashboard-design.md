# Admin Dashboard — Design

## Contexto

O projeto (app de treino "Musa Fit30") não tem hoje nenhum conceito de administrador: sem coluna ou tabela de perfil, sem rota protegida, sem permissão de escrita em nenhuma tabela além do próprio progresso do usuário. Todo o conteúdo (título dos treinos, exercícios, vídeos) foi inserido manualmente via SQL.

O dono do produto precisa de um painel dentro do próprio app para:
1. Editar o conteúdo dos treinos (título, vídeo do dia, e os exercícios de cada dia — nome, reps, sets, nota, vídeo, tipo, agrupamento) sem depender de rodar SQL manualmente.
2. Visualizar os usuários cadastrados que não são administradores (email, username, data de cadastro, progresso no desafio).

Isso deve ser resolvido dentro da SPA existente (React + Vite + Supabase), sem introduzir backend próprio, sem expor a `service_role key` no client, e sem permitir que um usuário comum se autopromova a admin.

## Modelo de dados e RLS

### Nova tabela `public.profiles`

```sql
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  username   TEXT,
  is_admin   BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

`profiles` existe para permitir que o client leia informação de "quem é o usuário" (email, username, is_admin) sem nunca acessar `auth.users` diretamente — esse schema não é exposto pela API REST do Supabase por padrão, e não deveria ser.

### Trigger de sincronização

Function `SECURITY DEFINER` `public.handle_new_user()` + trigger `on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user()`. Insere automaticamente a linha em `profiles` (copiando `email` e `username` de `raw_user_meta_data->>'username'`) a cada novo cadastro. Garante que todo usuário sempre tenha um `profiles` correspondente, independente do fluxo de criação de conta.

### Backfill dos usuários existentes

O trigger só cobre cadastros *futuros*. Usuários que já existem em `auth.users` hoje não ganham uma linha em `profiles` automaticamente — e sumiriam da lista `/admin/users`. A mesma migration inclui um backfill único:

```sql
INSERT INTO public.profiles (id, email, username, created_at)
SELECT id, email, raw_user_meta_data->>'username', created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;
```

### RLS — `profiles`

- `ENABLE ROW LEVEL SECURITY`.
- `SELECT`: `auth.uid() = id` **OU** `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)` — cada um vê o próprio perfil; admin vê todos.
- **Nenhuma** policy de `INSERT`/`UPDATE`/`DELETE` para roles do client. A flag `is_admin` só é alterada via SQL direto (por mim, através do Supabase CLI já linkado ao projeto) — elimina qualquer caminho de autopromoção pelo app.

### RLS — `workouts` (policy adicional)

- `UPDATE`: liberado só quando `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)`.
- Sem policy de `INSERT`/`DELETE` — criar ou remover dias inteiros do desafio está fora do escopo deste projeto; o admin só edita o conteúdo de dias já existentes.

### RLS — `user_progress` (policy adicional)

- `SELECT` adicional para admins: mesma subquery de `is_admin` acima, permitindo ver o progresso de qualquer usuário (a policy de self-view existente continua valendo para os próprios usuários).

### Seed do admin inicial

Depois de aplicar a migration, promover manualmente via CLI:
```sql
UPDATE profiles SET is_admin = true WHERE email = 'ataide.junior.uiux@gmail.com';
```
(A trigger só popula `profiles` em *novos* cadastros; para a conta já existente do dono do produto, o insert/update é feito manualmente uma única vez.)

## Rotas e controle de acesso no frontend

### Estado global

`src/store/authStore.ts` ganha um campo `isAdmin: boolean`, populado em `App.tsx` (no mesmo efeito que já busca o usuário atual) a partir de `profiles.is_admin` do usuário logado.

### Rotas novas (lazy-loaded, mesmo padrão das rotas existentes em `App.tsx`)

| Rota | Componente | Descrição |
|---|---|---|
| `/admin` | `AdminDashboard` | Visão geral / atalhos para as duas seções abaixo |
| `/admin/workouts` | `AdminWorkoutList` | Lista os dias do desafio existentes em `workouts` |
| `/admin/workouts/:day` | `AdminWorkoutEdit` | Editor de um dia específico |
| `/admin/users` | `AdminUsers` | Lista somente-leitura dos usuários não-admin |

Todas as 4 rotas ficam envolvidas por um componente `RequireAdmin` (`src/components/RequireAdmin.tsx`) que redireciona para `/home` quando `isAdmin` é `false` (aguardando `isLoading` do `authStore` terminar antes de decidir, para não redirecionar prematuramente antes da sessão carregar).

### Ponto de entrada

Um link "Painel Admin" em `src/pages/Profile.tsx`, renderizado condicionalmente quando `isAdmin === true`.

### Nota de segurança

O `RequireAdmin` é só UX — a segurança real está inteiramente na RLS descrita acima. Mesmo que alguém force a URL `/admin/workouts/:day` sem ser admin, a leitura funciona (workouts é público), mas qualquer `UPDATE` é rejeitado pelo Postgres.

## Editor de treinos

### `src/pages/admin/AdminWorkoutList.tsx`

Grade com os dias existentes na tabela `workouts`, ordenados por `day_number`, mostrando dia, título e quantidade de exercícios. Cada card leva para `/admin/workouts/:day`. Não é possível criar ou remover dias aqui.

### `src/pages/admin/AdminWorkoutEdit.tsx`

Carrega o treino do dia (reaproveitando `getWorkoutByDay` de `src/utils/workouts.ts`) e apresenta um formulário com:

- **Título** (texto)
- **Vídeo do dia** (URL)
- **Lista de exercícios** — cada item é um card editável com os campos do tipo `Exercise` já existente (`exercise`, `reps`, `sets`, `note`, `group`, `type`, `video`), sendo `type` um `<select>` com as opções `normal | warmup | drop_set | core` e `group` um campo de texto livre (id do bi-set).
  - Botões **▲ / ▼** por card para reordenar (troca de índice no array; sem biblioteca de drag-and-drop).
  - Botão **remover** por card.
  - Botão **"+ Adicionar exercício"** no fim da lista, que insere um card vazio.
- **Botão Salvar**: persiste `title`, `video_url` e o array `exercises` inteiro numa única chamada `UPDATE`. Segue o padrão de feedback de erro já usado no app (`alert()`, como em `src/utils/plans.ts` / `src/pages/Home.tsx`).

### Camada de dados

`src/utils/adminWorkouts.ts` (novo arquivo, separado de `workouts.ts` que é focado no fluxo do usuário comum):

```ts
listWorkoutsAdmin(): Promise<Workout[]>
updateWorkoutAdmin(day: number, data: { title: string; video_url: string; exercises: Exercise[] }): Promise<void>
```

## Lista de usuários

### `src/utils/adminUsers.ts`

```ts
listNonAdminUsers(): Promise<Array<{ id: string; email: string; username: string | null; created_at: string; completedDays: number }>>
```

Implementação:
1. `supabase.from('profiles').select('*').eq('is_admin', false).order('created_at', { ascending: false })`
2. `supabase.from('user_progress').select('user_id, completed').in('user_id', ids).eq('completed', true)`, agregando no client a contagem de dias completados por `user_id`.

Sem view nova no banco nem RPC — duas queries simples mais agregação em JS, adequado ao volume de usuários esperado. Sem paginação na primeira versão.

### `src/pages/admin/AdminUsers.tsx`

Tabela somente-leitura: Email | Username | Cadastro | Progresso (`X/30`). Sem ações de edição ou exclusão — escopo definido como visualização apenas.

## Testes e verificação

### Migration / RLS (via Supabase CLI, já linkado ao projeto)

- Aplicar a migration com `supabase db query --linked --file ...`.
- Verificar com script Node usando a anon key, autenticado como usuário comum de teste:
  - `UPDATE` em `workouts` deve falhar.
  - `SELECT` em `profiles`/`user_progress` de outro `user_id` deve retornar vazio.
  - Um novo cadastro de teste deve gerar automaticamente uma linha em `profiles` (confirma o trigger).
- Promover `ataide.junior.uiux@gmail.com` para `is_admin = true` e repetir as mesmas verificações autenticado como essa conta — devem passar.

### Testes automatizados (Vitest, seguindo o padrão de `src/__tests__/`)

- `adminWorkouts.test.ts` / `adminUsers.test.ts`, mockando o client Supabase como já é feito em `WorkoutDay.test.tsx` / `exerciseProgress.test.ts`.
- Teste do `RequireAdmin`: redireciona para `/home` quando `isAdmin` é `false`/indefinido; renderiza o conteúdo quando `true`.

### Verificação manual end-to-end (`npm run dev`)

1. Logar com a conta admin → conferir que o link "Painel Admin" aparece em `Profile`.
2. Editar um dia em `/admin/workouts/:day` (mudar título e um exercício), salvar, e confirmar que a mudança aparece em `/workout/:day`.
3. Abrir `/admin/users` e confirmar que a lista carrega com progresso correto.
4. Logar com uma conta comum → confirmar que o link admin não aparece, e que navegar direto para `/admin/workouts` redireciona para `/home`.
