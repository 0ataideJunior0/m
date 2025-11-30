import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WorkoutDay from '../pages/WorkoutDay'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('../utils/workouts', () => ({
  getWorkoutByDay: vi.fn(async () => ({
    id: 'w1',
    day_number: 1,
    title: 'Treino A',
    video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    created_at: new Date().toISOString(),
    exercises: [
      { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal', video: 'https://www.youtube.com/shorts/TVPuN30d9vQ' },
      { exercise: 'Prancha', reps: '30s', sets: '3', type: 'core' },
    ],
  })),
  markDayComplete: vi.fn(async () => true),
  getUserProgress: vi.fn(async () => []),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true })
}))

describe('WorkoutDay videos', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('abre modal e carrega iframe ao clicar no exercício com vídeo', async () => {
    render(
      <MemoryRouter initialEntries={["/workout/1"]}>
        <Routes>
          <Route path="/workout/:day" element={<WorkoutDay />} />
        </Routes>
      </MemoryRouter>
    )

    const card = await screen.findByText(/agachamento/i)
    fireEvent.click(card)

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    const iframe = dialog.querySelector('iframe')
    expect(iframe).not.toBeNull()
  })
})
