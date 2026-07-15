import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminWorkoutList from '../pages/admin/AdminWorkoutList'

vi.mock('../utils/adminWorkouts', () => ({
  listWorkoutsAdmin: vi.fn(async () => ([
    { id: 'w1', day_number: 1, title: 'Treino Dia 1', video_url: '', exercises: [{ exercise: 'A', reps: '10' }], created_at: '' },
    { id: 'w2', day_number: 2, title: 'Treino Dia 2', video_url: '', exercises: [], created_at: '' },
  ])),
}))

describe('AdminWorkoutList', () => {
  it('lista os treinos com link para edição', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/workouts']}>
        <Routes>
          <Route path="/admin/workouts" element={<AdminWorkoutList />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Treino Dia 1')).not.toBeNull()
    const link = screen.getByText('Treino Dia 1').closest('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/admin/workouts/1')
  })
})
