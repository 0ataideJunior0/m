# Receitas fitness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Área de receitas fitness (lista → detalhe com foto, macros, ingredientes, preparo e vídeo) mantida pela admin no painel.

**Architecture:** Tabela `recipes` + bucket `recipe-images` no Supabase, protegidos por RLS (`has_active_subscription()` / `is_admin()`). Leitura da aluna em `src/utils/recipes.ts`, escrita da admin em `src/utils/adminRecipes.ts`. Telas novas seguem os padrões existentes: páginas da aluna como `MealPlan`/`ProgramDays`, editor da admin com a mesma UX de `src/components/admin/WorkoutEditor.tsx`.

**Tech Stack:** React + TypeScript + Vite + Tailwind (tokens Musafit), Supabase (Postgres, RLS, Storage), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-20-receitas-fitness-design.md`

## Global Constraints

- Card "Receitas" na Home: **abaixo do card HIIT, antes de "Planos Alimentares"**.
- Só assinantes (e admin) leem receitas; só **publicadas** aparecem pra aluna; só admin escreve.
- Foto, vídeo e macros são **opcionais**; a tela tem que ficar completa sem eles.
- Macros são da **receita inteira**; o detalhe mostra a legenda exata **"Valores da receita inteira"**.
- Linha de macros na lista no formato exato: `320 kcal · P 28g · C 30g · G 9g` (omite o que estiver vazio).
- Ingredientes e preparo: texto, **um item por linha**; preparo exibido numerado.
- Vídeo = link do YouTube, aberto no `ExerciseVideoModal` existente.
- Foto reduzida no navegador antes do upload: **até 1200px de largura, WebP**.
- Bucket `recipe-images`: leitura pública, escrita só admin.
- Textos de interface em português do Brasil.
- A migração é aplicada no banco de **produção** via MCP do Supabase — pedir confirmação explícita ao usuário antes de aplicar e inspecionar o banco antes (histórico local de migrações não é confiável).

## Review Focus

- Receita sem foto, sem vídeo e sem macros: lista e detalhe sem buracos (sem `<img>` quebrada, sem botão de vídeo, sem linha de macros vazia). Testes nas Tasks 4 e 5.
- Linhas em branco / espaços nos ingredientes e no preparo não viram itens vazios nem números pulados. Teste na Task 2.
- Upload de foto que falha (rede, arquivo que não é imagem) não perde o que a admin digitou e mostra erro. Teste na Task 6.
- Trocar ou remover a foto apaga a antiga do bucket só depois que a receita salvou (sem receita apontando pra arquivo inexistente). Teste na Task 3.
- Link de vídeo que não é YouTube (ou URL inválida) não quebra o detalhe — o modal recebe a URL como está, igual aos treinos. Teste na Task 5.

---

### Task 1: Banco — tabela `recipes` e bucket `recipe-images`

**Files:**
- Create: `supabase/migrations/20261020120000_recipes.sql`
- Modify: `src/types/index.ts` (novo tipo `Recipe`)

**Interfaces:**
- Produces: tabela `public.recipes` com as colunas do spec (`id, title, calories, protein_g, carbs_g, fat_g, ingredients, steps, image_path, video_url, sort_order, published, created_at, updated_at`); bucket `recipe-images`.
- Produces (TS):
  ```ts
  export interface Recipe {
    id: string; title: string
    calories: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null
    ingredients: string; steps: string
    image_path: string | null; video_url: string | null
    sort_order: number; published: boolean
    created_at: string; updated_at: string
  }
  ```

- [ ] **Step 1: Escrever a migração**
  - `CREATE TABLE public.recipes` conforme a tabela do spec; `numeric(6,1)` pros gramas; `sort_order integer NOT NULL DEFAULT 0`; `published boolean NOT NULL DEFAULT false`; `CHECK (char_length(title) BETWEEN 1 AND 120)`.
  - Índice em `(published, sort_order)`.
  - RLS ligado; `GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated`.
  - Policies: SELECT `public.is_admin() OR (published AND public.has_active_subscription())`; INSERT/UPDATE/DELETE `public.is_admin()` (UPDATE com `USING` e `WITH CHECK`).
  - `INSERT INTO storage.buckets (id, name, public) VALUES ('recipe-images','recipe-images', true) ON CONFLICT DO NOTHING`.
  - Policies em `storage.objects` pra INSERT/UPDATE/DELETE com `bucket_id = 'recipe-images' AND public.is_admin()` (leitura pública vem do bucket público).
- [ ] **Step 2: Adicionar `Recipe` em `src/types/index.ts`.** Rodar `npm run check` → sem erros.
- [ ] **Step 3: Pedir confirmação ao usuário, inspecionar (`list_tables`, buckets existentes) e aplicar via `mcp__supabase__apply_migration`.** Verificar com SQL: tabela existe, `relrowsecurity = true`, 4 policies em `recipes`, bucket público; rodar `get_advisors` (security) e confirmar que não há aviso novo.
- [ ] **Step 4: Commit** `git commit -m "Receitas: tabela recipes e bucket de fotos"`

### Task 2: Formatação pura das receitas

**Files:**
- Create: `src/utils/recipeFormat.ts`
- Test: `src/__tests__/recipeFormat.test.ts`

**Interfaces:**
- Produces:
  - `macroSummary(r: Pick<Recipe,'calories'|'protein_g'|'carbs_g'|'fat_g'>): string`
  - `splitLines(text: string): string[]` — corta por linha, `trim`, descarta vazias.
  - `fitWithin(width: number, height: number, max: number): { width: number; height: number }` — nunca aumenta; mantém proporção; arredonda.

- [ ] **Step 1: Testes que falham**
  ```ts
  expect(macroSummary({ calories: 320, protein_g: 28, carbs_g: 30, fat_g: 9 })).toBe('320 kcal · P 28g · C 30g · G 9g')
  expect(macroSummary({ calories: null, protein_g: 12.5, carbs_g: null, fat_g: 0 })).toBe('P 12.5g · G 0g')
  expect(macroSummary({ calories: null, protein_g: null, carbs_g: null, fat_g: null })).toBe('')
  expect(splitLines('  2 ovos \n\n 1 banana\r\n   \n')).toEqual(['2 ovos', '1 banana'])
  expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 })
  expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 })
  ```
- [ ] **Step 2:** `npx vitest run src/__tests__/recipeFormat.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar as três funções.** Números formatados com `String(n)` (0 aparece; `null` some).
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: Commit** `git commit -m "Receitas: formatação de macros e listas"`

