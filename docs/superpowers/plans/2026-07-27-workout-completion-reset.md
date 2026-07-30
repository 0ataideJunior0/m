# Reset de Conclusão de Treino + Redesign do Card de Dia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Marcar um treino como concluído deve contar para um contador histórico permanente, mas devolver o dia (e o checklist de exercícios) ao estado "a fazer" imediatamente, para que a aluna possa refazer o mesmo treino. O card de cada dia em `ProgramDays.tsx` é redesenhado com os componentes de UI da fase 1 (`Card`, `Button`), sem o ✓ verde.

**Architecture:** `user_progress` ganha uma coluna `completion_count` (contador que só sobe). `markWorkoutComplete` incrementa esse contador mas grava `completed: false` sempre. `handleCompleteWorkout` em `WorkoutDay.tsx` também apaga as linhas de `user_exercise_progress` daquele treino (servidor) e limpa o cache local (localStorage) do checklist. Como `completed` nunca mais persiste como `true`, todo o conceito de "dia já concluído" (banner verde, ✓, texto "Ver Treino" condicional) é removido do código em vez de reimplementado.

**Tech Stack:** React 18 + TypeScript, Supabase (Postgres + supabase-js), Vitest + Testing Library.

## Global Constraints

- Coluna nova: `user_progress.completion_count integer not null default 0`.
- Backfill: contas com `completed = true` hoje recebem `completion_count = 1`.
- `markWorkoutComplete(userId, workoutId)` mantém a mesma assinatura e retorno (`Promise<boolean>`) — só muda o comportamento interno.
- Sem função Postgres/RPC para o incremento — leitura-depois-escrita via client Supabase, mesmo padrão já usado em todo o resto do código.
- Sem tabela de histórico/eventos — só o contador agregado por `(user_id, workout_id)`.
- Botão do dia no `ProgramDays.tsx` sempre com o texto "Ver Treino", nunca "Iniciar".

---

### Task 1: Migração do banco — coluna `completion_count`

**Files:**
- Create: `supabase/migrations/20260727090000_workout_completion_reset.sql`

**Interfaces:**
- Produces: coluna `user_progress.completion_count integer not null default 0`, consumida pela Task 2.

- [ ] **Step 1: Escrever a migração**

```sql
-- Reset de conclusão de treino: mantém um contador histórico permanente
-- (completion_count) em vez de um boolean travado — permite que a aluna
-- refaça o mesmo treino e marque o checklist de exercícios novamente.

ALTER TABLE public.user_progress
  ADD COLUMN completion_count INTEGER NOT NULL DEFAULT 0;

-- Preserva o número que já aparecia no "Treinos Concluídos" do Perfil
-- para quem já tinha treinos marcados como concluídos.
UPDATE public.user_progress
SET completion_count = 1
WHERE completed = true;
```

- [ ] **Step 2: Aplicar no Supabase e verificar**

Rodar (o `db push` deste projeto tem um bug de ambiente conhecido — usar `db query -f` como nas migrações anteriores):

```bash
supabase db query --linked -f supabase/migrations/20260727090000_workout_completion_reset.sql
supabase migration repair --status applied 20260727090000 --linked
```

Verificar:

```bash
supabase db query --linked "select completion_count, completed from user_progress where completed = true limit 5"
```

Esperado: todas as linhas retornadas têm `completion_count >= 1`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260727090000_workout_completion_reset.sql
git commit -m "feat: add completion_count column to user_progress"
```

---

### Task 2: `UserProgress` type + `markWorkoutComplete` reescrito

**Files:**
- Modify: `src/types/index.ts:18-30` (interface `UserProgress`)
- Modify: `src/utils/workouts.ts:118-135` (função `markWorkoutComplete`)
- Test: `src/__tests__/markWorkoutComplete.test.ts` (novo)

**Interfaces:**
- Consumes: coluna `completion_count` da Task 1.
- Produces: `UserProgress.completion_count: number`; `markWorkoutComplete(userId: string, workoutId: string): Promise<boolean>` (assinatura inalterada, comportamento novo — usado pela Task 5).

- [ ] **Step 1: Escrever o teste que falha**

```typescript
// src/__tests__/markWorkoutComplete.test.ts
import { describe, it, expect, vi } from 'vitest'

