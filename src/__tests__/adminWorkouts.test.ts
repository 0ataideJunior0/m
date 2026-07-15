import { describe, it, expect, vi } from 'vitest'

const { orderMock, selectMock, eqMock, updateMock, fromMock } = vi.hoisted(() => {
  const orderMock = vi.fn()
  const selectMock = vi.fn(() => ({ order: orderMock }))
  const eqMock = vi.fn()
  const updateMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock, update: updateMock }))
  return { orderMock, selectMock, eqMock, updateMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { listWorkoutsAdmin, updateWorkoutAdmin } from '../utils/adminWorkouts'

describe('listWorkoutsAdmin', () => {
  it('retorna os treinos ordenados por dia', async () => {
    orderMock.mockResolvedValueOnce({
      data: [{ day_number: 2, title: 'Dia 2' }, { day_number: 1, title: 'Dia 1' }],
      error: null,
    })

    const result = await listWorkoutsAdmin()

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(orderMock).toHaveBeenCalledWith('day_number', { ascending: true })
    expect(result).toHaveLength(2)
  })

  it('lança erro quando a query falha', async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    await expect(listWorkoutsAdmin()).rejects.toThrow('boom')
  })
})

describe('updateWorkoutAdmin', () => {
  it('atualiza o treino do dia informado', async () => {
    eqMock.mockResolvedValueOnce({ error: null })

    await updateWorkoutAdmin(3, { title: 'Novo título', video_url: '', exercises: [] })

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(updateMock).toHaveBeenCalledWith({ title: 'Novo título', video_url: '', exercises: [] })
    expect(eqMock).toHaveBeenCalledWith('day_number', 3)
  })

  it('lança erro quando o update falha', async () => {
    eqMock.mockResolvedValueOnce({ error: new Error('falhou') })
    await expect(updateWorkoutAdmin(3, { title: '', video_url: '', exercises: [] })).rejects.toThrow('falhou')
  })
})
