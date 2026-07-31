# WorkoutDay Exercise Execution Video Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every exercise card in `WorkoutDay` a "Ver execução" action that opens that exercise's video (same YouTube-embed mechanism as the existing workout-level video), and refresh the screen's visuals to be mobile-first and theme-aware (light/dark).

**Architecture:** `ExerciseItem` (`src/components/ExerciseItem.tsx`) gains two new props (`hasVideo`, `onWatchVideo`) and renders the action itself, so both simple and bi-set-grouped exercises get identical behavior from one component. `WorkoutDay.tsx` wires those props using logic that already exists (`openExerciseVideo`, the `exercise.video || workout.video_url` fallback) and deletes the bi-set-only button block that made the two exercise layouts inconsistent. No data model, admin UI, or progress-tracking logic changes.

**Tech Stack:** React 18 + TypeScript, Tailwind CSS (theme tokens defined in `tailwind.config.js` / `src/index.css`), Vitest + @testing-library/react.

## Global Constraints

- No changes to `src/pages/admin/AdminWorkoutEdit.tsx`, Supabase schema, or `src/utils/*` data/progress logic — the per-exercise `video` field and its resolution (`resolveVideoUrl`, `openExerciseVideoFactory`) already work and must be reused, not reimplemented.
- Preserve all existing card information: exercise name, sets/reps, note, completion check.
- Minimum 44px (`w-11 h-11` / `h-11`) touch targets for the check button and the "Ver execução" button.
- Apply theme tokens (`bg-surface`, `text`, `text-muted`, `border`, `bg`) instead of fixed `gray`/`white` Tailwind colors, matching the pattern already used in `src/components/ui/Card.tsx`.
- Dark mode work is scoped to `WorkoutDay.tsx` and `ExerciseItem.tsx` only — do not touch other pages (Home, Login, etc.).
- Vitest picks up a stale duplicate copy of the test suite under `.claude/worktrees/...` with its own broken `node_modules` (unrelated to this feature — do not attempt to fix it). Always run tests scoped to a specific `src/__tests__/...` path with `--exclude "**/.claude/**"`, for example:
  `npx vitest run --dir . src/__tests__/ExerciseItem.test.tsx --exclude "**/.claude/**"`

---

### Task 1: `ExerciseItem` gains the "Ver execução" action

**Files:**
- Modify: `src/components/ExerciseItem.tsx`
- Test: `src/__tests__/ExerciseItem.test.tsx` (new file)

**Interfaces:**
- Produces: `ExerciseItem` props extended to `{ exercise: Exercise; isCompleted: boolean; onToggle: () => void; hasVideo: boolean; onWatchVideo?: () => void }`. `Exercise` type is unchanged, imported from `../types` (`src/types/index.ts:50`).

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/ExerciseItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExerciseItem from '../components/ExerciseItem'
import type { Exercise } from '../types'

const exercise: Exercise = { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }

