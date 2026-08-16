# Plano de Correções — MusaFit

**Destinatário:** agente de código
**Origem:** auditoria do repositório em 2026-08-04
**Revisão:** 2026-08-04, após verificação das afirmações contra o código real
**Modo de execução:** fases sequenciais com **checkpoint de aprovação humana** ao fim de cada uma. Não avance para a fase seguinte sem confirmação explícita.

---

## Registro de revisão (2026-08-04)

As afirmações do plano original foram conferidas uma a uma contra o repositório. A maioria se sustentou. Três não:

| # | Onde | Problema | Correção aplicada |
|---|---|---|---|
| 1 | Fase 1 | Premissa factualmente desatualizada: o churn de CRLF descrito **não existe**. `git ls-files --eol` retorna **0 arquivos com CRLF no índice** (de 133 rastreados); `git status --short` está limpo; três commits foram feitos em 2026-08-04 sem nenhum churn | Fase rebaixada de "pré-requisito absoluto" para tarefa barata de higiene. Deixou de bloquear as demais |
| 2 | Fase 5.4 | Conclusão certa, evidência imprecisa — e ambas escondiam um bug pior. Existe código que escreve `musa_hiit_url` (`HIIT.tsx:89` e `:101`), mas está **dentro de um comentário JSX** (`{/* ... */}`, linhas 85–110), portanto morto. O efeito colateral disso é uma falha real em produção | Tarefa reescrita — ver Fase 5.4 |
| 3 | Regra geral 3 | Exige `npm test` verde antes de todo PR, mas há uma suíte quebrada de forma permanente desde o commit inicial | Criada a **Fase 0.5**, que destrava a regra |

Também foi corrigida a afirmação de que a Fase 0 "bloqueia tudo": ela bloqueia apenas a Fase 4 e parte da 6.1. Ver *Ordem de execução*.

**Verificado e confirmado como correto:** Fase 0 (cabeçalho `NÃO RODAR AINDA`), Fase 2 (colisão de chave e índice local no bi-set), 3.1 (arquivo existe), 3.2 (tautologia literal), 3.4 (`completed: false` incondicional), 5.1 (`setInterval` de 30s), 5.2 (exatamente 6 `alert()` nas linhas citadas), 4.2 (11 migrations sem timestamp), 7.4 (6 branches locais, 7 remotas).

**Não verificado — tratar como hipótese até checar:** a lógica interna de `authPersist.ts` (o argumento de que "nunca executa o caminho de restauração"), a acessibilidade dos modais (5.3), e o conteúdo de README / PRD / `cleanup_report.md` (Fase 7).

---

## Regras gerais para o agente

1. **Uma fase = um branch = um PR.** Nomear `fix/fase-N-descricao`.
2. **Não rode migrations em produção.** Migrations novas são escritas como arquivo em `supabase/migrations/` e o SQL de verificação é entregue ao humano para execução no Supabase SQL Editor. O agente nunca executa DDL contra o banco.
3. **Sempre rodar antes de abrir PR:** `npm run check` (tsc) e `npm test` (vitest). Ambos devem passar.
   > ⚠️ Hoje `npm test` **não passa**: `src/__tests__/Dashboard.test.tsx` importa `../pages/Dashboard`, arquivo que nunca existiu (a página se chama `Home.tsx` desde sempre). 16 de 17 suítes passam. A **Fase 0.5** resolve isso — até lá, esta regra é impossível de cumprir.
4. **Não refatorar oportunisticamente.** Se encontrar algo fora do escopo da fase, registrar em `docs/ACHADOS-EXTRAS.md` e seguir.
5. **Cada correção de bug precisa de um teste que falha antes e passa depois.** Sem exceção nas Fases 2 e 4.
6. Ambiente: Windows + OneDrive. `node_modules` foi instalado no Windows — binários nativos (`@rollup/rollup-*`) não funcionam em Linux. Se rodar em container, reinstalar dependências.

---

## Fase 0 — Diagnóstico do schema real (bloqueia tudo)

**Por quê:** a migration `supabase/migrations/20260720160000_programs_constraints_finalize.sql` está marcada no próprio cabeçalho como *"Passo 4/4 (finalização — NÃO RODAR AINDA)"*. Não se sabe se foi aplicada. Todas as fases seguintes que tocam o banco dependem dessa resposta. Agir às cegas aqui pode corromper dados de produção.

### Tarefa 0.1 — Produzir script de diagnóstico

Criar `supabase/diagnostics/00-schema-atual.sql` contendo **apenas SELECTs** (zero DDL, zero DML):

