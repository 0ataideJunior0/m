import { describe, it, expect, vi } from 'vitest'

const { orderMock, eqSelectMock, selectMock, eqUpdateMock, updateMock, fromMock } = vi.hoisted(() => {
  const orderMock = vi.fn()
  const eqSelectMock = vi.fn(() => ({ order: orderMock }))
  const selectMock = vi.fn(() => ({ eq: eqSelectMock }))
  const eqUpdateMock = vi.fn()
  const updateMock = vi.fn(() => ({ eq: eqUpdateMock }))
  const fromMock = vi.fn(() => ({ select: selectMock, update: updateMock }))
  return { orderMock, eqSelectMock, selectMock, eqUpdateMock, updateMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { listWorkoutsForProgramAdmin, updateWorkoutAdmin } from '../utils/adminWorkouts'

describe('listWorkoutsForProgramAdmin', () => {
  it('retorna os treinos do programa ordenados por dia da semana', async () => {
    orderMock.mockResolvedValueOnce({
      data: [{ weekday: 2, title: 'Terça' }, { weekday: 1, title: 'Segunda' }],
      error: null,
    })

    const result = await listWorkoutsForProgramAdmin('p1')

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(eqSelectMock).toHaveBeenCalledWith('program_id', 'p1')
    expect(orderMock).toHaveBeenCalledWith('weekday', { ascending: true })
    expect(result).toHaveLength(2)
  })

  it('lança erro quando a query falha', async () => {
    orderMock.mockResolvedValueOnce({ data: null, error: new Error('boom') })
    await expect(listWorkoutsForProgramAdmin('p1')).rejects.toThrow('boom')
  })
})

describe('updateWorkoutAdmin', () => {
  it('atualiza o treino pelo id informado', async () => {
    eqUpdateMock.mockResolvedValueOnce({ error: null })

    await updateWorkoutAdmin('w3', { title: 'Novo título', video_url: '', exercises: [] })

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(updateMock).toHaveBeenCalledWith({ title: 'Novo título', video_url: '', exercises: [] })
    expect(eqUpdateMock).toHaveBeenCalledWith('id', 'w3')
  })

  it('lança erro quando o update falha', async () => {
    eqUpdateMock.mockResolvedValueOnce({ error: new Error('falhou') })
    await expect(updateWorkoutAdmin('w3', { title: '', video_url: '', exercises: [] })).rejects.toThrow('falhou')
  })
})
