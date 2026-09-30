import { describe, it, expect, vi } from 'vitest'

const { fromMock } = vi.hoisted(() => {
  const fromMock = vi.fn()
  return { fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import {
  listWorkoutsForProgramAdmin,
  updateWorkoutAdmin,
  getUserWorkout,
  saveUserWorkoutAdmin,
  deleteUserWorkoutAdmin,
} from '../utils/adminWorkouts'

describe('listWorkoutsForProgramAdmin', () => {
  it('retorna os treinos do programa ordenados por dia da semana', async () => {
    const orderMock = vi.fn().mockResolvedValueOnce({
      data: [{ weekday: 2, title: 'Terça' }, { weekday: 1, title: 'Segunda' }],
      error: null,
    })
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ select: selectMock })

    const result = await listWorkoutsForProgramAdmin('p1')

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(selectMock).toHaveBeenCalledWith('*')
    expect(eqMock).toHaveBeenCalledWith('program_id', 'p1')
    expect(orderMock).toHaveBeenCalledWith('weekday', { ascending: true })
    expect(result).toHaveLength(2)
  })

  it('lança erro quando a query falha', async () => {
    const orderMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('boom') })
    const eqMock = vi.fn(() => ({ order: orderMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ select: selectMock })

    await expect(listWorkoutsForProgramAdmin('p1')).rejects.toThrow('boom')
  })
})

describe('updateWorkoutAdmin', () => {
  it('atualiza o treino pelo id informado', async () => {
    const eqMock = vi.fn().mockResolvedValueOnce({ error: null })
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ update: updateMock })

    await updateWorkoutAdmin('w3', { title: 'Novo título', video_url: '', exercises: [] })

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(updateMock).toHaveBeenCalledWith({ title: 'Novo título', video_url: '', exercises: [] })
    expect(eqMock).toHaveBeenCalledWith('id', 'w3')
  })

  it('lança erro quando o update falha', async () => {
    const eqMock = vi.fn().mockResolvedValueOnce({ error: new Error('falhou') })
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ update: updateMock })

    await expect(updateWorkoutAdmin('w3', { title: '', video_url: '', exercises: [] })).rejects.toThrow('falhou')
  })
})

describe('getUserWorkout', () => {
  it('retorna o treino pessoal da usuária pelo user_id', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValueOnce({
      data: { id: 'w9', user_id: 'u1', title: 'Treino da Bia', exercises: [], video_url: '', program_id: null, weekday: null },
      error: null,
    })
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ select: selectMock })

    const result = await getUserWorkout('u1')

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
    expect(result?.title).toBe('Treino da Bia')
  })

  it('retorna null quando a usuária não tem treino pessoal', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValueOnce({ data: null, error: null })
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ select: selectMock })

    const result = await getUserWorkout('u1')

    expect(result).toBeNull()
  })

  it('lança erro quando a query falha', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('boom') })
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ select: selectMock })

    await expect(getUserWorkout('u1')).rejects.toThrow('boom')
  })
})

describe('saveUserWorkoutAdmin', () => {
  it('cria um treino novo quando não existe workoutId', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({
      data: { id: 'w-novo', user_id: 'u1', title: 'Treino novo', exercises: [], video_url: '' },
      error: null,
    })
    const selectMock = vi.fn(() => ({ single: singleMock }))
    const insertMock = vi.fn(() => ({ select: selectMock }))
    fromMock.mockReturnValueOnce({ insert: insertMock })

    const result = await saveUserWorkoutAdmin('u1', null, { title: 'Treino novo', video_url: '', exercises: [] })

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(insertMock).toHaveBeenCalledWith({ user_id: 'u1', title: 'Treino novo', video_url: '', exercises: [] })
    expect(result.id).toBe('w-novo')
  })

  it('atualiza o treino existente quando workoutId é informado', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({
      data: { id: 'w-existente', user_id: 'u1', title: 'Editado', exercises: [], video_url: '' },
      error: null,
    })
    const selectMock = vi.fn(() => ({ single: singleMock }))
    const eqMock = vi.fn(() => ({ select: selectMock }))
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ update: updateMock })

    const result = await saveUserWorkoutAdmin('u1', 'w-existente', { title: 'Editado', video_url: '', exercises: [] })

    expect(updateMock).toHaveBeenCalledWith({ title: 'Editado', video_url: '', exercises: [] })
    expect(eqMock).toHaveBeenCalledWith('id', 'w-existente')
    expect(result.title).toBe('Editado')
  })

  it('lança erro quando a criação falha', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({ data: null, error: new Error('falhou') })
    const selectMock = vi.fn(() => ({ single: singleMock }))
    const insertMock = vi.fn(() => ({ select: selectMock }))
    fromMock.mockReturnValueOnce({ insert: insertMock })

    await expect(
      saveUserWorkoutAdmin('u1', null, { title: '', video_url: '', exercises: [] })
    ).rejects.toThrow('falhou')
  })
})

describe('deleteUserWorkoutAdmin', () => {
  it('apaga o treino pelo id', async () => {
    const eqMock = vi.fn().mockResolvedValueOnce({ error: null })
    const deleteMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ delete: deleteMock })

    await deleteUserWorkoutAdmin('w9')

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(eqMock).toHaveBeenCalledWith('id', 'w9')
  })

  it('lança erro quando o delete falha', async () => {
    const eqMock = vi.fn().mockResolvedValueOnce({ error: new Error('bloqueado') })
    const deleteMock = vi.fn(() => ({ eq: eqMock }))
    fromMock.mockReturnValueOnce({ delete: deleteMock })

    await expect(deleteUserWorkoutAdmin('w9')).rejects.toThrow('bloqueado')
  })
})