```sql
-- 1. day_number ainda existe?
SELECT table_name, column_name, is_nullable, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('workouts', 'user_progress', 'user_exercise_progress')
ORDER BY table_name, ordinal_position;

-- 2. Constraints e índices reais (nomes exatos)
SELECT conrelid::regclass AS tabela, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND conrelid::regclass::text IN ('workouts','user_progress','user_exercise_progress','profiles','programs')
ORDER BY 1, 2;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 3. Policies de RLS em vigor
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Integridade dos dados novos
SELECT COUNT(*) AS workouts_sem_program_id FROM public.workouts WHERE program_id IS NULL;
SELECT COUNT(*) AS workouts_sem_weekday   FROM public.workouts WHERE weekday IS NULL;
SELECT COUNT(*) AS progress_sem_workout   FROM public.user_progress WHERE workout_id IS NULL;
SELECT COUNT(*) AS ex_progress_sem_workout FROM public.user_exercise_progress WHERE workout_id IS NULL;

-- 5. As tabelas de arquivo do passo 3 existem?
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%archive_20260720%';

-- 6. Escala atual (dimensiona o risco de qualquer backfill)
SELECT
  (SELECT COUNT(*) FROM public.profiles)               AS usuarias,
  (SELECT COUNT(*) FROM public.workouts)               AS treinos,
  (SELECT COUNT(*) FROM public.user_progress)          AS linhas_progresso,
  (SELECT COUNT(*) FROM public.user_exercise_progress) AS linhas_checklist;
```

### Tarefa 0.2 — Interpretar o resultado

> ✅ **CONCLUÍDA em 2026-08-05 — resultado: CENÁRIO A.** Ver [diagnostico-schema-2026-08.md](diagnostico-schema-2026-08.md).
>
> A finalize **já estava aplicada em produção** — o arquivo de migration só nunca teve o aviso "NÃO RODAR AINDA" removido do cabeçalho. `day_number` está ausente das três tabelas, `workouts_program_weekday_unique` existe, e as cinco contagens de integridade deram zero.
>
> **Consequências imediatas:**
> - **Tarefa 4.0 é desnecessária** — existia apenas para o cenário B. Fase 4 fica reduzida a 4.1 e 4.2
> - **Tarefa 2.4 liberada sem escalar** — `user_exercise_progress` tem só 8 linhas, longe de "materialmente alta"
> - **Tarefa 4.1 com pré-condição já satisfeita** — `completed = true AND completion_count = 0` retorna 0
> - **Tarefa 6.1 confirmada e ampliada** — `workouts`, `programs` **e `pdf_plans`** têm `USING (true)`
>
> Execução feita via MCP Supabase em `--read-only`, não pelo fluxo manual descrito abaixo.

O humano roda o script e cola a saída. O agente então grava `docs/diagnostico-schema-2026-08.md` classificando o estado em um de três cenários:

| Cenário | Sinal | Consequência |
|---|---|---|
| **A — Finalize aplicada** | `day_number` ausente nas 3 tabelas; `workouts_program_weekday_unique` existe | Fases seguintes seguem sem ajuste |
| **B — Finalize não aplicada, dados íntegros** | `day_number` presente; contagens de NULL do item 4 todas zero | Incluir Tarefa 4.0 (aplicar finalize) |
| **C — Estado inconsistente** | `day_number` presente **e** alguma contagem do item 4 > 0 | **PARAR.** Escalar ao humano. Há linhas órfãs que precisam de decisão de produto antes de qualquer constraint |

> ⛔ **CHECKPOINT 0** — Não prosseguir sem o cenário confirmado por escrito.

> 📌 **Nota de revisão:** esta fase bloqueia apenas a **Fase 4** e a **Tarefa 6.1**. As Fases 0.5, 1, 2, 3, 5 e 7 são client-side ou documentais e podem andar em paralelo enquanto o humano roda o SQL.

---

## Fase 0.5 — Destravar a suíte de testes (pré-requisito da Regra 3)

**Por quê:** a Regra geral 3 exige `npm test` verde antes de todo PR. Isso é impossível hoje: `src/__tests__/Dashboard.test.tsx` importa `../pages/Dashboard`, que **nunca existiu** no repositório. O teste é do commit inicial (`6606816`) e aparentemente sobreviveu a uma renomeação da página para `Home.tsx` que nunca chegou a acontecer no arquivo de teste. Resultado: 16 de 17 suítes passam, 1 falha de forma permanente e não relacionada a qualquer mudança futura.

Enquanto isso não for resolvido, **toda fase seguinte abre PR violando a Regra 3**, e o sinal de "testes vermelhos" perde o significado — é exatamente o cenário em que uma regressão real passa despercebida.

### Tarefa 0.5.1 — Decidir o destino do teste

Ler `src/__tests__/Dashboard.test.tsx` e comparar com `src/pages/Home.tsx`. Duas saídas possíveis:

