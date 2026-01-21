import { describe, it, expect } from 'vitest'
import { getExerciseKey } from '../utils/exerciseKeys'
import { mergeServerLocal } from '../utils/exerciseProgress'

describe('exercise keys', () => {
  it('normaliza nomes com acentos e espaços', () => {
    expect(getExerciseKey({ exercise: 'Agachamento Livre', reps: '12' })).toBe('agachamento-livre')
    expect(getExerciseKey({ exercise: 'Búlgaro', reps: '12', group: 'A' })).toBe('a-bulgaro')
  })
})

describe('merge server/local', () => {
  it('server tem prioridade sobre local', () => {
    const local = { 'ex-1': { completed: false, ts: 1 } }
    const server = { 'ex-1': true }
    const merged = mergeServerLocal(server, local)
    expect(merged['ex-1'].completed).toBe(true)
  })
  it('mantém local quando não há server', () => {
    const local = { 'ex-1': { completed: true, ts: 1 } }
    const server = {}
    const merged = mergeServerLocal(server, local)
    expect(merged['ex-1'].completed).toBe(true)
  })
})