### Task 3: Acesso a dados (aluna e admin) e upload de foto

**Files:**
- Create: `src/utils/recipes.ts`, `src/utils/adminRecipes.ts`, `src/utils/imageResize.ts`
- Test: `src/__tests__/recipes.test.ts`, `src/__tests__/adminRecipes.test.ts`

**Interfaces:**
- Consumes: `Recipe` (Task 1), `fitWithin` (Task 2).
- Produces (`recipes.ts`, padrão try/catch devolvendo vazio/null como `utils/workouts.ts`):
  - `listRecipes(): Promise<Recipe[]>` — `published = true`, ordem `sort_order` asc.
  - `getRecipe(id: string): Promise<Recipe | null>`
  - `recipeImageUrl(path: string | null): string | null` — `supabase.storage.from('recipe-images').getPublicUrl(path).data.publicUrl`.
- Produces (`adminRecipes.ts`, padrão que lança erro como `utils/adminWorkouts.ts`):
  - `export type RecipePayload = Omit<Recipe, 'id' | 'sort_order' | 'created_at' | 'updated_at'>`
  - `listRecipesAdmin(): Promise<Recipe[]>` (todas, por `sort_order`)
  - `getRecipeAdmin(id: string): Promise<Recipe | null>`
  - `createRecipeAdmin(payload: RecipePayload): Promise<Recipe>` — `sort_order` = maior atual + 1.
  - `updateRecipeAdmin(id: string, payload: RecipePayload): Promise<Recipe>` — grava `updated_at`.
  - `deleteRecipeAdmin(recipe: Recipe): Promise<void>` — apaga a linha e depois a foto (falha ao apagar a foto não lança).
  - `swapRecipeOrderAdmin(a: Recipe, b: Recipe): Promise<void>` — troca os `sort_order`.
  - `uploadRecipeImage(file: Blob): Promise<string>` — sobe em `recipes/<uuid>.webp` com `contentType: 'image/webp'`, devolve o path.
  - `removeRecipeImage(path: string): Promise<void>`