- **O teste ainda descreve comportamento real** (boas-vindas com `username`, fallback para o prefixo do e-mail) → repontar o import para `../pages/Home`, ajustar seletores ao markup atual, renomear o arquivo para `Home.test.tsx`.
- **O teste descreve uma tela que não existe mais** → deletar, e registrar em `docs/ACHADOS-EXTRAS.md` que a cobertura da Home ficou em aberto.

Preferir a primeira opção. Só deletar se o comportamento testado tiver de fato desaparecido.

**Critério de aceite:** `npm test` verde, 17/17 suítes. A partir daqui a Regra 3 passa a valer de verdade.

> ⛔ **CHECKPOINT 0.5**

---

## Fase 1 — Higiene de Git (barata, não bloqueante)

> 🔄 **Fase revisada em 2026-08-04.** O texto original afirmava que `git status` acusava *"114 arquivos modificados, 16.428 inserções e 16.428 deleções"* de churn de CRLF, e classificava esta fase como **"pré-requisito absoluto de todas as outras"**. **Isso não corresponde ao estado do repositório.**
>
> Verificação:
> ```
> git ls-files --eol | grep -c "i/crlf"   →  0     (de 133 arquivos rastreados)
> git status --short                       →  limpo
> ```
> O índice do git está **100% LF**. O working tree em CRLF é o comportamento normal e correto de `core.autocrlf=true` no Windows — não é churn. Três commits foram feitos em 2026-08-04 (`dddb4d0`, `c2b0423`, `ae36ae5`) e enviados ao remoto sem nenhuma reescrita de arquivo.
>
> A fase **continua valendo a pena**, mas por outro motivo: hoje o repositório depende do `core.autocrlf` local de cada máquina. Um colaborador (ou uma ferramenta, ou um container Linux) com config diferente pode introduzir exatamente o churn que o texto original descrevia. O `.gitattributes` torna a normalização explícita e independente de configuração de máquina — é seguro contra um problema futuro, não correção de um problema presente.
>
> **Rebaixada de "bloqueia tudo" para "tarefa de 5 minutos, faça quando for conveniente".**

### Tarefa 1.1 — Criar `.gitattributes` na raiz

```
* text=auto eol=lf

*.png binary
*.jpg binary
*.jpeg binary
*.webp binary
*.ico binary
*.pdf binary
*.svg text eol=lf
```

### Tarefa 1.2 — Normalizar a árvore de trabalho

```bash
git config core.autocrlf false
git add --renormalize .
git status --short          # esperado: vazio
```

**Expectativa revisada:** como o índice já está inteiramente em LF, o `--renormalize` deve ser um **no-op** — nenhum arquivo deve aparecer modificado. Esse é o resultado correto e confirma o diagnóstico desta revisão.

Se, ao contrário, aparecerem arquivos modificados, o diagnóstico estava errado: **parar e reportar** antes de commitar, verificando com `git diff` se a mudança é de conteúdo ou de encoding.

### Tarefa 1.3 — Commit isolado

Um único commit, **sem nenhuma outra alteração junto**:
`chore: normalize line endings with .gitattributes`

### Tarefa 1.4 — Registrar recomendação (não executar)

Anotar em `docs/ACHADOS-EXTRAS.md`: o projeto vive em `OneDrive/Documentos/musaApp`. O OneDrive sincroniza `node_modules` independentemente do `.gitignore`, o que causa lentidão e corrupção intermitente de binários nativos. Recomendação ao humano: mover o repositório para fora da pasta sincronizada (ex.: `C:\dev\musaApp`). **Decisão do humano — o agente não move nada.**

**Critério de aceite:** `.gitattributes` commitado sozinho; `git add --renormalize .` não produziu nenhuma modificação (confirmando que não havia churn).

> ⛔ **CHECKPOINT 1**

---

## Fase 2 — Bug crítico: colisão de chave no checklist de exercícios

**Por quê:** é o bug de maior impacto do produto — corrompe silenciosamente a funcionalidade central.

`src/utils/exerciseKeys.ts` deriva a chave do **nome** do exercício; o `index` só entra quando o nome é vazio:

```ts
const base = (ex.group ? `${ex.group}-` : '') + (ex.exercise || `ex-${index ?? 0}`)
```

Dois exercícios com o mesmo nome no mesmo treino (ex.: "Prancha" no aquecimento e no core) produzem a **mesma chave**. Marcar um marca o outro na tela, e o índice único `user_ex_progress_unique (user_id, workout_id, exercise_key)` consolida os dois no servidor. A usuária não recebe nenhum aviso.

Agravante em `src/pages/WorkoutDay.tsx:235`: dentro do card de bi-set, `groupItems.map((exercise, idx) => ...)` passa um índice **local ao grupo** (0, 1) em vez do índice global do array de exercícios.

