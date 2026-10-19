import { Exercise } from '../types'

/** Exercício na tela de edição: `key` estável pra o React não confundir os
 *  cartões ao reordenar/remover (índice muda, key não). Nunca vai pro banco. */
export interface EditorItem {
  key: string
  exercise: Exercise
}

export interface WorkoutDraft {
  title: string
  videoUrl: string
  items: EditorItem[]
}

export interface DraftErrors {
  title?: string
  /** key do item -> mensagem */
  exercises: Record<string, string>
}

let nextKey = 0
export const newKey = () => `ex-${++nextKey}`

export const toItems = (exercises: Exercise[]): EditorItem[] =>
  exercises.map((exercise) => ({ key: newKey(), exercise }))

export const toExercises = (items: EditorItem[]): Exercise[] => items.map((i) => i.exercise)

export const emptyExercise = (withGroup: boolean): Exercise =>
  withGroup
    ? { exercise: '', reps: '', sets: '', note: '', group: '', type: 'normal', video: '' }
    : { exercise: '', reps: '', sets: '', note: '', type: 'normal', video: '' }

export const updateItem = (items: EditorItem[], key: string, patch: Partial<Exercise>): EditorItem[] =>
  items.map((i) => (i.key === key ? { ...i, exercise: { ...i.exercise, ...patch } } : i))

export const moveItem = (items: EditorItem[], key: string, direction: -1 | 1): EditorItem[] => {
  const index = items.findIndex((i) => i.key === key)
  const target = index + direction
  if (index < 0 || target < 0 || target >= items.length) return items
  const next = [...items]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** Cópia logo abaixo do original, com key nova. */
export const duplicateItem = (items: EditorItem[], key: string): { items: EditorItem[]; key: string | null } => {
  const index = items.findIndex((i) => i.key === key)
  if (index < 0) return { items, key: null }
  const copy = { key: newKey(), exercise: { ...items[index].exercise } }
  return { items: [...items.slice(0, index + 1), copy, ...items.slice(index + 1)], key: copy.key }
}

export const insertItemAt = (items: EditorItem[], item: EditorItem, index: number): EditorItem[] => {
  const at = Math.max(0, Math.min(index, items.length))
  return [...items.slice(0, at), item, ...items.slice(at)]
}

export const validateDraft = (draft: WorkoutDraft): DraftErrors => {
  const errors: DraftErrors = { exercises: {} }
  if (!draft.title.trim()) errors.title = 'Dê um título ao treino.'
  for (const item of draft.items) {
    if (!item.exercise.exercise.trim()) errors.exercises[item.key] = 'Falta o nome do exercício.'
  }
  return errors
}

export const hasErrors = (errors: DraftErrors) => !!errors.title || Object.keys(errors.exercises).length > 0

/** Compara só o que é salvo (as keys não contam). */
export const draftSignature = (draft: WorkoutDraft) =>
  JSON.stringify([draft.title, draft.videoUrl, toExercises(draft.items)])

export const isLikelyUrl = (value: string) => !value.trim() || /^https?:\/\/\S+$/i.test(value.trim())

const TYPE_LABELS: Record<NonNullable<Exercise['type']>, string> = {
  normal: 'Normal',
  warmup: 'Aquecimento',
  drop_set: 'Drop-set',
  core: 'Core',
}

export const EXERCISE_TYPES = (Object.keys(TYPE_LABELS) as NonNullable<Exercise['type']>[]).map((value) => ({
  value,
  label: TYPE_LABELS[value],
}))

export const typeLabel = (type: Exercise['type']) => TYPE_LABELS[type || 'normal']

/** "3 × 12" / "3 séries" / "12" / "" — resumo do cartão fechado. */
export const volumeSummary = (ex: Exercise) => {
  const sets = ex.sets?.trim()
  const reps = ex.reps?.trim()
  if (sets && reps) return `${sets} × ${reps}`
  if (sets) return `${sets} séries`
  return reps || ''
}

/** Item faz parte de um bi-set se o vizinho de cima ou de baixo tem o mesmo grupo. */
export const biSetPosition = (items: EditorItem[], index: number): 'none' | 'start' | 'middle' | 'end' => {
  const g = items[index]?.exercise.group?.trim()
  if (!g) return 'none'
  const prev = items[index - 1]?.exercise.group?.trim() === g
  const next = items[index + 1]?.exercise.group?.trim() === g
  if (prev && next) return 'middle'
  if (next) return 'start'
  if (prev) return 'end'
  return 'none'
}
