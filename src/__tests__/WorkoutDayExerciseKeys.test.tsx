import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkoutDay from '../pages/WorkoutDay'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// Treino com DOIS exercícios de mesmo nome — "Prancha" no aquecimento e de
// novo no core. É o caso que colidia: ambos derivavam a chave 'prancha'.
//
// Atenção à ordem: WorkoutDay reordena com o aquecimento à frente
// (finalOrder), então os índices efetivos ficam:
//   0 = Prancha (warmup) · 1 = Agachamento · 2 = Prancha (core)
vi.mock('../utils/workouts', () => ({
  getProgramBySlug: vi.fn(async () => ({
    id: 'p1', slug: 'avancado', name: 'Avançado', sort_order: 1, created_at: '',
  })),
  getWorkoutByProgramAndWeekday: vi.fn(async () => ({
    id: 'w1',
    program_id: 'p1',
    weekday: 1,
    title: 'Treino A',
    video_url: '',
    created_at: new Date().toISOString(),
    exercises: [
      { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' },
      { exercise: 'Prancha', reps: '30s', sets: '3', type: 'warmup' },
      { exercise: 'Prancha', reps: '45s', sets: '2', type: 'core' },
    ],
  })),
  markWorkoutComplete: vi.fn(async () => true),
  getUserProgress: vi.fn(async () => []),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}))

// Isola o efeito no estado da tela: sem rede, sem localStorage compartilhado.
vi.mock('../utils/exerciseProgressRemote', () => ({
  upsertExerciseProgress: vi.fn(async () => true),
  fetchExerciseProgress: vi.fn(async () => ({})),
  resetExerciseProgress: vi.fn(async () => true),
}))

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/program/avancado/day/1']}>
      <Routes>
        <Route path="/program/:slug/day/:weekday" element={<WorkoutDay />} />
      </Routes>
    </MemoryRouter>,
  )

describe('WorkoutDay — exercícios homônimos', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('marcar a primeira "Prancha" não marca a segunda', async () => {
    renderPage()
    await screen.findByText(/agachamento/i)

    const pranchas = screen.getAllByRole('checkbox', { name: /marcar prancha/i })
    expect(pranchas).toHaveLength(2)
    expect(pranchas[0]).toHaveAttribute('aria-checked', 'false')
    expect(pranchas[1]).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(pranchas[0])

    const depois = screen.getAllByRole('checkbox', { name: /marcar prancha/i })
    expect(depois[0]).toHaveAttribute('aria-checked', 'true')
    expect(depois[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('marcar a segunda "Prancha" não marca a primeira', async () => {
    renderPage()
    await screen.findByText(/agachamento/i)

    const pranchas = screen.getAllByRole('checkbox', { name: /marcar prancha/i })
    fireEvent.click(pranchas[1])

    const depois = screen.getAllByRole('checkbox', { name: /marcar prancha/i })
    expect(depois[0]).toHaveAttribute('aria-checked', 'false')
    expect(depois[1]).toHaveAttribute('aria-checked', 'true')
  })

  it('as duas podem ficar marcadas de forma independente', async () => {
    renderPage()
    await screen.findByText(/agachamento/i)

    fireEvent.click(screen.getAllByRole('checkbox', { name: /marcar prancha/i })[0])
    fireEvent.click(screen.getAllByRole('checkbox', { name: /marcar prancha/i })[1])

    const depois = screen.getAllByRole('checkbox', { name: /marcar prancha/i })
    expect(depois[0]).toHaveAttribute('aria-checked', 'true')
    expect(depois[1]).toHaveAttribute('aria-checked', 'true')

    // E desmarcar uma não desmarca a outra.
    fireEvent.click(screen.getAllByRole('checkbox', { name: /marcar prancha/i })[0])

    const final = screen.getAllByRole('checkbox', { name: /marcar prancha/i })
    expect(final[0]).toHaveAttribute('aria-checked', 'false')
    expect(final[1]).toHaveAttribute('aria-checked', 'true')
  })
})
