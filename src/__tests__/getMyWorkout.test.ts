import { describe, it, expect, vi } from 'vitest'

const { maybeSingleMock, eqMock, selectMock, fromMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))
  return { maybeSingleMock, eqMock, selectMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { getMyWorkout } from '../utils/workouts'

describe('getMyWorkout', () => {
  it('retorna o treino pessoal da usuária, normalizado', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        id: 'w1',
        program_id: null,
        weekday: null,
        user_id: 'u1',
        title: 'Treino da Ana',
        exercises: [{ exercise: 'Agachamento', reps: '12' }],
        video_url: '',
        created_at: '2026-01-01',
      },
      error: null,
    })

    const result = await getMyWorkout('u1')

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
    expect(result?.title).toBe('Treino da Ana')
    expect(result?.exercises[0].exercise).toBe('Agachamento')
  })

  it('retorna null quando a usuária não tem treino pessoal', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })

    const result = await getMyWorkout('u1')

    expect(result).toBeNull()
  })

  it('retorna null quando a query falha', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })

    const result = await getMyWorkout('u1')

    expect(result).toBeNull()
  })
})
