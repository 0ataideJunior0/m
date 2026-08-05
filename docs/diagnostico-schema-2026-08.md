# Diagnóstico do schema real — 2026-08-05

**Fase 0, Tarefa 0.2** do [PLANO-CORRECOES.md](PLANO-CORRECOES.md)
**Fonte:** [`supabase/diagnostics/00-schema-atual.sql`](../supabase/diagnostics/00-schema-atual.sql)
**Como foi executado:** via MCP Supabase em modo `--read-only`, contra o projeto `xgwigtsxkqwdvndxyupz`. Nenhum DDL/DML foi emitido.

---

## Veredito: **CENÁRIO A — a finalize já foi aplicada**

> A migration `20260720160000_programs_constraints_finalize.sql`, marcada no cabeçalho como *"Passo 4/4 (finalização — NÃO RODAR AINDA)"*, **já está em produção**. O arquivo nunca teve o aviso removido, o que fez parecer pendente.

Os dois sinais definidos na tabela de cenários do plano:

| Sinal esperado no cenário A | Resultado |
|---|---|
| `day_number` ausente nas 3 tabelas | ✅ ausente em `workouts`, `user_progress` e `user_exercise_progress` |
| `workouts_program_weekday_unique` existe | ✅ `UNIQUE (program_id, weekday)` |

E as contagens de integridade, todas zero — o que descarta o cenário C:

| Verificação | Resultado |
|---|---|
| `workouts` sem `program_id` | 0 |
| `workouts` sem `weekday` | 0 |
| `user_progress` sem `workout_id` | 0 |
| `user_exercise_progress` sem `workout_id` | 0 |
| `user_progress` sem `user_id` | 0 |

**Consequência:** a **Tarefa 4.0 não precisa ser executada** — ela existia só para o cenário B. A Fase 4 fica reduzida a 4.1 (drop de `completed`) e 4.2 (organizar migrations).

---

## Estado das tabelas

### `workouts` — 8 linhas
`id`, `title`, `exercises` (jsonb), `video_url`, `created_at`, `program_id` (**NOT NULL**), `weekday` (**NOT NULL**)

- `workouts_program_weekday_unique` — UNIQUE (program_id, weekday)
- `workouts_weekday_check` — CHECK (weekday BETWEEN 1 AND 7)
- `workouts_program_id_fkey` — FK → `programs` ON DELETE CASCADE

### `user_progress` — 105 linhas
`id`, `user_id` (nullable), `completed` (bool, nullable), `completed_at`, `created_at`, `workout_id` (**NOT NULL**), `completion_count` (**NOT NULL**, int)

- `user_progress_user_workout_unique` — UNIQUE (user_id, workout_id)
- FKs para `auth.users` e `workouts`, ambas ON DELETE CASCADE
- A coluna `completed` **ainda existe** — é o alvo da Tarefa 4.1

### `user_exercise_progress` — 8 linhas
`id`, `user_id` (**NOT NULL**), `exercise_key` (**NOT NULL**), `completed`, `completed_at`, `updated_at`, `created_at`, `workout_id` (**NOT NULL**)

- `user_ex_progress_unique` — UNIQUE (user_id, workout_id, exercise_key)
  → **é este índice que consolida silenciosamente as chaves colididas descritas na Fase 2**

### Escala geral

| Métrica | Valor |
|---|---|
| Usuárias (`profiles`) | 20 |
| Treinos | 8 |
| Linhas de progresso | 105 |
| Linhas de checklist | **8** |
| Tabelas `*_archive_20260720` | 5 |

---

## Impacto nas fases seguintes

### Fase 2.4 — o `DELETE` é seguro, e menos necessário do que parecia

O plano mandava confirmar o volume antes de descartar `user_exercise_progress`, e **escalar ao humano se fosse materialmente alto**. São **8 linhas**, distribuídas entre 20 usuárias. Não é materialmente alto. ✅ **Autorizado a seguir sem escalar.**

Há ainda um detalhe que reduz o risco a praticamente zero: o formato antigo de chave (`agachamento-sumo`) e o novo (`0-agachamento-sumo`) **nunca colidem entre si** — o novo sempre começa com dígito + hífen. Linhas antigas não passam a apontar para o exercício errado; elas simplesmente deixam de ser lidas.

Ou seja: o `DELETE` é **higiene, não correção**. Com ou sem ele, o comportamento visível para a usuária é o mesmo (o checklist do treino em andamento aparece desmarcado). Mantê-lo no plano continua certo — só não é uma operação delicada.

### Fase 4.1 — pré-condição já satisfeita

```
SELECT COUNT(*) FROM user_progress WHERE completed = true AND completion_count = 0;
→ 0
```

`completion_count` já cobre todo o histórico. O `DROP COLUMN completed` não perde informação. **Continua dependendo da Fase 3.4 estar em produção** (nada pode estar escrevendo a coluna no momento do drop).

### Fase 6.1 — premissa confirmada, e o vazamento é maior que o descrito

Três tabelas com `SELECT ... USING (true)`, legíveis por qualquer um de posse da anon key (que está no bundle por design):

| Tabela | Policy | O que vaza |
|---|---|---|
| `workouts` | `Anyone can view workouts` | **todo o conteúdo de treino**, incluindo o JSONB de exercícios |
| `programs` | `Anyone can view programs` | catálogo de programas |
| `pdf_plans` | `Anyone can view pdf_plans` | metadados dos planos alimentares |

O plano citava `workouts`. `pdf_plans` também está aberta — coerente com o alerta da Tarefa 6.1 de que os PDFs precisam entrar no gate junto.

Os dados **de usuária** estão corretamente isolados: `user_progress`, `user_exercise_progress` e `profiles` restringem por `auth.uid() = user_id`, com `is_admin()` como exceção deliberada.

---

## Achados novos

Registrados em [ACHADOS-EXTRAS.md](ACHADOS-EXTRAS.md) como A-5 a A-8. Resumo:

- **A-5** — índice `idx_workouts_program_weekday` é redundante com `workouts_program_weekday_unique`
- **A-6** — `is_admin()` e `handle_new_user()` são `SECURITY DEFINER` chamáveis via RPC pelo papel `anon`
- **A-7** — proteção contra senhas vazadas está desligada no Supabase Auth
- **A-8** — `workouts` não tem policy de `DELETE` (hoje inofensivo: o admin não deleta treinos)

Nenhum deles bloqueia qualquer fase.

---

## Reexecutar

Com o MCP conectado, basta pedir ao agente. Sem MCP, rodar os blocos de `00-schema-atual.sql` no SQL Editor. Vale reexecutar após a Fase 4 para confirmar que o estado continua sendo o A.
