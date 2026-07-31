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

    const result = await resetExerciseProgress('u1', 'w1')

    expect(result).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('user_exercise_progress')
    expect(deleteMock).toHaveBeenCalled()
    expect(eqMock1).toHaveBeenCalledWith('user_id', 'u1')
    expect(eqMock2).toHaveBeenCalledWith('workout_id', 'w1')
  })

  it('retorna false quando a deleção falha', async () => {
    eqMock2.mockResolvedValueOnce({ error: new Error('permission denied') })

    const result = await resetExerciseProgress('u1', 'w1')

    expect(result).toBe(false)
  })
})