### Tarefa 2.1 — Testes que reproduzem a falha

Em `src/__tests__/exerciseKeys.test.ts` (arquivo novo):

- dois exercícios de mesmo nome em posições diferentes → chaves **distintas**
- mesmo exercício, mesma posição, chamadas repetidas → chave **estável**
- exercícios em grupos (bi-set) diferentes com mesmo nome → chaves distintas
- nome vazio → chave válida e não colidente
- nomes com acento e maiúscula ("Agachamento Sumô") → slug determinístico

Em `src/__tests__/WorkoutDay.test.tsx`, adicionar caso: treino com dois exercícios homônimos; marcar o primeiro não deve marcar o segundo. Deve **falhar** antes da correção.

### Tarefa 2.2 — Nova função de chave

Reescrever `getExerciseKey` para incluir **sempre** o índice global, mantendo o slug legível para depuração:

```ts
export function getExerciseKey(ex: Exercise, index: number): string {
  const slug = (ex.exercise || 'exercicio')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  const prefix = ex.group ? `g${ex.group}-` : ''
  return `${index}-${prefix}${slug || 'exercicio'}`
}
```

Tornar `index` obrigatório (remover o `?`) — o compilador passa a apontar todos os call sites que hoje omitem.

### Tarefa 2.3 — Corrigir o índice global no bi-set

Em `WorkoutDay.tsx`, o loop de montagem de cards já tem `i` como índice global. Propagar esse valor para dentro do grupo em vez do `idx` local:

- ao acumular `groupItems`, guardar o índice global de cada item (ex.: `{ ex, globalIndex }`)
- usar `globalIndex` em `getExerciseKey`, em `onToggle` e em `toggleExercise`

Atenção: `finalOrder` reordena os exercícios (aquecimento primeiro). O "índice global" precisa ser **o índice em `finalOrder`**, e essa ordenação precisa ser determinística — senão a chave muda entre renders. Verificar que `filter` preserva ordem estável (preserva) e que `workout.exercises` chega sempre na mesma ordem do banco (`normalizeWorkout` preserva a ordem do JSONB).

> ⚠️ **Consequência aceita:** editar a lista de exercícios de um treino no painel admin (inserir/remover/reordenar) desloca os índices e invalida as chaves salvas. Documentar isso em comentário no topo de `exerciseKeys.ts`. Solução definitiva seria um `id` estável por exercício dentro do JSONB — registrar como proposta em `docs/ACHADOS-EXTRAS.md`, **fora do escopo deste plano**.

### Tarefa 2.4 — Migração dos dados existentes

As linhas já gravadas em `user_exercise_progress` usam o formato antigo de chave. Escrever `supabase/migrations/<timestamp>_reset_exercise_keys.sql`.

Dado que `user_exercise_progress` guarda apenas o estado do checklist do treino **em andamento** (é apagado a cada conclusão por `resetExerciseProgress`), a opção mais simples e segura é **descartar** o estado antigo em vez de tentar remapear:

```sql
-- Chaves de exercício mudaram de formato (passaram a incluir índice
-- posicional) para corrigir colisão entre exercícios homônimos.
-- Chaves antigas são irremapeáveis com segurança; como esta tabela guarda
-- apenas o checklist em andamento (zerado a cada conclusão de treino),
-- descartá-las custa no máximo um treino parcialmente marcado por usuária.
-- O histórico permanente vive em user_progress.completion_count e não é tocado.
DELETE FROM public.user_exercise_progress;
```

Confirmar a contagem afetada com o item 6 do diagnóstico da Fase 0 antes de entregar. **Se for materialmente alta, escalar ao humano** em vez de assumir o descarte.

Adicionar também limpeza do cache local em `src/utils/exerciseProgress.ts`: bumpar o prefixo `LS_PREFIX` de `'exerciseProgress:'` para `'exerciseProgress:v2:'`, de modo que o localStorage antigo seja simplesmente ignorado (sem migração, sem lixo ativo).

**Critério de aceite:** testes da 2.1 verdes; `npm run check` limpo; marcar exercícios homônimos funciona de forma independente.

> ⛔ **CHECKPOINT 2**

---

## Fase 3 — Remoção de código morto e segurança decorativa

**Por quê:** três blocos de código dão a impressão de proteger algo e não protegem nada. Manter isso é pior que não ter: cria falsa confiança em auditoria futura.

### Tarefa 3.1 — Deletar `src/utils/authPersist.ts`

A função `tryRestoreSession` nunca executa seu caminho de restauração:

1. `getSession()` → se há sessão, retorna cedo
2. se não há sessão, `getUser()` também falha (depende da mesma sessão) → retorna `null`
3. o código nunca chega a ler o cache criptografado