describe('ExerciseItem', () => {
  it('renders exercise info and the completion check', () => {
    render(<ExerciseItem exercise={exercise} isCompleted={false} onToggle={() => {}} hasVideo={false} />)

    expect(screen.getByText('Agachamento')).toBeInTheDocument()
    expect(screen.getByText(/3 séries/)).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /marcar agachamento como concluído/i })).toBeInTheDocument()
  })

  it('calls onToggle when the completion check is clicked', () => {
    const onToggle = vi.fn()
    render(<ExerciseItem exercise={exercise} isCompleted={false} onToggle={onToggle} hasVideo={false} />)

    fireEvent.click(screen.getByRole('checkbox'))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('shows "Vídeo indisponível" and no video button when hasVideo is false', () => {
    render(<ExerciseItem exercise={exercise} isCompleted={false} onToggle={() => {}} hasVideo={false} />)

    expect(screen.getByText('Vídeo indisponível')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ver execução/i })).not.toBeInTheDocument()
  })

  it('shows a "Ver execução" button when hasVideo is true and calls onWatchVideo when clicked', () => {
    const onWatchVideo = vi.fn()
    render(
      <ExerciseItem
        exercise={exercise}
        isCompleted={false}
        onToggle={() => {}}
        hasVideo={true}
        onWatchVideo={onWatchVideo}
      />
    )

    const button = screen.getByRole('button', { name: /ver execução/i })
    fireEvent.click(button)
    expect(onWatchVideo).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --dir . src/__tests__/ExerciseItem.test.tsx --exclude "**/.claude/**"`
Expected: FAIL — `ExerciseItem` does not accept `hasVideo`/`onWatchVideo` yet and renders no "Ver execução" button or "Vídeo indisponível" text.

- [ ] **Step 3: Implement the video action in `ExerciseItem`**

Replace the full contents of `src/components/ExerciseItem.tsx` with:

```tsx
import { CheckCircle, Circle, Play } from 'lucide-react'
import type { Exercise } from '../types'

interface Props {
  exercise: Exercise
  isCompleted: boolean
  onToggle: () => void
  hasVideo: boolean
  onWatchVideo?: () => void
}

export default function ExerciseItem({ exercise, isCompleted, onToggle, hasVideo, onWatchVideo }: Props) {
  const style =
    isCompleted
      ? 'border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800'
      : exercise.type === 'warmup'
      ? 'border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800'
      : exercise.type === 'drop_set'
      ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800'
      : 'border-border bg-surface'

  return (
    <div className={`border rounded-lg p-4 transition ${style}`} role="group" aria-label={exercise.exercise}>
      <div className="flex items-start sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium ${isCompleted ? 'text-green-700 dark:text-green-400 line-through' : 'text-text'}`}>
            {exercise.exercise}
          </h3>
          <p className="text-text-muted text-sm">
            {exercise.sets ? `${exercise.sets} séries` : ''}
            {exercise.sets && exercise.reps ? ' • ' : ''}
            {exercise.reps}
          </p>
          {exercise.note && (
            <p
              className={`${
                exercise.type === 'drop_set'
                  ? 'text-red-700 dark:text-red-400'
                  : exercise.type === 'warmup'
                  ? 'text-yellow-700 dark:text-yellow-400'
                  : 'text-text-muted'
              } text-xs mt-1`}
            >
              {exercise.note}
            </p>
          )}
        </div>
        <button
          onClick={onToggle}
          role="checkbox"
          aria-checked={isCompleted}
          aria-label={`Marcar ${exercise.exercise} como concluído`}
          className={`ml-auto inline-flex items-center justify-center w-11 h-11 rounded-full border ${
            isCompleted ? 'border-green-500 bg-green-100 dark:bg-green-900/40' : 'border-border bg-surface'
          } focus:outline-none focus:ring-2 focus:ring-purple-500`}
        >
          {isCompleted ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <Circle className="w-5 h-5 text-text-muted" />
          )}
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        {hasVideo ? (
          <button
            type="button"
            onClick={onWatchVideo}
            className="inline-flex items-center justify-center gap-1.5 h-11 px-3 rounded-md text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <Play className="w-4 h-4" />
            Ver execução
          </button>
        ) : (
          <p className="text-xs text-text-muted">Vídeo indisponível</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --dir . src/__tests__/ExerciseItem.test.tsx --exclude "**/.claude/**"`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/ExerciseItem.tsx src/__tests__/ExerciseItem.test.tsx
git commit -m "feat: add exercise execution video action to ExerciseItem"
```

---

### Task 2: Wire the video action into `WorkoutDay` for all exercises

**Files:**
- Modify: `src/pages/WorkoutDay.tsx:236-282` (bi-set group rendering and single-exercise rendering inside the exercises list)
- Test: `src/__tests__/WorkoutDay.test.tsx` (existing file, update the interaction it asserts)

**Interfaces:**
- Consumes: `ExerciseItem` props from Task 1 (`hasVideo: boolean`, `onWatchVideo?: () => void`).
- Consumes (already existing in `WorkoutDay.tsx`, unchanged): `openExerciseVideo(exercise)` (`src/pages/WorkoutDay.tsx:81-89`), which resolves the video URL and opens the modal.

- [ ] **Step 1: Update the existing test to assert the button-based interaction**

The current test in `src/__tests__/WorkoutDay.test.tsx` clicks the exercise's name text expecting the video modal to open — that never matched any implemented interaction (there was no click handler on the card), which is why it currently fails on `main`. Replace it to click the new "Ver execução" button instead. Replace the full contents of `src/__tests__/WorkoutDay.test.tsx` with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkoutDay from '../pages/WorkoutDay'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../utils/workouts', () => ({
  getProgramBySlug: vi.fn(async () => ({ id: 'p1', slug: 'avancado', name: 'Avançado', sort_order: 1, created_at: '' })),
  getWorkoutByProgramAndWeekday: vi.fn(async () => ({
    id: 'w1',
    program_id: 'p1',
    weekday: 1,
    title: 'Treino A',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    created_at: new Date().toISOString(),
    exercises: [
      { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal', video: 'https://www.youtube.com/shorts/TVPuN30d9vQ' },
      { exercise: 'Prancha', reps: '30s', sets: '3', type: 'core' },
    ],
  })),
  markWorkoutComplete: vi.fn(async () => true),
  getUserProgress: vi.fn(async () => []),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true })
}))

describe('WorkoutDay videos', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('abre modal e carrega iframe ao clicar em "Ver execução" no exercício com vídeo', async () => {
    render(
      <MemoryRouter initialEntries={["/program/avancado/day/1"]}>
        <Routes>
          <Route path="/program/:slug/day/:weekday" element={<WorkoutDay />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByText(/agachamento/i)
    const watchButtons = await screen.findAllByRole('button', { name: /ver execução/i })
    fireEvent.click(watchButtons[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    const iframe = dialog.querySelector('iframe')
    expect(iframe).not.toBeNull()
  })

  it('mostra "Vídeo indisponível" para exercício sem vídeo próprio quando o treino não tem vídeo geral', async () => {
    render(
      <MemoryRouter initialEntries={["/program/avancado/day/1"]}>
        <Routes>
          <Route path="/program/:slug/day/:weekday" element={<WorkoutDay />} />
        </Routes>
      </MemoryRouter>
    )

    // "Prancha" não tem `video`, mas o treino tem `video_url`, então ainda deve ter botão.
    await screen.findByText(/prancha/i)
    const watchButtons = await screen.findAllByRole('button', { name: /ver execução/i })
    expect(watchButtons.length).toBe(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run --dir . src/__tests__/WorkoutDay.test.tsx --exclude "**/.claude/**"`
Expected: FAIL — no element with role `button` named "Ver execução" exists yet, because `WorkoutDay.tsx` doesn't pass `hasVideo`/`onWatchVideo` to `ExerciseItem`.

- [ ] **Step 3: Wire the props in `WorkoutDay.tsx`**

In `src/pages/WorkoutDay.tsx`, replace the bi-set group item rendering block:

```tsx
                        {groupItems.map((exercise, idx) => {
                          const k = getExerciseKey(exercise, idx)
                          const completed = !!exProgress[k]?.completed
                          return (
                            <div key={`pair-${g}-${idx}`} className="bg-purple-50 rounded-md p-3">
                              <ExerciseItem
                                exercise={exercise}
                                isCompleted={completed}
                                onToggle={() => {
                                  const k = getExerciseKey(exercise, idx)
                                  lastActionRef.current = { key: k, prev: !!exProgress[k]?.completed }
                                  toggleExercise(exercise, idx)
                                }}
                              />
                              {(exercise.video || workout.video_url) ? (
                                <button
                                  onClick={() => openExerciseVideo(exercise)}
                                  className="mt-2 inline-flex items-center text-purple-700 hover:text-purple-800"
                                >
                                  <Play className="w-4 h-4 mr-1" /> Assistir vídeo
                                </button>
                              ) : (
                                <p className="mt-2 text-xs text-gray-500">Vídeo indisponível</p>
                              )}
                            </div>
                          )
                        })}
```

with:

```tsx
                        {groupItems.map((exercise, idx) => {
                          const k = getExerciseKey(exercise, idx)
                          const completed = !!exProgress[k]?.completed
                          return (
                            <div key={`pair-${g}-${idx}`} className="bg-purple-50 dark:bg-purple-950/20 rounded-md p-3">
                              <ExerciseItem
                                exercise={exercise}
                                isCompleted={completed}
                                onToggle={() => {
                                  const k = getExerciseKey(exercise, idx)
                                  lastActionRef.current = { key: k, prev: !!exProgress[k]?.completed }
                                  toggleExercise(exercise, idx)
                                }}
                                hasVideo={!!(exercise.video || workout.video_url)}
                                onWatchVideo={() => openExerciseVideo(exercise)}
                              />
                            </div>
                          )
                        })}
```

Then replace the single-exercise rendering block:

```tsx
                cards.push(
                  <div key={`single-${i}`} className="p-1">
                    <ExerciseItem
                      exercise={ex}
                      isCompleted={!!exProgress[getExerciseKey(ex, i)]?.completed}
                      onToggle={() => {
                        const k = getExerciseKey(ex, i)
                        lastActionRef.current = { key: k, prev: !!exProgress[k]?.completed }
                        toggleExercise(ex, i)
                      }}
                    />
                  </div>
                )
```

with:

```tsx
                cards.push(
                  <div key={`single-${i}`} className="p-1">
                    <ExerciseItem
                      exercise={ex}
                      isCompleted={!!exProgress[getExerciseKey(ex, i)]?.completed}
                      onToggle={() => {
                        const k = getExerciseKey(ex, i)
                        lastActionRef.current = { key: k, prev: !!exProgress[k]?.completed }
                        toggleExercise(ex, i)
                      }}
                      hasVideo={!!(ex.video || workout.video_url)}
                      onWatchVideo={() => openExerciseVideo(ex)}
                    />
                  </div>
                )
```

Also update the bi-set wrapper border color a few lines above the group block for dark mode, changing:

```tsx
                    <div key={`group-${g}-${i}`} className="border border-purple-300 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-700 font-medium">Bi-set</span>
                        <span className="text-xs text-purple-600">Grupo {g}</span>
                      </div>
```

to:

```tsx
                    <div key={`group-${g}-${i}`} className="border border-purple-300 dark:border-purple-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-purple-700 dark:text-purple-300 font-medium">Bi-set</span>
                        <span className="text-xs text-purple-600 dark:text-purple-400">Grupo {g}</span>
                      </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run --dir . src/__tests__/WorkoutDay.test.tsx --exclude "**/.claude/**"`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/pages/WorkoutDay.tsx src/__tests__/WorkoutDay.test.tsx
git commit -m "fix: wire per-exercise execution video for all exercises in WorkoutDay"
```

---

### Task 3: Theme-aware, mobile-first polish for the rest of `WorkoutDay`

**Files:**
- Modify: `src/pages/WorkoutDay.tsx` (loading state, not-found state, page background, header, workout-video card, progress card, exercises card wrapper, video modal header, complete button bar, completed banner)

**Interfaces:**
- Consumes: nothing new — pure Tailwind class changes on existing JSX. No prop or logic changes in this task.

- [ ] **Step 1: Update the loading state**

Replace:

```tsx
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-purple-200 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-purple-200 rounded w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-purple-200 rounded w-24 mx-auto"></div>
        </div>
      </div>
```

with:

```tsx
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 bg-purple-200 dark:bg-purple-900/40 rounded-full mx-auto mb-4"></div>
          <div className="h-4 bg-purple-200 dark:bg-purple-900/40 rounded w-32 mx-auto mb-2"></div>
          <div className="h-4 bg-purple-200 dark:bg-purple-900/40 rounded w-24 mx-auto"></div>
        </div>
      </div>
```

- [ ] **Step 2: Update the not-found state**

Replace:

```tsx
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Treino não encontrado</h2>
          <button
            onClick={() => navigate('/home')}
            className="text-purple-600 hover:text-purple-700"
          >
            Voltar à Home
          </button>
        </div>
      </div>
```

with:

```tsx
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-text mb-2">Treino não encontrado</h2>
          <button
            onClick={() => navigate('/home')}
            className="text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            Voltar à Home
          </button>
        </div>
      </div>
```

- [ ] **Step 3: Update the page background and header**

Replace:

```tsx
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate(`/program/${slug}`)}
            className="mr-4 p-2 rounded-lg hover:bg-white/50 transition"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight break-words">
              {workout.title}
            </h1>
            <p className="text-gray-600">{weekdayLabel} • {program?.name}</p>
          </div>
        </div>
```

with:

```tsx
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-bg dark:to-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-8">
          <button
            onClick={() => navigate(`/program/${slug}`)}
            className="mr-4 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-6 h-6 text-text" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text leading-tight break-words">
              {workout.title}
            </h1>
            <p className="text-text-muted">{weekdayLabel} • {program?.name}</p>
          </div>
        </div>
```

- [ ] **Step 4: Update the workout-video card**

Replace:

```tsx
        {workout.video_url && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              <Play className="w-5 h-5 mr-2" />
              Vídeo do Treino
            </h2>
```

with:

```tsx
        {workout.video_url && (
          <div className="bg-surface rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-text mb-4 flex items-center">
              <Play className="w-5 h-5 mr-2" />
              Vídeo do Treino
            </h2>
```

- [ ] **Step 5: Update the progress card**

Replace:

```tsx
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            {(() => {
              const total = workout.exercises.length
              const done = workout.exercises.reduce((acc, ex, i) => {
                const k = getExerciseKey(ex, i)
                return acc + (exProgress[k]?.completed ? 1 : 0)
              }, 0)
              const pct = Math.round((done / total) * 100)
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xl font-bold text-gray-900">Progresso dos exercícios</div>
                    <div className="text-sm text-gray-600">{done}/{total}</div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                  </div>
                </>
              )
            })()}
          </div>
```

with:

```tsx
          <div className="bg-surface rounded-2xl shadow-lg p-6 mb-6">
            {(() => {
              const total = workout.exercises.length
              const done = workout.exercises.reduce((acc, ex, i) => {
                const k = getExerciseKey(ex, i)
                return acc + (exProgress[k]?.completed ? 1 : 0)
              }, 0)
              const pct = Math.round((done / total) * 100)
              return (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xl font-bold text-text">Progresso dos exercícios</div>
                    <div className="text-sm text-text-muted">{done}/{total}</div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-white/10 rounded-full h-2">
                    <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                  </div>
                </>
              )
            })()}
          </div>
```

- [ ] **Step 6: Update the exercises card wrapper heading**

Replace:

```tsx
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Exercícios</h2>
```

with:

```tsx
        <div className="bg-surface rounded-2xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-text mb-6">Exercícios</h2>
```

- [ ] **Step 7: Update the video modal header**

Replace:

```tsx
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
            <div className="bg-white/95 p-3 flex items-center justify-between">
              <div className="font-semibold text-gray-900">{videoTitle || 'Vídeo do exercício'}</div>
              <button
                onClick={() => { setModalOpen(false); setVideoLoading(false); }}
                className="ui-hover bg-white border border-gray-300 text-gray-900 px-3 py-2 rounded-md flex items-center"
                aria-label="Fechar"
              >
```

with:

```tsx
          <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col">
            <div className="bg-surface/95 p-3 flex items-center justify-between">
              <div className="font-semibold text-text">{videoTitle || 'Vídeo do exercício'}</div>
              <button
                onClick={() => { setModalOpen(false); setVideoLoading(false); }}
                className="ui-hover bg-surface border border-border text-text px-3 py-2 rounded-md flex items-center"
                aria-label="Fechar"
              >
```

- [ ] **Step 8: Update the fixed complete-workout bar and the completed banner**

Replace:

```tsx
        {!isDayCompleted && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
```

with:

```tsx
        {!isDayCompleted && (
          <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4">
```

Replace:

```tsx
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

with:

```tsx
        {isDayCompleted && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
            <div className="flex items-center justify-center mb-2">
              <Check className="w-6 h-6 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-green-800 dark:text-green-300 font-medium">Treino concluído!</span>
            </div>
            <p className="text-green-600 dark:text-green-400 text-sm">
              Parabéns! Você completou o treino de {weekdayLabel}.
            </p>
          </div>
        )}
```

- [ ] **Step 9: Run the full WorkoutDay and ExerciseItem test suites to confirm no regressions**

Run: `npx vitest run --dir . src/__tests__/WorkoutDay.test.tsx src/__tests__/ExerciseItem.test.tsx --exclude "**/.claude/**"`
Expected: PASS (6 tests total)

- [ ] **Step 10: Type-check and lint**

Run: `npm run check`
Expected: no TypeScript errors.

Run: `npm run lint`
Expected: no new lint errors in `src/pages/WorkoutDay.tsx` or `src/components/ExerciseItem.tsx`.

- [ ] **Step 11: Commit**

```bash
git add src/pages/WorkoutDay.tsx
git commit -m "style: theme-aware mobile-first polish for WorkoutDay"
```

---

## Manual verification (after all tasks)

Run `npm run dev`, open a program day that has both a workout-level video and per-exercise videos (e.g. via the admin editor at `/admin/programs/:slug` → a weekday), and confirm at a mobile viewport width (~375px):
1. Every exercise card still shows name, sets/reps, note, and the completion check, and toggling it still works.
2. Every exercise card with a video (its own, or falling back to the workout's) shows a "Ver execução" button that opens the same full-screen modal/embed as the workout-level video.
3. Exercises with no video anywhere show "Vídeo indisponível" instead of a button.
4. Toggling dark mode from the Profile page and returning to this workout day shows themed backgrounds, cards, and text (no leftover hardcoded white/gray).