const { maybeSingleMock, eqMock2, eqMock1, selectMock, upsertMock, fromMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const eqMock2 = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
  const eqMock1 = vi.fn(() => ({ eq: eqMock2 }))
  const selectMock = vi.fn(() => ({ eq: eqMock1 }))
  const upsertMock = vi.fn()
  const fromMock = vi.fn(() => ({ select: selectMock, upsert: upsertMock }))
  return { maybeSingleMock, eqMock2, eqMock1, selectMock, upsertMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { markWorkoutComplete } from '../utils/workouts'

describe('markWorkoutComplete', () => {
  it('começa o contador em 1 na primeira conclusão e grava completed=false', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    upsertMock.mockResolvedValueOnce({ error: null })

    const result = await markWorkoutComplete('u1', 'w1')

    expect(result).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('user_progress')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        workout_id: 'w1',
        completed: false,
        completion_count: 1,
      }),
      { onConflict: 'user_id,workout_id' }
    )
  })

  it('incrementa a partir de um completion_count existente', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { completion_count: 3 }, error: null })
    upsertMock.mockResolvedValueOnce({ error: null })

    await markWorkoutComplete('u1', 'w1')

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ completion_count: 4, completed: false }),
      { onConflict: 'user_id,workout_id' }
    )
  })

  it('retorna false quando o upsert falha', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    upsertMock.mockResolvedValueOnce({ error: new Error('boom') })

    const result = await markWorkoutComplete('u1', 'w1')
    expect(result).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/markWorkoutComplete.test.ts`
Expected: FAIL — `markWorkoutComplete` ainda faz upsert com `completed: true` e sem `completion_count`, então os `expect.objectContaining` não batem.

- [ ] **Step 3: Atualizar o tipo `UserProgress`**

Em `src/types/index.ts`, dentro da interface `UserProgress` (linhas 18-30), adicionar o campo depois de `completed`:

```typescript
export interface UserProgress {
  id: string
  user_id: string
  workout_id: string
  completed: boolean
  completion_count: number
  completed_at: string | null
  created_at: string
  workout?: {
    title: string
    weekday: number
    program_id: string
  } | null
}
```

- [ ] **Step 4: Reescrever `markWorkoutComplete`**

Em `src/utils/workouts.ts`, substituir a função inteira (linhas 118-135):

```typescript
export const markWorkoutComplete = async (userId: string, workoutId: string): Promise<boolean> => {
  try {
    const { data: existing } = await supabase
      .from('user_progress')
      .select('completion_count')
      .eq('user_id', userId)
      .eq('workout_id', workoutId)
      .maybeSingle()

    const nextCount = (existing?.completion_count || 0) + 1

    const { error } = await supabase
      .from('user_progress')
      .upsert({
        user_id: userId,
        workout_id: workoutId,
        completed: false,
        completed_at: new Date().toISOString(),
        completion_count: nextCount,
      }, { onConflict: 'user_id,workout_id' })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error marking workout complete:', error)
    return false
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/markWorkoutComplete.test.ts`
Expected: PASS (3 testes).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/utils/workouts.ts src/__tests__/markWorkoutComplete.test.ts
git commit -m "feat: markWorkoutComplete tracks a permanent completion_count, resets completed"
```

---

### Task 3: `resetExerciseProgress` — apaga o checklist no servidor

**Files:**
- Modify: `src/utils/exerciseProgressRemote.ts`
- Test: `src/__tests__/exerciseProgressRemote.test.ts` (novo)

**Interfaces:**
- Produces: `resetExerciseProgress(userId: string, workoutId: string): Promise<void>` — usado pela Task 5.

- [ ] **Step 1: Escrever o teste que falha**

```typescript
// src/__tests__/exerciseProgressRemote.test.ts
import { describe, it, expect, vi } from 'vitest'

const { eqMock2, eqMock1, deleteMock, fromMock } = vi.hoisted(() => {
  const eqMock2 = vi.fn()
  const eqMock1 = vi.fn(() => ({ eq: eqMock2 }))
  const deleteMock = vi.fn(() => ({ eq: eqMock1 }))
  const fromMock = vi.fn(() => ({ delete: deleteMock }))
  return { eqMock2, eqMock1, deleteMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { resetExerciseProgress } from '../utils/exerciseProgressRemote'

describe('resetExerciseProgress', () => {
  it('apaga as linhas de user_exercise_progress daquele treino e usuária', async () => {
    eqMock2.mockResolvedValueOnce({ error: null })

    await resetExerciseProgress('u1', 'w1')

    expect(fromMock).toHaveBeenCalledWith('user_exercise_progress')
    expect(deleteMock).toHaveBeenCalled()
    expect(eqMock1).toHaveBeenCalledWith('user_id', 'u1')
    expect(eqMock2).toHaveBeenCalledWith('workout_id', 'w1')
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/exerciseProgressRemote.test.ts`
Expected: FAIL — `resetExerciseProgress` não existe em `../utils/exerciseProgressRemote`.

- [ ] **Step 3: Implementar `resetExerciseProgress`**

Em `src/utils/exerciseProgressRemote.ts`, adicionar ao final do arquivo:

```typescript
export async function resetExerciseProgress(userId: string, workoutId: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('user_exercise_progress')
      .delete()
      .eq('user_id', userId)
      .eq('workout_id', workoutId)
    if (error) throw error
  } catch (error) {
    console.error('Error resetting exercise progress:', error)
  }
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/exerciseProgressRemote.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exerciseProgressRemote.ts src/__tests__/exerciseProgressRemote.test.ts
git commit -m "feat: add resetExerciseProgress to clear a workout's checklist"
```

---

### Task 4: `clearLocalProgress` — limpa o cache local do checklist

**Files:**
- Modify: `src/utils/exerciseProgress.ts`
- Modify: `src/__tests__/exerciseProgress.test.ts`

**Interfaces:**
- Consumes: `LS_PREFIX` (já existe em `exerciseProgress.ts`), `loadLocalProgress`/`saveLocalProgress` (já existem, mesmo arquivo).
- Produces: `clearLocalProgress(userId: string, workoutId: string): void` — usado pela Task 5.

- [ ] **Step 1: Escrever o teste que falha**

Em `src/__tests__/exerciseProgress.test.ts`, trocar a linha de import (linha 3) para incluir as novas funções, e adicionar um novo `describe` no final do arquivo:

```typescript
import { mergeServerLocal, loadLocalProgress, saveLocalProgress, clearLocalProgress } from '../utils/exerciseProgress'
```

```typescript
describe('clearLocalProgress', () => {
  it('remove o progresso salvo daquela usuária e treino', () => {
    saveLocalProgress('u1', 'w1', { 'ex-1': { completed: true, ts: 1 } })
    expect(loadLocalProgress('u1', 'w1')).toEqual({ 'ex-1': { completed: true, ts: 1 } })

    clearLocalProgress('u1', 'w1')

    expect(loadLocalProgress('u1', 'w1')).toEqual({})
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/__tests__/exerciseProgress.test.ts`
Expected: FAIL — `clearLocalProgress` não existe em `../utils/exerciseProgress`.

- [ ] **Step 3: Implementar `clearLocalProgress`**

Em `src/utils/exerciseProgress.ts`, adicionar depois de `saveLocalProgress` (depois da linha 20):

```typescript
export function clearLocalProgress(userId: string, workoutId: string) {
  const key = `${LS_PREFIX}${userId}:${workoutId}`
  try {
    localStorage.removeItem(key)
  } catch {}
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/__tests__/exerciseProgress.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo os já existentes).

- [ ] **Step 5: Commit**

```bash
git add src/utils/exerciseProgress.ts src/__tests__/exerciseProgress.test.ts
git commit -m "feat: add clearLocalProgress to reset a workout's local checklist cache"
```

---

### Task 5: `WorkoutDay.tsx` — sempre refazível, sem faixa "concluído"

**Files:**
- Modify: `src/pages/WorkoutDay.tsx`

**Interfaces:**
- Consumes: `markWorkoutComplete` (Task 2), `resetExerciseProgress` (Task 3), `clearLocalProgress` (Task 4).
- Produces: nenhuma nova interface — página final consumida pelo roteamento existente (`App.tsx`, inalterado).

- [ ] **Step 1: Atualizar os imports**

Linha 4 — remover `getUserProgress`:
```typescript
import { getProgramBySlug, getWorkoutByProgramAndWeekday, markWorkoutComplete } from '../utils/workouts'
```

Linha 5 — remover o tipo `UserProgress` (não é mais usado no arquivo):
```typescript
import { Workout as WorkoutType, Program } from '../types'
```

Linha 9 — adicionar `clearLocalProgress`:
```typescript
import { loadLocalProgress, saveLocalProgress, mergeServerLocal, clearLocalProgress } from '../utils/exerciseProgress'
```

Linha 10 — adicionar `resetExerciseProgress`:
```typescript
import { fetchExerciseProgress, upsertExerciseProgress, resetExerciseProgress } from '../utils/exerciseProgressRemote'
```

- [ ] **Step 2: Remover o estado `progress` e o fetch de `getUserProgress`**

Linha 21 — remover a linha inteira `const [progress, setProgress] = useState<UserProgress[]>([])`.

Dentro de `loadWorkoutAndProgress` (linhas 42-67), trocar:

```typescript
      const [workoutData, userProgress] = await Promise.all([
        getWorkoutByProgramAndWeekday(prog.id, weekdayNumber),
        getUserProgress(user.id)
      ])

      setWorkout(workoutData)
      setProgress(userProgress)
```

por:

```typescript
      const workoutData = await getWorkoutByProgramAndWeekday(prog.id, weekdayNumber)

      setWorkout(workoutData)
```

- [ ] **Step 3: Reescrever `handleCompleteWorkout` e remover `isDayCompleted`**

Substituir o bloco atual (linhas 91-107, da declaração de `handleCompleteWorkout` até a linha de `isDayCompleted`):

```typescript
  const handleCompleteWorkout = async () => {
    if (!user || !workout || !slug) return

    setCompleting(true)
    try {
      const success = await markWorkoutComplete(user.id, workout.id)
      if (success) {
        navigate(`/program/${slug}`)
      }
    } catch (error) {
      console.error('Error completing workout:', error)
    } finally {
      setCompleting(false)
    }
  }

  const isDayCompleted = progress.some(p => p.workout_id === workout?.id && p.completed)
```

por:

```typescript
  const handleCompleteWorkout = async () => {
    if (!user || !workout || !slug) return

    setCompleting(true)
    try {
      const success = await markWorkoutComplete(user.id, workout.id)
      if (success) {
        await resetExerciseProgress(user.id, workout.id)
        clearLocalProgress(user.id, workout.id)
        navigate(`/program/${slug}`)
      }
    } catch (error) {
      console.error('Error completing workout:', error)
    } finally {
      setCompleting(false)
    }
  }
```

- [ ] **Step 4: Sempre mostrar o botão de concluir, remover a faixa verde**

Substituir o bloco (linhas 331-363 do arquivo atual — comentário `{/* Complete Button */}` até o fechamento do segundo `{isDayCompleted && (...)}`):

```typescript
        {/* Complete Button */}
        {!isDayCompleted && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto">
              <button
                onClick={handleCompleteWorkout}
                disabled={completing}
                className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-lg flex items-center justify-center"
              >
                {completing ? (
                  'Marcando...'
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    Marcar como Concluído
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {isDayCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Check className="w-6 h-6 text-green-600 mr-2" />
              <span className="text-green-800 font-medium">Treino concluído!</span>
            </div>
            <p className="text-green-600 text-sm">
              Parabéns! Você completou o treino de {weekdayLabel}.
            </p>
          </div>
        )}
```

por:

```typescript
        {/* Complete Button */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-4xl mx-auto">
            <button
              onClick={handleCompleteWorkout}
              disabled={completing}
              className="w-full bg-purple-600 text-white py-4 px-6 rounded-lg hover:bg-purple-700 focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium text-lg flex items-center justify-center"
            >
              {completing ? (
                'Marcando...'
              ) : (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  Marcar como Concluído
                </>
              )}
            </button>
          </div>
        </div>
```

- [ ] **Step 5: Verificar tipos e build**

Run: `npx tsc -b --noEmit`
Expected: sem erros (confirma que `progress`/`UserProgress`/`getUserProgress`/`isDayCompleted` não sobraram referenciados em nenhum lugar do arquivo).

- [ ] **Step 6: Rodar a suíte de testes**

Run: `npx vitest run src/__tests__/WorkoutDay.test.tsx`
Expected: o mesmo resultado de antes da mudança (esse arquivo já falha hoje por um problema pré-existente não relacionado — `toBeInTheDocument` sem `jest-dom` — confirmar que a falha é exatamente essa mesma, não uma nova).

- [ ] **Step 7: Commit**

```bash
git add src/pages/WorkoutDay.tsx
git commit -m "feat: WorkoutDay always redoable, drop isDayCompleted banner"
```

---

### Task 6: `ProgramDays.tsx` — redesenho do card com `Card`/`Button`

**Files:**
- Modify: `src/pages/ProgramDays.tsx`

**Interfaces:**
- Consumes: `Card` (`src/components/ui/Card.tsx`: props `{ padding?: 'sm'|'md'|'lg', className?, children, ...HTMLAttributes<HTMLDivElement> }`), `Button` (`src/components/ui/Button.tsx`: props `{ variant?: 'primary'|'secondary'|'danger', size?: 'sm'|'md'|'lg'|'icon', isLoading?, className?, children, ...ButtonHTMLAttributes }`).

- [ ] **Step 1: Atualizar os imports**

Linha 4 — remover `getUserProgress` (não é mais necessário buscar progresso pra desenhar o card):
```typescript
import { getProgramBySlug, getWorkoutsForProgram } from '../utils/workouts'
```

Linha 5 — remover o tipo `UserProgress`:
```typescript
import { Program, Workout } from '../types'
```

Linha 6 — trocar `Check, Circle, ArrowLeft` por só `ArrowLeft`, e adicionar os imports dos componentes de UI:
```typescript
import { ArrowLeft } from 'lucide-react'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
```

- [ ] **Step 2: Remover o estado e o fetch de `progress`**

Linha 17 — remover `const [progress, setProgress] = useState<UserProgress[]>([])`.

Dentro de `load` (linhas 29-48), trocar:

```typescript
      const [workoutsData, userProgress] = await Promise.all([
        getWorkoutsForProgram(prog.id),
        getUserProgress(user.id),
      ])
      setWorkouts(workoutsData)
      setProgress(userProgress)
```

por:

```typescript
      const workoutsData = await getWorkoutsForProgram(prog.id)
      setWorkouts(workoutsData)
```

- [ ] **Step 3: Simplificar o cálculo de `days`**

Trocar (linhas 77-82):

```typescript
  const days = Array.from({ length: 7 }, (_, i) => {
    const weekdayNumber = i + 1
    const workout = workouts.find(w => w.weekday === weekdayNumber) || null
    const completed = !!workout && progress.some(p => p.workout_id === workout.id && p.completed)
    return { weekdayNumber, workout, completed }
  })
```

por:

```typescript
  const days = Array.from({ length: 7 }, (_, i) => {
    const weekdayNumber = i + 1
    const workout = workouts.find(w => w.weekday === weekdayNumber) || null
    return { weekdayNumber, workout }
  })
```

- [ ] **Step 4: Redesenhar o card de cada dia**

Trocar o bloco inteiro (linhas 101-143, do `<div className="bg-white rounded-2xl shadow-lg p-6">` até o fechamento correspondente):

```typescript
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="space-y-4">
            {days.map((day) => (
              <div key={day.weekdayNumber} className="flex items-center">
                <div className="flex items-center justify-center w-12 h-12 rounded-full border-2 mr-4">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center ${
                    day.completed ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'
                  }`}>
                    {day.completed ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`font-medium ${day.completed ? 'text-green-700' : day.workout ? 'text-gray-900' : 'text-gray-400'}`}>
                        {WEEKDAY_NAMES[day.weekdayNumber - 1]}
                      </h4>
                      <p className={`text-sm ${day.completed ? 'text-green-600' : day.workout ? 'text-gray-600' : 'text-gray-400'}`}>
                        {day.workout ? day.workout.title : 'Em breve'}
                      </p>
                    </div>
                    {day.workout && (
                      <button
                        onClick={() => navigate(`/program/${slug}/day/${day.weekdayNumber}`)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                          day.completed
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        }`}
                      >
                        {day.completed ? 'Ver Treino' : 'Iniciar'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
```

por:

```typescript
        <div className="space-y-4">
          {days.map((day) => (
            <Card key={day.weekdayNumber}>
              <h4 className="font-bold text-gray-900 dark:text-text">
                {WEEKDAY_NAMES[day.weekdayNumber - 1]}
              </h4>
              <p className="text-sm text-gray-600 dark:text-text-muted mb-4">
                {day.workout ? day.workout.title : 'Em breve'}
              </p>
              {day.workout && (
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => navigate(`/program/${slug}/day/${day.weekdayNumber}`)}
                >
                  Ver Treino
                </Button>
              )}
            </Card>
          ))}
        </div>
```

- [ ] **Step 5: Verificar tipos**

Run: `npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 6: Verificação manual**

Rodar `npm run dev`, abrir `/program/avancado`, confirmar visualmente: 7 cards, sem ✓, cada um com dia da semana + nome do treino + botão "Ver Treino" (ou "Em breve" sem botão pro Iniciante vazio), layout de coluna única ocupando a largura toda (mobile-first).

- [ ] **Step 7: Commit**

```bash
git add src/pages/ProgramDays.tsx
git commit -m "feat: redesign ProgramDays day card with Card/Button, drop checkmark"
```

---

### Task 7: `Profile.tsx` — "Treinos Concluídos" soma o histórico

**Files:**
- Modify: `src/pages/Profile.tsx:145`

**Interfaces:**
- Consumes: `UserProgress.completion_count` (Task 2).

- [ ] **Step 1: Atualizar o cálculo de `completedDays`**

Trocar (linha 145):

```typescript
  const completedDays = progress.filter(p => p.completed).length
```

por:

```typescript
  const completedDays = progress.reduce((sum, p) => sum + (p.completion_count || 0), 0)
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação manual**

No Perfil, conferir que "Treinos Concluídos" mostra o total esperado (some `completion_count` de todos os treinos daquela conta) e que os cards de "Conquistas" continuam calculando a porcentagem certa a partir desse número.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Profile.tsx
git commit -m "feat: Treinos Concluidos sums completion_count instead of a boolean flag"
```

---

### Task 8: Verificação final

**Files:** nenhum (só verificação).

- [ ] **Step 1: Typecheck completo**

Run: `npx tsc -b --noEmit`
Expected: sem erros.

- [ ] **Step 2: Build de produção**

Run: `npm run build`
Expected: build conclui sem erros.

- [ ] **Step 3: Suíte de testes completa**

Run: `npx vitest run`
Expected: mesma baseline de falhas pré-existentes de sempre (`Dashboard.test.tsx`, `WorkoutDay.test.tsx` — não relacionadas a esta mudança), todos os testes novos (`markWorkoutComplete.test.ts`, `exerciseProgressRemote.test.ts`, os novos casos em `exerciseProgress.test.ts`) passando.

- [ ] **Step 4: Fluxo manual ponta a ponta**

Rodar `npm run dev`, logar, abrir um treino, marcar alguns exercícios do checklist, clicar em "Marcar como Concluído":
- Confirmar que volta pra `/program/:slug` sem erro.
- Reabrir o mesmo dia: checklist deve estar todo desmarcado, botão "Marcar como Concluído" deve estar visível (sem faixa verde).
- No Perfil, "Treinos Concluídos" deve ter subido em 1.
- Marcar o mesmo treino de novo — "Treinos Concluídos" deve subir mais uma vez (confirma que dá pra repetir).

- [ ] **Step 5: Commit final (se sobrar algo)**

Só se algum ajuste de última hora não tiver sido commitado ainda nas tasks anteriores.
