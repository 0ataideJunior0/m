import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkoutDay from '../pages/WorkoutDay'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

// O mesmo rótulo de grupo ("A") usado em DOIS bi-sets separados no mesmo
// treino — o agrupamento só junta itens CONSECUTIVOS, então isto vira dois
// cards distintos.
//
// O card de bi-set numerava seus itens com um índice LOCAL ao grupo (0, 1)
// em vez do índice global em finalOrder. Com isso os dois cards produziam
// exatamente as mesmas chaves:
//     card 1 → 0-gA-prancha, 1-gA-remada
//     card 2 → 0-gA-prancha, 1-gA-remada   ← colisão
//
// Com o índice global, viram 0/1 e 3/4, que não colidem.
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
      { exercise: 'Prancha', reps: '30s', type: 'normal', group: 'A' },
      { exercise: 'Remada', reps: '12', type: 'normal', group: 'A' },
      { exercise: 'Agachamento', reps: '15', type: 'normal' },
      { exercise: 'Prancha', reps: '45s', type: 'normal', group: 'A' },
      { exercise: 'Remada', reps: '10', type: 'normal', group: 'A' },
    ],
  })),
  markWorkoutComplete: vi.fn(async () => true),
  getUserProgress: vi.fn(async () => []),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}))

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

describe('WorkoutDay — bi-sets com o mesmo rótulo de grupo', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('marcar a "Prancha" do primeiro bi-set não marca a do segundo', async () => {
    renderPage()
    await screen.findByText(/agachamento/i)

    const pranchas = screen.getAllByRole('checkbox', { name: /marcar prancha/i })
    expect(pranchas).toHaveLength(2)

    fireEvent.click(pranchas[0])

    const depois = screen.getAllByRole('checkbox', { name: /marcar prancha/i })
    expect(depois[0]).toHaveAttribute('aria-checked', 'true')
    expect(depois[1]).toHaveAttribute('aria-checked', 'false')
  })

  it('marcar a "Remada" do segundo bi-set não marca a do primeiro', async () => {
    renderPage()
    await screen.findByText(/agachamento/i)

    const remadas = screen.getAllByRole('checkbox', { name: /marcar remada/i })
    expect(remadas).toHaveLength(2)

    fireEvent.click(remadas[1])

    const depois = screen.getAllByRole('checkbox', { name: /marcar remada/i })
    expect(depois[0]).toHaveAttribute('aria-checked', 'false')
    expect(depois[1]).toHaveAttribute('aria-checked', 'true')
  })

  it('um exercício solto entre os dois bi-sets continua independente', async () => {
    renderPage()
    const agachamento = await screen.findByRole('checkbox', { name: /marcar agachamento/i })

    fireEvent.click(screen.getAllByRole('checkbox', { name: /marcar prancha/i })[0])

    expect(agachamento).toHaveAttribute('aria-checked', 'false')
  })
})
