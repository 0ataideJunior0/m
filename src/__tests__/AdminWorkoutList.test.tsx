import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminWorkoutList from '../pages/admin/AdminWorkoutList'

vi.mock('../utils/workouts', () => ({
  getProgramBySlug: vi.fn(async () => ({ id: 'p1', slug: 'avancado', name: 'Avançado', sort_order: 1, created_at: '' })),
}))

vi.mock('../utils/adminWorkouts', () => ({
  listWorkoutsForProgramAdmin: vi.fn(async () => ([
    { id: 'w1', program_id: 'p1', weekday: 1, title: 'Treino Dia 1', video_url: '', exercises: [{ exercise: 'A', reps: '10' }], created_at: '' },
    { id: 'w2', program_id: 'p1', weekday: 2, title: 'Treino Dia 2', video_url: '', exercises: [], created_at: '' },
  ])),
}))

describe('AdminWorkoutList', () => {
  it('lista os dias do programa com link para edição', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/programs/avancado']}>
        <Routes>
          <Route path="/admin/programs/:slug" element={<AdminWorkoutList />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Treino Dia 1')).not.toBeNull()
    const link = screen.getByText('Treino Dia 1').closest('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/admin/programs/avancado/day/1')
  })
})