- Produces (`imageResize.ts`): `resizeToWebp(file: File, maxWidth = 1200): Promise<Blob>` — `createImageBitmap` + canvas + `toBlob('image/webp', 0.85)`; rejeita com `Error('Arquivo não é uma imagem')` se `file.type` não começar com `image/`. Sem teste unitário (canvas não existe no jsdom); coberto pelo teste da Task 6 com mock.

- [ ] **Step 1: Testes que falham** (mock encadeável `fakeQuery` igual a `src/__tests__/adminWorkouts.test.ts`, mais `storage.from` mockado):
  - `listRecipes` filtra `published = true` e ordena por `sort_order`; erro → `[]`.
  - `recipeImageUrl(null)` → `null`; com path chama `getPublicUrl(path)`.
  - `createRecipeAdmin` insere com `sort_order` = último + 1 (lista vazia → 0).
  - `swapRecipeOrderAdmin` faz dois updates trocando os valores.
  - `deleteRecipeAdmin` apaga a linha **antes** da foto; se a foto falhar, não lança.
  - `uploadRecipeImage` sobe com `contentType: 'image/webp'` em path começando com `recipes/` e terminando em `.webp`.
- [ ] **Step 2:** `npx vitest run src/__tests__/recipes.test.ts src/__tests__/adminRecipes.test.ts` → FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** mesmo comando → PASS.
- [ ] **Step 5: Commit** `git commit -m "Receitas: leitura, escrita e upload de foto"`

### Task 4: Lista de receitas da aluna + card na Home

**Files:**
- Create: `src/pages/Recipes.tsx`
- Modify: `src/App.tsx` (rota `/receitas` com `RequireSubscription` + `RequireOnboarding`, lazy), `src/pages/Home.tsx` (card entre HIIT e Planos Alimentares)
- Test: `src/__tests__/Recipes.test.tsx`, `src/__tests__/Home.test.tsx`

**Interfaces:**
- Consumes: `listRecipes`, `recipeImageUrl` (Task 3), `macroSummary` (Task 2).

- [ ] **Step 1: Testes que falham**
  - `Recipes`: mostra título e `320 kcal · P 28g · C 30g · G 9g`; receita sem foto não renderiza `<img>`; receita sem macros não renderiza linha de macros; lista vazia mostra "Nenhuma receita por aqui ainda."; tocar na receita navega pra `/receitas/<id>`.
  - `Home`: botão com nome acessível "Ver receitas" aparece, e no DOM vem depois do botão "Ver Treino HIIT" e antes do texto "Planos Alimentares".
- [ ] **Step 2:** rodar os dois testes → FAIL.
- [ ] **Step 3: Implementar.** Lista no padrão visual de `MyWorkout.tsx` (cartões `rounded-3xl`, miniatura 64×64 `object-cover rounded-2xl`, `loading="lazy"`, `alt=""` pois o título está ao lado). Card da Home no mesmo formato do card HIIT (título "Receitas fitness", descrição curta, botão-imagem `aria-label="Ver receitas"`) com fundo `brand-gradient` no lugar da foto.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `git commit -m "Receitas: lista da aluna e card na Home"`

### Task 5: Detalhe da receita com vídeo

**Files:**
- Create: `src/utils/videoUrl.ts`, `src/pages/RecipeDetail.tsx`
- Modify: `src/hooks/useExerciseVideoModal.ts` (passa a importar `resolveVideoUrl` de `utils/videoUrl.ts`, sem mudar comportamento), `src/App.tsx` (rota `/receitas/:id`, mesmas proteções)
- Test: `src/__tests__/RecipeDetail.test.tsx`

**Interfaces:**
- Consumes: `getRecipe`, `recipeImageUrl` (Task 3), `splitLines` (Task 2), `ExerciseVideoModal`, `useDialogA11y`.
- Produces: `resolveVideoUrl(raw: string): string` exportada de `src/utils/videoUrl.ts` (código movido do hook).

- [ ] **Step 1: Testes que falham**
  - Com foto: `<img>` de capa com `alt` = título; legenda "Valores da receita inteira" e as quatro pílulas (`320 kcal`, `28g proteína`, `30g carboidratos`, `9g gorduras`).
  - Ingredientes viram `<li>` (linhas vazias ignoradas); preparo vira `<ol>` numerado.
  - Sem foto: nenhuma `<img>`; sem vídeo: nenhum botão "Ver preparo"; sem macros: sem a legenda.
  - Com vídeo: clicar "Ver preparo" abre `role="dialog"` cujo iframe tem `src` contendo `youtube.com/embed/`; com link não-YouTube, o `src` é o link original.
  - Receita inexistente (`getRecipe` → null): "Receita não encontrada" e botão "Ver receitas" levando a `/receitas`.
