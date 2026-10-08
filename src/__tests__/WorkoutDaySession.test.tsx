import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import WorkoutDay from '../pages/WorkoutDay'
import { getActiveWorkout, startActiveWorkout } from '../utils/activeWorkout'

vi.mock('../utils/workouts', () => ({
  getProgramBySlug: vi.fn(async () => ({ id: 'p1', slug: 'avancado', name: 'Avançado', sort_order: 1, created_at: '' })),
  getWorkoutByProgramAndWeekday: vi.fn(async () => ({
    id: 'w1',
    program_id: 'p1',
    weekday: 1,
    user_id: null,
    title: 'Treino A',
    video_url: '',
    created_at: new Date().toISOString(),
    exercises: [{ exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }],
  })),
  markWorkoutComplete: vi.fn(async () => true),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}))

const renderDay = () =>
  render(
    <MemoryRouter initialEntries={['/program/avancado/day/1']}>
      <Routes>
        <Route path="/program/:slug/day/:weekday" element={<WorkoutDay />} />
        <Route path="/program/:slug" element={<div>Lista de Dias</div>} />
        <Route path="/program/avancado/day/2" element={<div>Treino em andamento Page</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  localStorage.clear()
})

describe('WorkoutDay — iniciar e concluir treino', () => {
  it('antes de iniciar, só dá pra iniciar: não há botão de concluir', async () => {
    renderDay()

    await screen.findByText('Treino A')
    expect(screen.getByRole('button', { name: /iniciar treino/i })).toBeEnabled()
    expect(screen.queryByRole('button', { name: /marcar como concluído/i })).toBeNull()
  })

  it('iniciar registra o treino em andamento e libera o botão de concluir', async () => {
    renderDay()

    await screen.findByText('Treino A')
    fireEvent.click(screen.getByRole('button', { name: /iniciar treino/i }))

    expect(getActiveWorkout('u1')).toMatchObject({
      workoutId: 'w1',
      title: 'Treino A',
      path: '/program/avancado/day/1',
    })
    expect(screen.getByRole('button', { name: /marcar como concluído/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /iniciar treino/i })).toBeNull()
  })

  it('concluir encerra a sessão, liberando iniciar outro treino', async () => {
    renderDay()

    await screen.findByText('Treino A')
    fireEvent.click(screen.getByRole('button', { name: /iniciar treino/i }))
    fireEvent.click(screen.getByRole('button', { name: /marcar como concluído/i }))

    expect(await screen.findByText('Lista de Dias')).toBeInTheDocument()
    expect(getActiveWorkout('u1')).toBeNull()
  })

  it('com outro treino em andamento, bloqueia o início e leva de volta a ele', async () => {
    startActiveWorkout('u1', { workoutId: 'w2', title: 'Treino B', path: '/program/avancado/day/2' })
    renderDay()

    await screen.findByText('Treino A')
    expect(screen.getByRole('status')).toHaveTextContent('Treino B')
    expect(screen.getByRole('button', { name: /iniciar treino/i })).toBeDisabled()
    expect(screen.queryByRole('button', { name: /marcar como concluído/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /voltar para ele/i }))
    expect(await screen.findByText('Treino em andamento Page')).toBeInTheDocument()
  })
})
