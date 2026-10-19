import { describe, it, expect, vi, beforeEach } from 'vitest'

const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { getMyWeek, getMyWorkoutForDay, getMyPlan } from '../utils/workouts'

/** Query encadeável que resolve `result` em qualquer ponto da cadeia. */
const fakeQuery = (result: unknown) => {
  const q: any = {}
  for (const m of ['select', 'eq', 'order', 'maybeSingle']) q[m] = vi.fn(() => q)
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
  return q
}

beforeEach(() => fromMock.mockReset())

describe('getMyWeek', () => {
  it('retorna os dias da semana pessoal, normalizados e em ordem', async () => {
    const q = fakeQuery({
      data: [{ id: 'w1', user_id: 'u1', weekday: 1, title: 'Seg', exercises: [{ exercise: 'Agachamento', reps: 12 }] }],
      error: null,
    })
    fromMock.mockReturnValueOnce(q)

    const week = await getMyWeek('u1')

    expect(q.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(q.order).toHaveBeenCalledWith('weekday', { ascending: true })
    expect(week[0].exercises[0]).toMatchObject({ exercise: 'Agachamento', reps: '12' })
  })

  it('devolve lista vazia quando a query falha', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: new Error('boom') }))

    expect(await getMyWeek('u1')).toEqual([])
  })
})

describe('getMyWorkoutForDay', () => {
  it('busca o treino do dia pedido', async () => {
    const q = fakeQuery({ data: { id: 'w3', weekday: 3, title: 'Qua', exercises: [] }, error: null })
    fromMock.mockReturnValueOnce(q)

    const workout = await getMyWorkoutForDay('u1', 3)

    expect(q.eq).toHaveBeenCalledWith('weekday', 3)
    expect(workout?.title).toBe('Qua')
  })

  it('dia de descanso volta null', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: null }))

    expect(await getMyWorkoutForDay('u1', 7)).toBeNull()
  })
})

describe('getMyPlan', () => {
  it('lê se o catálogo está escondido', async () => {
    const q = fakeQuery({ data: { hide_catalog: true }, error: null })
    fromMock.mockReturnValueOnce(q)

    expect(await getMyPlan('u1')).toEqual({ hideCatalog: true })
    expect(fromMock).toHaveBeenCalledWith('personal_plans')
  })

  it('sem plano (ou com erro), o catálogo fica visível', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: null }))
    expect(await getMyPlan('u1')).toEqual({ hideCatalog: false })

    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: new Error('boom') }))
    expect(await getMyPlan('u1')).toEqual({ hideCatalog: false })
  })
})