- [ ] **Step 2:** `npx vitest run src/__tests__/RecipeDetail.test.tsx` → FAIL.
- [ ] **Step 3: Mover `resolveVideoUrl` e implementar a página.** Capa `aspect-[4/3] object-cover` em largura total; sem foto, faixa `brand-gradient` com o título. Estado do modal local (`open`, `loading`) + `useDialogA11y`.
- [ ] **Step 4:** rodar o teste novo e os já existentes de vídeo (`npx vitest run src/__tests__/RecipeDetail.test.tsx src/__tests__/WorkoutDay`) → PASS.
- [ ] **Step 5: Commit** `git commit -m "Receitas: página de detalhe com vídeo do preparo"`

### Task 6: Painel admin — lista e editor de receitas

**Files:**
- Create: `src/pages/admin/AdminRecipes.tsx`, `src/pages/admin/AdminRecipeEdit.tsx`
- Modify: `src/pages/admin/AdminDashboard.tsx` (tile "Receitas", ícone `ChefHat`, texto "Cadastrar receitas, fotos e vídeos de preparo"), `src/App.tsx` (rotas `/admin/recipes`, `/admin/recipes/nova`, `/admin/recipes/:id` com `RequireOnboarding` + `RequireAdmin`)
- Test: `src/__tests__/AdminRecipes.test.tsx`, `src/__tests__/AdminRecipeEdit.test.tsx`

**Interfaces:**
- Consumes: tudo de `adminRecipes.ts` (Task 3), `resizeToWebp` (Task 3), `recipeImageUrl`, `splitLines`, `macroSummary`, `isLikelyUrl` de `src/utils/workoutEditor.ts`, componentes `ui/*` (`PageHeader`, `FormField`, `Input`, `Button`, `Modal`, `Toast`).

- [ ] **Step 1: Testes que falham**
  - `AdminRecipes`: lista todas, com selo "Rascunho" nas não publicadas; "Nova receita" vai pra `/admin/recipes/nova`; seta "Mover <título> para baixo" chama `swapRecipeOrderAdmin` com as duas receitas e reordena; seta da ponta desabilitada.
  - `AdminRecipeEdit` (nova): salvar sem título mostra "Dê um título à receita." e não chama `createRecipeAdmin`; com título chama `createRecipeAdmin` com `published: false`, macros vazios como `null`, números digitados como `number` (`"28,5"` → `28.5`), e navega pra `/admin/recipes/<id>`.
  - Foto: escolher arquivo chama `resizeToWebp` e `uploadRecipeImage`, mostra prévia; se o upload rejeitar, mostra toast "Erro ao enviar a foto." e o título digitado continua no campo.
  - Trocar foto de uma receita existente: `removeRecipeImage(pathAntigo)` só é chamado **depois** de `updateRecipeAdmin` resolver.
  - Interruptor `role="switch"` "Publicada" entra no payload.
  - Apagar pede confirmação num `dialog` e só então chama `deleteRecipeAdmin`; depois volta pra `/admin/recipes`.
  - Prévia: ingredientes digitados aparecem como itens; preparo numerado.
  - Alterações não salvas + voltar → "Sair sem salvar?".
- [ ] **Step 2:** rodar os dois testes → FAIL.
- [ ] **Step 3: Implementar.** Mesma UX do `WorkoutEditor` (barra fixa com status "Alterações não salvas"/"Tudo salvo", Ctrl+S, `beforeunload`, modal "Sair sem salvar?"). Macros em grade de 4 `inputMode="decimal"`. Ingredientes e preparo em `textarea` com dica "Um item por linha". Upload acontece ao escolher o arquivo (guarda o novo path no rascunho); a foto antiga só é removida depois do save.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5: Commit** `git commit -m "Receitas: painel admin com lista e editor"`

### Task 7: Verificação final

- [ ] **Step 1:** `npm run check` → sem erros.
- [ ] **Step 2:** `npx vitest run` → todos passando.
- [ ] **Step 3:** `npm run build` → `✓ built`.
- [ ] **Step 4: Teste manual pelo usuário** com `npx vercel dev`: criar receita com e sem foto/vídeo, publicar, ver como aluna assinante. Nada vai pra main sem aprovação explícita.
