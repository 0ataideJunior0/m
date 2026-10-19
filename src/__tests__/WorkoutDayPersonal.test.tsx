import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import WorkoutDay from '../pages/WorkoutDay'
import { getActiveWorkout } from '../utils/activeWorkout'

const getMyWorkoutForDayMock = vi.fn()
const getProgramBySlugMock = vi.fn()

vi.mock('../utils/workouts', () => ({
  getProgramBySlug: (...args: unknown[]) => getProgramBySlugMock(...args),
  getWorkoutByProgramAndWeekday: vi.fn(),
  getMyWorkoutForDay: (...args: unknown[]) => getMyWorkoutForDayMock(...args),
  markWorkoutComplete: vi.fn(async () => true),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}))

const renderDay = (weekday = 3) =>
  render(
    <MemoryRouter initialEntries={[`/meu-treino/dia/${weekday}`]}>
      <Routes>
        <Route path="/meu-treino/dia/:weekday" element={<WorkoutDay personal />} />
        <Route path="/meu-treino" element={<div>Minha semana Page</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  localStorage.clear()
  getProgramBySlugMock.mockReset()
  getMyWorkoutForDayMock.mockReset().mockResolvedValue({
    id: 'w3',
    program_id: null,
    weekday: 3,
    user_id: 'u1',
    title: 'Quarta da Ana',
    video_url: '',
    created_at: '',
    exercises: [
      { exercise: 'Stiff', reps: '10', group: 'A' },
      { exercise: 'Elevação pélvica', reps: '12', group: 'A' },
    ],
  })
})

describe('WorkoutDay — dia da semana pessoal', () => {
  it('carrega o treino do dia da aluna, sem consultar programa', async () => {
    renderDay()

    expect(await screen.findByText('Quarta da Ana')).toBeInTheDocument()
    expect(screen.getByText(/Quarta-feira • Sua semana/)).toBeInTheDocument()
    expect(getMyWorkoutForDayMock).toHaveBeenCalledWith('u1', 3)
    expect(getProgramBySlugMock).not.toHaveBeenCalled()
  })

  it('ao concluir, volta para a semana e encerra a sessão', async () => {
    renderDay()

    await screen.findByText('Quarta da Ana')
    fireEvent.click(screen.getByRole('button', { name: /iniciar treino/i }))
    fireEvent.click(screen.getByRole('button', { name: /marcar como concluído/i }))

    expect(await screen.findByText('Minha semana Page')).toBeInTheDocument()
    expect(getActiveWorkout('u1')).toBeNull()
  })

  it('dia sem treino mostra descanso e leva de volta para a semana', async () => {
    getMyWorkoutForDayMock.mockResolvedValue(null)
    renderDay(7)

    expect(await screen.findByText('Domingo é dia de descanso')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ver minha semana' }))
    expect(await screen.findByText('Minha semana Page')).toBeInTheDocument()
  })
})
