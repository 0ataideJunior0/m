# Receitas fitness — design

Data: 2026-10-20 · Status: aguardando aprovação

## Intenção

Dar às alunas uma área de receitas fitness dentro do app, com a mesma lógica dos treinos: a treinadora cadastra e mantém tudo pelo painel admin, e a aluna vê a lista, abre uma receita e assiste ao vídeo do preparo sem sair do app. Começa com cerca de 10 receitas que a treinadora já tem; o número deve crescer com o tempo.

## Objetivos

- Card **Receitas** na Home, logo **abaixo do card HIIT** e **antes de Planos Alimentares**.
- **Lista de receitas**: cada item mostra o **título** e os **macronutrientes**.
- **Detalhe da receita**: **foto do prato pronto como capa**, macronutrientes, **ingredientes**, **modo de preparo** e um botão de **vídeo do preparo** que abre o mesmo modal de vídeo usado nos exercícios.
- **Painel admin**: criar, editar e apagar receitas — título, macros, ingredientes, modo de preparo, **upload da foto** (do computador ou celular) e **link do YouTube** do vídeo.

## Não-objetivos (por enquanto)

- Busca, categorias e filtros na lista (com ~10 receitas não fazem falta; dá pra acrescentar quando a lista crescer).
- Favoritar, avaliar, comentar ou compartilhar receitas.
- Calcular macros automaticamente a partir dos ingredientes — a treinadora digita os números.
- Upload de vídeo pelo app — o vídeo sempre vai pro YouTube e o painel só recebe o link.
- Lista de compras, porções ajustáveis, conversão de medidas.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Receita sem foto ou sem vídeo ficar com cara de quebrada — os dois são opcionais e a tela tem que ficar bonita sem eles.
- Foto pesada deixando o app lento no 4G — a imagem precisa ser reduzida antes de subir.
- Quem não é assinante conseguir ver as receitas.

## Decisões da treinadora

- Receitas cadastradas e editadas **só pelo painel admin**.
- Vídeo do preparo é **link do YouTube**, igual aos treinos, e abre no **mesmo modal de vídeo** dos exercícios.
- **Foto do prato pronto** fica **na capa da página de detalhe** e é enviada **pelo painel admin**.
- Campos da receita: título, macronutrientes, ingredientes, modo de preparo, foto, vídeo.
- **Foto, vídeo e macros são opcionais** (confirmado).
- **Macros são da receita inteira**, não por porção (confirmado). Sem campo de rendimento/porções.
- **Só assinantes veem** as receitas, igual a treinos e planos alimentares (confirmado).
- Posição do card na Home: abaixo do HIIT, antes dos Planos Alimentares.

## Como fica

### Banco (Supabase)

Tabela nova `recipes`:

| coluna | tipo | observação |
|---|---|---|
| `id` | uuid PK | |
| `title` | text NOT NULL | |
| `calories` | integer NULL | kcal |
| `protein_g`, `carbs_g`, `fat_g` | numeric(6,1) NULL | gramas |
| `ingredients` | text NOT NULL default '' | um ingrediente por linha |
| `steps` | text NOT NULL default '' | um passo por linha |
| `image_path` | text NULL | caminho no bucket de fotos |
| `video_url` | text NULL | link do YouTube |
| `sort_order` | integer NOT NULL | ordem na lista, definida pela admin |
| `published` | boolean NOT NULL default false | rascunho até a admin publicar |
| `created_at`, `updated_at` | timestamptz | |

RLS: `SELECT` para `is_admin()` ou (`has_active_subscription()` **e** `published`); `INSERT/UPDATE/DELETE` só `is_admin()`. Com `GRANT` explícito pra `authenticated` (lição de `20260727100000_user_exercise_progress_delete_policy.sql`: sem o grant o delete falha calado).

Storage: bucket `recipe-images`, leitura pública, escrita só admin (policies em `storage.objects` com `bucket_id = 'recipe-images' AND public.is_admin()`).

Migração aplicada via MCP do Supabase, inspecionando o banco antes (o histórico local de migrações não é confiável — ver memória do projeto).

### App da aluna

- **Home**: card "Receitas" no mesmo formato visual dos outros (cartão com imagem de fundo e texto grande). Leva a `/receitas`.
- **`/receitas`** (protegida por `RequireSubscription` + `RequireOnboarding`): lista na ordem definida pela admin. Cada item: miniatura da foto (se houver), título e uma linha de macros — `320 kcal · P 28g · C 30g · G 9g` — com a legenda "receita inteira" no detalhe, pra ninguém ler como porção. Macros vazios simplesmente não aparecem.
- **`/receitas/:id`**: foto de capa no topo (ou um fundo com a cor da marca se não houver foto), título, quatro "pílulas" de macros com a legenda "Valores da receita inteira", botão **Ver preparo** (só se houver vídeo) abrindo o mesmo `ExerciseVideoModal` e a mesma lógica de URL do YouTube de `useExerciseVideoModal`, lista de ingredientes com marcadores e modo de preparo numerado.

### Painel admin

- Novo item no dashboard admin: **Receitas** → `/admin/recipes`.
- **Lista**: todas as receitas (publicadas e rascunhos, com selo "Rascunho"), setas pra reordenar, botão **Nova receita**.
- **Editor** `/admin/recipes/:id` (e `/admin/recipes/nova`): mesmo padrão visual e de UX do editor de treinos (campos com rótulo, barra de salvar fixa com "Alterações não salvas", Ctrl+S, aviso ao sair sem salvar, confirmação pra apagar):
  - título;
  - macros (4 campos numéricos lado a lado);
  - ingredientes e modo de preparo em caixas de texto, uma linha por item, com prévia de como a aluna vai ver;
  - foto: botão "Escolher foto" com prévia, trocar e remover;
  - link do YouTube com aviso se não parecer link e botão pra abrir e conferir;
  - interruptor **Publicada** (desligado = só a admin vê).

## Decisões minhas (pode mudar)

- **Miniatura na lista**: a foto aparece pequena na lista também, além de grande na capa do detalhe — ajuda a reconhecer a receita. Se preferir a lista só com texto, é um ajuste pequeno.
- **Rascunho/publicada**: acrescentei pra você poder montar a receita com calma (subir foto, esperar o vídeo) sem a aluna ver pela metade.
- **Ordem manual** pela admin (setas), em vez de alfabética ou por data.
- **Foto reduzida no navegador** antes de subir (até ~1200px de largura, formato WebP), pra não pesar.
- **Bucket de fotos com leitura pública**: a foto de um prato não é conteúdo sensível e assim ela carrega rápido e entra no cache; os dados da receita (texto, macros, vídeo) continuam só pra assinantes.
- **Ingredientes e preparo em texto, um item por linha**, em vez de um formulário campo a campo — mais rápido pra colar as receitas que você já tem.
- **Imagem do card na Home**: até você mandar uma foto para o card, uso o fundo com a cor da marca; quando mandar, troco como fizemos com os outros cards.

## Fica a critério de quem constrói

- Layout exato das telas, dentro do design system Musafit (tokens, fontes, tom).
- Estrutura de componentes e reaproveitamento do editor de treinos.
- Nomes de arquivos, rotas internas e testes, seguindo os padrões do repositório.
