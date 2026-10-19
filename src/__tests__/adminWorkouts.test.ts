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
  getUserWorkoutForDay,
  saveUserWorkoutAdmin,
  deleteUserWorkoutAdmin,
  copyProgramToUserAdmin,
  setHideCatalogAdmin,
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

/** Query encadeável que resolve `result` em qualquer ponto da cadeia. */
const fakeQuery = (result: unknown) => {
  const q: any = {}
  for (const m of ['select', 'eq', 'order', 'insert', 'update', 'delete', 'upsert', 'maybeSingle', 'single']) {
    q[m] = vi.fn(() => q)
  }
  q.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(result).then(resolve, reject)
  return q
}

describe('getUserWorkoutForDay', () => {
  it('busca o treino pessoal da usuária naquele dia da semana', async () => {
    const q = fakeQuery({ data: { id: 'w9', user_id: 'u1', weekday: 3, title: 'Treino da Bia' }, error: null })
    fromMock.mockReturnValueOnce(q)

    const result = await getUserWorkoutForDay('u1', 3)

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(q.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(q.eq).toHaveBeenCalledWith('weekday', 3)
    expect(result?.title).toBe('Treino da Bia')
  })

  it('retorna null quando o dia é de descanso', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: null }))

    expect(await getUserWorkoutForDay('u1', 7)).toBeNull()
  })

  it('lança erro quando a query falha', async () => {
    fromMock.mockReturnValueOnce(fakeQuery({ data: null, error: new Error('boom') }))

    await expect(getUserWorkoutForDay('u1', 1)).rejects.toThrow('boom')
  })
})

describe('copyProgramToUserAdmin', () => {
  it('atualiza dias existentes, cria os que faltam e transforma em descanso o que o programa não tem', async () => {
    fromMock.mockClear()
    const ex = [{ exercise: 'Agachamento', reps: '12' }]
    const programWeek = fakeQuery({
      data: [
        { id: 'p-w1', weekday: 1, title: 'Seg', video_url: 'v1', exercises: ex },
        { id: 'p-w2', weekday: 2, title: 'Ter', video_url: null, exercises: ex },
      ],
      error: null,
    })
    const userWeek = fakeQuery({ data: [{ id: 'u-w2', weekday: 2 }, { id: 'u-w3', weekday: 3 }], error: null })
    const insertDay1 = fakeQuery({ data: { id: 'novo' }, error: null })
    const updateDay2 = fakeQuery({ data: { id: 'u-w2' }, error: null })
    const deleteDay3 = fakeQuery({ error: null })
    fromMock
      .mockReturnValueOnce(programWeek)
      .mockReturnValueOnce(userWeek)
      .mockReturnValueOnce(insertDay1)
      .mockReturnValueOnce(updateDay2)
      .mockReturnValueOnce(deleteDay3)

    await copyProgramToUserAdmin('u1', 'p1')

    expect(programWeek.eq).toHaveBeenCalledWith('program_id', 'p1')
    expect(userWeek.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(insertDay1.insert).toHaveBeenCalledWith({ user_id: 'u1', weekday: 1, title: 'Seg', video_url: 'v1', exercises: ex })
    expect(updateDay2.update).toHaveBeenCalledWith({ title: 'Ter', video_url: '', exercises: ex })
    expect(updateDay2.eq).toHaveBeenCalledWith('id', 'u-w2')
    expect(deleteDay3.delete).toHaveBeenCalled()
    expect(deleteDay3.eq).toHaveBeenCalledWith('id', 'u-w3')
    expect(fromMock).toHaveBeenCalledTimes(5)
  })
})

describe('setHideCatalogAdmin', () => {
  it('grava a preferência no plano da aluna', async () => {
    const q = fakeQuery({ error: null })
    fromMock.mockReturnValueOnce(q)

    await setHideCatalogAdmin('u1', true)

    expect(fromMock).toHaveBeenCalledWith('personal_plans')
    expect(q.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u1', hide_catalog: true }))
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

    const result = await saveUserWorkoutAdmin('u1', 4, null, { title: 'Treino novo', video_url: '', exercises: [] })

    expect(fromMock).toHaveBeenCalledWith('workouts')
    expect(insertMock).toHaveBeenCalledWith({ user_id: 'u1', weekday: 4, title: 'Treino novo', video_url: '', exercises: [] })
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

    const result = await saveUserWorkoutAdmin('u1', 4, 'w-existente', { title: 'Editado', video_url: '', exercises: [] })

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
      saveUserWorkoutAdmin('u1', 1, null, { title: '', video_url: '', exercises: [] })
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