Além disso, a chave AES-GCM é derivada via PBKDF2 **do próprio refresh token que está sendo guardado**. Quem consegue ler o `localStorage` para pegar o payload cifrado também lê o token em claro do storage do Supabase. A criptografia não adiciona nenhuma garantia.

E o `createClient` já usa `persistSession: true` + `autoRefreshToken: true` (`src/lib/supabase.ts:16-17`) — o Supabase faz isso nativamente.

Ações:
- deletar `src/utils/authPersist.ts` (83 linhas)
- em `src/App.tsx`: remover o import da linha 9 e simplificar o `useEffect` de `checkAuth` — o bloco `else` inteiro com `tryRestoreSession` (linhas 42-60) colapsa para o mesmo reset de estado
- remover a chamada `clearPersistedSession()` do timer de inatividade (linha 83)
- adicionar limpeza única da chave órfã: `localStorage.removeItem('musa_auth_enc')` na inicialização, com comentário explicando que é one-shot para não deixar lixo cifrado nos dispositivos

Verificar manualmente após a mudança: login → fechar aba → reabrir → sessão persiste (agora pelo mecanismo nativo do Supabase).

### Tarefa 3.2 — Deletar `src/utils/security.ts`

```ts
export function getOriginAllowed() {
  const allowed = [location.origin]   // sempre contém o próprio origin
  return allowed.includes(location.origin)  // sempre true
}
```

Tautologia. E o `getCSRFToken()` gera um token no cliente, manda num header `X-CSRF-Token` e nenhum servidor o valida — o Supabase autentica por Bearer token no header `Authorization`, não por cookie, então CSRF não se aplica a essa arquitetura.

Ações:
- deletar `src/utils/security.ts`
- em `src/lib/supabase.ts`, remover o import e o bloco `global.headers` inteiro
- limpar `sessionStorage.removeItem('csrf_token')` junto da limpeza da 3.1

### Tarefa 3.3 — Ajustar o timer de inatividade

Em `App.tsx:75-96`, os listeners de `mousemove` disparam `clearTimeout` + `setTimeout` a cada evento de mouse. Aplicar throttle simples: só reagendar se passaram mais de 30s desde o último reset (guardar `lastResetAt` em `useRef`).

Manter os 30 minutos de inatividade — é adequado para app de treino.

### Tarefa 3.4 — Corrigir `markWorkoutComplete`

Em `src/utils/workouts.ts:134`, todo upsert grava `completed: false`, **inclusive para quem já tinha `completed = true`**. A coluna `completed` foi substituída por `completion_count` na migration `20260727090000`, mas continua no schema, com policies, e sendo escrita com valor incorreto.

O `Profile.tsx:146` já usa apenas `completion_count`. Decisão: **parar de escrever `completed`** e remover o campo do payload do upsert. A coluna fica no banco por ora (drop entra na Fase 4).

Adicionar teste em `src/__tests__/markWorkoutComplete.test.ts`: o payload do upsert não deve conter a chave `completed`.

**Critério de aceite:** `npm run check` e `npm test` verdes; login/logout/refresh manualmente verificados; nenhum import quebrado.

> ⛔ **CHECKPOINT 3**

---

## Fase 4 — Consolidação de schema

**Executar apenas conforme o cenário confirmado na Fase 0.** Todas as migrations desta fase são escritas como arquivo e entregues; o agente não executa nada no banco.

### Tarefa 4.0 — [Somente cenário B] Aplicar a finalize com verificação prévia

> ⛔ **CANCELADA — não executar.** O diagnóstico de 2026-08-05 confirmou o **cenário A**: a finalize já está aplicada. Esta tarefa existia apenas para o cenário B.
>
> **Ação de limpeza no lugar dela:** remover o aviso *"Passo 4/4 (finalização — NÃO RODAR AINDA)"* do cabeçalho de `20260720160000_programs_constraints_finalize.sql` e substituir por uma nota de que foi aplicada em produção (data desconhecida, constatada em 2026-08-05). O aviso desatualizado é o que fez esta fase inteira parecer necessária.

A migration `20260720160000_..._finalize.sql` assume nomes de constraint pela convenção padrão do Postgres. O item 2 do diagnóstico da Fase 0 traz os **nomes reais**. Reescrever a migration substituindo os nomes assumidos pelos confirmados, mantendo todos os `IF EXISTS`.

Entregar ao humano com um roteiro explícito:
1. backup/snapshot do projeto Supabase antes de rodar
2. rodar dentro de uma transação (`BEGIN; ... ;` e conferir antes do `COMMIT`)
3. reexecutar o script de diagnóstico da Fase 0 e confirmar cenário A

### Tarefa 4.1 — Remover a coluna `completed` de `user_progress`

Depende da Fase 3.4 já estar em produção (nada escreve mais nessa coluna). Nova migration:

- confirmar que `completion_count` cobre todo mundo:
  `SELECT COUNT(*) FROM user_progress WHERE completed = true AND completion_count = 0;` → deve ser 0
- `ALTER TABLE public.user_progress DROP COLUMN completed;`
- remover `completed: boolean` de `UserProgress` em `src/types/index.ts`
- rodar `npm run check` — o compilador aponta qualquer uso restante

### Tarefa 4.2 — Limpar migrations obsoletas

O diretório mistura migrations versionadas por timestamp com arquivos soltos legados (`user_exercise_progress.sql`, `musa_schedule.sql`, `alter_day_number_30.sql`, `pdf_plans.sql`, `perf_indexes.sql`, etc.). Alguns nunca chegaram a rodar — o cabeçalho de `20260720128000_create_user_exercise_progress.sql` documenta que `user_exercise_progress.sql` usava `CREATE POLICY IF NOT EXISTS`, sintaxe inválida no Postgres, e falhou silenciosamente.

Ação: mover os arquivos sem timestamp para `supabase/migrations/_legacy/` com um `README.md` explicando que são registro histórico e **não devem ser executados**. Não deletar — servem de rastro da evolução do schema.

Também mover para `_legacy/` (ou marcar no cabeçalho como revertida) a `20260718090000_subscriptions.sql`, já anulada por `20260720120000_revert_mercadopago_billing.sql`. **Não deletar** — ela é a base da Fase 6.

**Critério de aceite:** diagnóstico da Fase 0 reexecutado retorna cenário A; `npm run check` limpo.

> ⛔ **CHECKPOINT 4**

---

## Fase 5 — Performance e consistência de UX

### Tarefa 5.1 — Eliminar o polling do Perfil

`src/pages/Profile.tsx:170` mantém `setInterval(() => load(), 30000)` rodando indefinidamente, refazendo `getUserProgress` a cada 30s mesmo sem nada mudar. Custo de requisições Supabase e de bateria em mobile.

Substituir por:
- recarregar no `visibilitychange` quando a aba volta a ficar visível (**manter** — esse listener já existe e é o comportamento correto)
- remover o `setInterval`
- recarregar ao navegar de volta de `WorkoutDay` após conclusão (o `navigate` de volta já remonta o componente; validar que `load()` roda no mount)

### Tarefa 5.2 — Substituir `alert()` por UI consistente

Seis ocorrências, num app que já tem `src/components/ui/Modal.tsx`:

| Arquivo | Linha | Contexto |
|---|---|---|
| `pages/admin/AdminWorkoutEdit.tsx` | 87, 89 | sucesso / erro ao salvar treino |
| `pages/Home.tsx` | 134, 161 | falha ao gerar signed URL de PDF |
| `pages/Profile.tsx` | 281 | detalhe de progresso |
| `pages/WorkoutDay.tsx` | 420 | vídeo indisponível |

Criar um componente leve de toast/inline-error em `src/components/ui/` e usar nos seis pontos. Erros de usuária final (Home, WorkoutDay) têm prioridade sobre os do admin.

### Tarefa 5.3 — Acessibilidade dos modais

`Modal.tsx`, o modal de PDF em `Home.tsx:188` e o de vídeo em `WorkoutDay.tsx:285` são `role="dialog" aria-modal="true"` mas não fecham com `Esc` nem prendem o foco. Adicionar em todos:

- listener de `Escape`
- focus trap básico (foco inicial no botão de fechar; `Tab` circula dentro do dialog)
- restaurar o foco ao elemento que abriu, ao fechar

### Tarefa 5.4 — Remover configuração fantasma do HIIT **e limpar o resíduo que ela deixou**

> 🔄 **Tarefa reescrita em 2026-08-04.** O texto original dizia que "nada em todo o código escreve essa chave". Na verdade existe código que escreve — `HIIT.tsx:89` e `HIIT.tsx:101` — mas ele está **dentro de um comentário JSX** que vai da linha 85 à 110 (a UI de "desvincular vídeo" / "restaurar link padrão", desativada em algum momento). Em tempo de execução, de fato nada escreve. A conclusão do plano estava certa; a evidência, não. E a diferença entre as duas esconde um bug ativo.

`src/pages/HIIT.tsx:14` lê `localStorage.getItem('musa_hiit_url')` e a linha 15 decide o vídeo assim:

```ts
const saved = localStorage.getItem('musa_hiit_url')
setVideoUrl((saved !== null ? saved : DEFAULT_URL) || '')
```

**O bug:** se a UI comentada esteve ativa em produção, qualquer usuária que clicou em "desvincular" tem `musa_hiit_url = ''` (string vazia) gravado no dispositivo. Nesse caso `saved !== null` é verdadeiro, então o valor usado é `''` — e não o `DEFAULT_URL`. Resultado: **a página de HIIT nunca carrega vídeo nenhum para essa usuária, de forma permanente**, e o botão "Restaurar link padrão" que consertaria isso está comentado junto. Falha silenciosa, sem caminho de recuperação pela interface.

