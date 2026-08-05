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
  it('começa o contador em 1 na primeira conclusão', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    upsertMock.mockResolvedValueOnce({ error: null })

    const result = await markWorkoutComplete('u1', 'w1')

    expect(result).toBe(true)
    expect(fromMock).toHaveBeenCalledWith('user_progress')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        workout_id: 'w1',
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
      expect.objectContaining({ completion_count: 4 }),
      { onConflict: 'user_id,workout_id' }
    )
  })

  it('retorna false quando o upsert falha', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    upsertMock.mockResolvedValueOnce({ error: new Error('boom') })

    const result = await markWorkoutComplete('u1', 'w1')
    expect(result).toBe(false)
  })

  it('não grava a chave completed no payload do upsert', async () => {
    // `completed` foi substituído por `completion_count` na migration
    // 20260727090000, mas continuava sendo escrito com valor incorreto
    // (sempre false, inclusive para quem já tinha completed=true). A coluna
    // ainda existe no banco por ora — o drop entra na Fase 4 — mas nada deve
    // mais escrever nela.
    maybeSingleMock.mockResolvedValueOnce({ data: null, error: null })
    upsertMock.mockResolvedValueOnce({ error: null })

    await markWorkoutComplete('u1', 'w1')

    const payload = upsertMock.mock.calls[0][0]
    expect(payload).not.toHaveProperty('completed')
  })
})
