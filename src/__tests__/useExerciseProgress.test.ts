import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

const { loadLocalProgressMock, saveLocalProgressMock, mergeServerLocalMock, fetchExerciseProgressMock, upsertExerciseProgressMock } = vi.hoisted(() => ({
  loadLocalProgressMock: vi.fn(() => ({})),
  saveLocalProgressMock: vi.fn(),
  mergeServerLocalMock: vi.fn((remote: any, local: any) => ({ ...remote, ...local })),
  fetchExerciseProgressMock: vi.fn(async () => ({})),
  upsertExerciseProgressMock: vi.fn(async () => true),
}))

vi.mock('../utils/exerciseProgress', () => ({
  loadLocalProgress: loadLocalProgressMock,
  saveLocalProgress: saveLocalProgressMock,
  mergeServerLocal: mergeServerLocalMock,
}))

vi.mock('../utils/exerciseProgressRemote', () => ({
  fetchExerciseProgress: fetchExerciseProgressMock,
  upsertExerciseProgress: upsertExerciseProgressMock,
}))

import { useExerciseProgress } from '../hooks/useExerciseProgress'

const exercise = { exercise: 'Agachamento', reps: '12' }

describe('useExerciseProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadLocalProgressMock.mockReturnValue({})
    fetchExerciseProgressMock.mockResolvedValue({})
  })

  it('carrega progresso local e depois mescla com o remoto', async () => {
    loadLocalProgressMock.mockReturnValueOnce({ '0-agachamento': { completed: true, ts: 1 } })
    fetchExerciseProgressMock.mockResolvedValueOnce({ '0-agachamento': true })

    const { result } = renderHook(() => useExerciseProgress('u1', 'w1'))

    await waitFor(() => expect(mergeServerLocalMock).toHaveBeenCalled())
    expect(loadLocalProgressMock).toHaveBeenCalledWith('u1', 'w1')
    expect(fetchExerciseProgressMock).toHaveBeenCalledWith('u1', 'w1')
  })

  it('toggleExercise marca como concluído e persiste local + remoto (com debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { result } = renderHook(() => useExerciseProgress('u1', 'w1'))

    act(() => {
      result.current.toggleExercise(exercise, 0)
    })

    expect(result.current.exProgress['0-agachamento']?.completed).toBe(true)
    expect(saveLocalProgressMock).toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    expect(upsertExerciseProgressMock).toHaveBeenCalledWith('u1', 'w1', '0-agachamento', true)
    vi.useRealTimers()
  })

  it('não faz nada sem userId/workoutId', () => {
    const { result } = renderHook(() => useExerciseProgress(undefined, undefined))

    act(() => {
      result.current.toggleExercise(exercise, 0)
    })

    expect(result.current.exProgress).toEqual({})
    expect(saveLocalProgressMock).not.toHaveBeenCalled()
  })
})