Ações:

- remover a leitura do `localStorage` e usar `DEFAULT_URL` diretamente
- **deletar o bloco JSX comentado (linhas 85–110)** — é a origem da confusão e contém inclusive um placeholder não resolvido (`${__web_page_1__.unlinkText}`)
- adicionar limpeza one-shot `localStorage.removeItem('musa_hiit_url')` na inicialização, pelo mesmo motivo e no mesmo lugar da limpeza da Tarefa 3.1 — sem isso, o resíduo fica no dispositivo para sempre
- **verificar se o bug atingiu alguém**: não há telemetria dessa chave, então não dá para medir. Tratar a limpeza como obrigatória, não opcional

Se o vídeo de HIIT precisar ser editável no futuro, o lugar certo é a tabela `workouts`, não o localStorage de cada dispositivo.

**Critério de aceite:** nenhum `alert()` restante em `src/`; nenhum `setInterval` de polling; modais fecham com `Esc`; nenhuma leitura de `musa_hiit_url` e limpeza one-shot da chave em vigor; bloco JSX comentado de `HIIT.tsx` removido.

> ⛔ **CHECKPOINT 5**

---

## Fase 6 — Preparação do gate de conteúdo pago (**sem ativar**)

**Por quê:** hoje `workouts` tem policy `FOR SELECT USING (true)` e a chave anônima do Supabase está no bundle JavaScript por design. Qualquer pessoa lê todo o conteúdo de treino sem ter conta. Se o conteúdo é o produto, isso é vazamento total.

A infraestrutura existia em `20260718090000_subscriptions.sql` e foi revertida em `20260720120000_revert_mercadopago_billing.sql`.

> 🔒 **Escopo desta fase: deixar tudo pronto e NÃO ativar.** Nenhuma policy de produção muda. A decisão de modelo de cobrança ainda não foi tomada.

### Tarefa 6.1 — Documento de arquitetura de acesso

Criar `docs/access-gate-design.md` cobrindo:

- **estado atual** das policies de `workouts`, `user_progress`, `user_exercise_progress`, `pdf_plans` e do bucket de Storage (com base no item 3 do diagnóstico)
- **superfície exposta hoje**: o que exatamente vaza com a anon key em mãos
- **o que a migration revertida fazia**: tabela `subscriptions`, helper `has_active_subscription()`, e a armadilha já documentada nela — uma policy `USING(true)` deixada no lugar combina por OR e anula qualquer policy nova; a policy antiga precisa ser **substituída**, não complementada
- **modelos possíveis** (assinatura recorrente / compra única / trial por tempo), com o impacto de cada um no schema
- **ponto crítico não resolvido**: os PDFs de plano alimentar saem por signed URL do Storage (`src/utils/plans.ts`) — a policy do bucket precisa entrar no gate junto, senão o conteúdo escapa por ali

### Tarefa 6.2 — Introduzir `hasContentAccess()` no cliente

> ⚠️ **Ressalva de escopo (revisão 2026-08-04):** esta tarefa é a mais especulativa do plano inteiro. Ela adiciona indireção em cinco páginas para preparar uma decisão de negócio que **ainda não foi tomada** — e o próprio plano admite isso na abertura da fase. Se o modelo de cobrança mudar de forma (ou for descartado), o seam foi construído no lugar errado e vira código morto do tipo que a Fase 3 está removendo.
>
> A Tarefa 6.1 (o documento de análise) tem valor independente da decisão e deve ser feita. **Recomendação: adiar a 6.2 até que haja decisão de monetização.** Se for executada mesmo assim, tratá-la como reversível e manter o diff mínimo.

Criar `src/utils/access.ts` com uma única função que hoje **retorna `true` incondicionalmente**, e usá-la nos pontos de leitura de conteúdo (`ProgramDays`, `WorkoutDay`, `Home`, `HIIT`, `plans.ts`).

Objetivo: quando o gate for ativado, a mudança fica concentrada em um arquivo, em vez de espalhada por cinco páginas. Documentar isso no topo do arquivo, com aviso explícito de que **checagem no cliente não é segurança** — a fonte de verdade será a RLS.

### Tarefa 6.3 — Migration em rascunho, não aplicada

Criar `supabase/migrations/_draft/gate-conteudo.sql.draft` (extensão `.draft` para que nenhuma ferramenta a execute por acidente), derivada da `20260718090000` mas agnóstica de provedor de pagamento. Cabeçalho em caixa alta: **RASCUNHO — NÃO EXECUTAR — depende de decisão de produto sobre monetização.**

