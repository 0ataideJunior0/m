import { describe, it, expect } from 'vitest'
import {
  biSetPosition,
  draftSignature,
  duplicateItem,
  insertItemAt,
  isLikelyUrl,
  moveItem,
  toItems,
  validateDraft,
  volumeSummary,
} from '../utils/workoutEditor'

const items = () =>
  toItems([
    { exercise: 'Agachamento', reps: '12', sets: '3' },
    { exercise: 'Stiff', reps: '10', group: 'A' },
    { exercise: 'Elevação pélvica', reps: '15', group: 'A' },
  ])

describe('workoutEditor', () => {
  it('move pra cima/baixo e ignora nas pontas', () => {
    const list = items()
    expect(moveItem(list, list[1].key, -1).map((i) => i.exercise.exercise)).toEqual(['Stiff', 'Agachamento', 'Elevação pélvica'])
    expect(moveItem(list, list[0].key, -1)).toBe(list)
    expect(moveItem(list, list[2].key, 1)).toBe(list)
  })

  it('duplica logo abaixo com key nova', () => {
    const list = items()
    const { items: next, key } = duplicateItem(list, list[0].key)
    expect(next.map((i) => i.exercise.exercise)).toEqual(['Agachamento', 'Agachamento', 'Stiff', 'Elevação pélvica'])
    expect(key).not.toBe(list[0].key)
    expect(next[1].exercise).not.toBe(list[0].exercise)
  })

  it('desfazer reinsere na posição original', () => {
    const list = items()
    const [, removed, ...rest] = list
    expect(insertItemAt([list[0], ...rest], removed, 1).map((i) => i.key)).toEqual(list.map((i) => i.key))
  })

  it('exige título e nome em todo exercício', () => {
    const list = items()
    list[2] = { ...list[2], exercise: { ...list[2].exercise, exercise: '  ' } }
    const errors = validateDraft({ title: ' ', videoUrl: '', items: list })
    expect(errors.title).toBeTruthy()
    expect(Object.keys(errors.exercises)).toEqual([list[2].key])
  })

  it('a assinatura ignora as keys (recarregar não marca como alterado)', () => {
    const a = { title: 'T', videoUrl: '', items: items() }
    const b = { title: 'T', videoUrl: '', items: items() }
    expect(draftSignature(a)).toBe(draftSignature(b))
  })

  it('resume séries e repetições', () => {
    expect(volumeSummary({ exercise: 'x', reps: '12', sets: '3' })).toBe('3 × 12')
    expect(volumeSummary({ exercise: 'x', reps: '', sets: '4' })).toBe('4 séries')
    expect(volumeSummary({ exercise: 'x', reps: '30s' })).toBe('30s')
  })

  it('marca início e fim do bi-set só entre vizinhos do mesmo grupo', () => {
    const list = items()
    expect([0, 1, 2].map((i) => biSetPosition(list, i))).toEqual(['none', 'start', 'end'])
  })

  it('reconhece link (vazio também é válido)', () => {
    expect(isLikelyUrl('')).toBe(true)
    expect(isLikelyUrl('https://youtu.be/x')).toBe(true)
    expect(isLikelyUrl('youtube')).toBe(false)
  })
})
