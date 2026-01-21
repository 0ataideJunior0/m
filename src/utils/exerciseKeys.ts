import type { Exercise } from '../types'

export function getExerciseKey(ex: Exercise, index?: number) {
  const base = (ex.group ? `${ex.group}-` : '') + (ex.exercise || `ex-${index ?? 0}`)
  return base
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