**Critério de aceite:** nenhuma policy de produção alterada; `hasContentAccess()` em uso e retornando `true`; comportamento do app idêntico ao anterior.

> ⛔ **CHECKPOINT 6**

---

## Fase 7 — Documentação e limpeza de branches

**Por quê:** documentação errada é pior que documentação ausente — leva a decisão errada com confiança.

### Tarefa 7.1 — Reescrever o `README.md`

Hoje é o template padrão do Vite, sem uma palavra sobre o MusaFit. Substituir por: o que é o produto, stack, como rodar local, variáveis de ambiente necessárias (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), como aplicar migrations, e como fazer deploy.

### Tarefa 7.2 — Atualizar o PRD

`.trae/documents/musa_fit_prd.md` descreve um desafio linear de 20 dias com timeline vertical. O produto atual é um catálogo de programas com treinos por dia da semana (1–7), onboarding com perfil, checklist por exercício, HIIT opcional, planos em PDF e painel admin. Reescrever para refletir o que existe. Manter a versão antiga como `musa_fit_prd_v1.md` — o histórico de pivô tem valor.

### Tarefa 7.3 — Corrigir `docs/cleanup_report.md`

Cita `getWorkoutByDay` (função inexistente) e índices em `day_number` (coluna que sai/saiu na finalize). Atualizar ou arquivar com aviso de obsolescência no topo.

### Tarefa 7.4 — Podar branches

Há 6 branches locais e 7 remotas, incluindo `feature/mercadopago-billing` (feature abandonada) e quatro `worktree-*` já mergeadas. Listar as candidatas a remoção com o status de merge de cada uma e **entregar a lista ao humano** — o agente não deleta branches remotas.

**Critério de aceite:** README descreve o projeto real; PRD bate com o comportamento do app; lista de branches entregue.

> ⛔ **CHECKPOINT 7**

---

## Fora de escopo (registrar, não executar)

- **`id` estável por exercício no JSONB** — solução definitiva para a fragilidade posicional da chave da Fase 2. Exige migração de dados e mudança no editor do admin.
- **Ativação do gate de pagamento** — depende de decisão de modelo de negócio.
- **Mover o repositório para fora do OneDrive** — decisão do humano.
- **`sex: 'feminino' | 'masculino'`** no schema e no onboarding contradiz o posicionamento de "plataforma de treino para mulheres". É decisão de produto, não bug.

---

## Ordem de execução resumida

> 🔄 **Revisada em 2026-08-04.** A ordem original tratava a Fase 1 como bloqueante de todo commit e a Fase 0 como bloqueante de tudo. Nenhuma das duas é. A Fase 0 bloqueia apenas a Fase 4 e a Tarefa 6.1; a Fase 1 não bloqueia nada.

A única dependência dura é o **diagnóstico do banco**, e ela tem latência humana (alguém precisa rodar SQL no Supabase e colar a saída). O caminho eficiente é disparar essa espera primeiro e trabalhar em paralelo enquanto ela não volta.

```
┌─ PRIMEIRO (destrava o resto) ───────────────────────────────┐
│ Fase 0.5  Consertar Dashboard.test.tsx   ← destrava Regra 3 │
│ Fase 0.1  Entregar SQL de diagnóstico    ← inicia a espera  │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
┌─ EM PARALELO (client-side) ──┐   ┌─ AGUARDA o humano ──────┐
│ Fase 2  Chave de exercício   │   │ CHECKPOINT 0            │
│ Fase 3  Código morto         │   │   ↓                     │
│ Fase 5  Performance e UX     │   │ Fase 4  Schema          │
│ Fase 1  .gitattributes       │   │ Fase 6.1  Doc de acesso │
│ Fase 7  Documentação         │   └─────────────────────────┘
└──────────────────────────────┘
                          │
                   Fase 6.2 (adiar — ver ressalva)
```

**Dependências reais, explicitadas:**

| Fase | Depende de | Motivo |
|---|---|---|
| 0.5 | — | e destrava a Regra 3 para todas as outras |
| 1, 2, 3, 5, 7 | 0.5 apenas | são client-side ou documentais |
| 4 | 0 (cenário confirmado) **e** 3.4 em produção | 4.1 só é segura depois que nada mais escreve `completed` |
| 6.1 | item 3 do diagnóstico da Fase 0 | precisa do inventário real de policies |
| 6.2 | decisão de monetização | **adiar** |

**Se houver tempo para apenas duas fases:** **0.5 e 2**. A 0.5 é barata e é o que faz o sinal de teste voltar a significar alguma coisa; a 2 é o único bug que corrompe dados de usuária de forma silenciosa. A Fase 1, que o plano original elegia como prioritária, é a de menor retorno das quatro — corrige um risco futuro, não um problema presente.
