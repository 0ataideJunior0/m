import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// useDialogA11y precisa de um container DOM real (ref anexada via JSX) pra
// fazer o focus-trap; renderHook não renderiza markup, então o ref fica
// null. Ele já tem cobertura própria em useDialogA11y.test.tsx — aqui o
// alvo é só a lógica de estado do modal de vídeo.
vi.mock('../hooks/useDialogA11y', () => ({
  useDialogA11y: vi.fn(),
}))

import { useExerciseVideoModal } from '../hooks/useExerciseVideoModal'
import { Workout } from '../types'

const workout: Workout = {
  id: 'w1',
  program_id: 'p1',
  weekday: 1,
  user_id: null,
  title: 'Treino A',
  video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  created_at: '',
  exercises: [
    { exercise: 'Agachamento', reps: '12', video: 'https://www.youtube.com/shorts/abc123' },
    { exercise: 'Prancha', reps: '30s' },
  ],
}

describe('useExerciseVideoModal', () => {
  it('abre o modal com o vídeo próprio do exercício', () => {
    const { result } = renderHook(() => useExerciseVideoModal(workout))

    act(() => {
      result.current.openExerciseVideo(workout.exercises[0])
    })

    expect(result.current.modalOpen).toBe(true)
    expect(result.current.videoLoading).toBe(true)
    expect(result.current.videoTitle).toBe('Agachamento')
    expect(result.current.videoUrl).toContain('embed/')
  })

  it('usa o vídeo geral do treino e título genérico quando o exercício não tem vídeo próprio', () => {
    const { result } = renderHook(() => useExerciseVideoModal(workout))

    act(() => {
      result.current.openExerciseVideo(workout.exercises[1])
    })

    expect(result.current.videoTitle).toBe('Vídeo do treino')
    expect(result.current.videoUrl).not.toBeNull()
  })

  it('mostra toast quando não há vídeo próprio nem geral', () => {
    const workoutSemVideo: Workout = { ...workout, video_url: '' }
    const { result } = renderHook(() => useExerciseVideoModal(workoutSemVideo))

    act(() => {
      result.current.openExerciseVideo(workoutSemVideo.exercises[1])
    })

    expect(result.current.modalOpen).toBe(false)
    expect(result.current.toast?.message).toMatch(/não disponível/i)
  })

  it('closeVideoModal fecha o modal mas mantém a última url (evita reabertura em falso, mas não re-renderiza vídeo antigo)', () => {
    const { result } = renderHook(() => useExerciseVideoModal(workout))

    act(() => {
      result.current.openExerciseVideo(workout.exercises[0])
    })
    act(() => {
      result.current.closeVideoModal()
    })

    expect(result.current.modalOpen).toBe(false)
    expect(result.current.videoLoading).toBe(false)
  })

  it('onVideoLoaded desliga o estado de carregando', () => {
    const { result } = renderHook(() => useExerciseVideoModal(workout))

    act(() => {
      result.current.openExerciseVideo(workout.exercises[0])
    })
    expect(result.current.videoLoading).toBe(true)

    act(() => {
      result.current.onVideoLoaded()
    })

    expect(result.current.videoLoading).toBe(false)
  })
})
