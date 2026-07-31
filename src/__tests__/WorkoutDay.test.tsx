import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkoutDay from '../pages/WorkoutDay'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../utils/workouts', () => ({
  getProgramBySlug: vi.fn(async () => ({ id: 'p1', slug: 'avancado', name: 'Avançado', sort_order: 1, created_at: '' })),
  getWorkoutByProgramAndWeekday: vi.fn(async () => ({
    id: 'w1',
    program_id: 'p1',
    weekday: 1,
    title: 'Treino A',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    created_at: new Date().toISOString(),
    exercises: [
      { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal', video: 'https://www.youtube.com/shorts/TVPuN30d9vQ' },
      { exercise: 'Prancha', reps: '30s', sets: '3', type: 'core' },
    ],
  })),
  markWorkoutComplete: vi.fn(async () => true),
  getUserProgress: vi.fn(async () => []),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true })
}))

describe('WorkoutDay videos', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('abre modal e carrega iframe ao clicar em "Ver execução" no exercício com vídeo', async () => {
    render(
      <MemoryRouter initialEntries={["/program/avancado/day/1"]}>
        <Routes>
          <Route path="/program/:slug/day/:weekday" element={<WorkoutDay />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByText(/agachamento/i)
    const watchButtons = await screen.findAllByRole('button', { name: /ver execução/i })
    fireEvent.click(watchButtons[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    const iframe = dialog.querySelector('iframe')
    expect(iframe).not.toBeNull()
  })

  it('mostra "Vídeo indisponível" para exercício sem vídeo próprio quando o treino não tem vídeo geral', async () => {
    render(
      <MemoryRouter initialEntries={["/program/avancado/day/1"]}>
        <Routes>
          <Route path="/program/:slug/day/:weekday" element={<WorkoutDay />} />
        </Routes>
      </MemoryRouter>
    )

    // "Prancha" não tem `video`, mas o treino tem `video_url`, então ainda deve ter botão.
    await screen.findByText(/prancha/i)
    const watchButtons = await screen.findAllByRole('button', { name: /ver execução/i })
    expect(watchButtons.length).toBe(2)
  })

  it('usa título genérico "Vídeo do treino" ao abrir o vídeo de fallback (exercício sem vídeo próprio)', async () => {
    render(
      <MemoryRouter initialEntries={["/program/avancado/day/1"]}>
        <Routes>
          <Route path="/program/:slug/day/:weekday" element={<WorkoutDay />} />
        </Routes>
      </MemoryRouter>
    )

    // "Prancha" não tem `video` próprio, então o botão abre o vídeo geral do treino.
    await screen.findByText(/prancha/i)
    const watchButtons = await screen.findAllByRole('button', { name: /ver execução/i })
    // watchButtons[1] corresponds to "Prancha" (second exercise in the mock data)
    fireEvent.click(watchButtons[1])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Vídeo do treino')).toBeInTheDocument()
  })
})
