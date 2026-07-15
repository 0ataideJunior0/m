import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminWorkoutEdit from '../pages/admin/AdminWorkoutEdit'

const updateWorkoutAdminMock = vi.fn(async () => {})

vi.mock('../utils/workouts', () => ({
  getWorkoutByDay: vi.fn(async () => ({
    id: 'w1',
    day_number: 1,
    title: 'Treino Dia 1',
    video_url: 'https://example.com/video.mp4',
    exercises: [
      { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' },
    ],
    created_at: '',
  })),
}))

vi.mock('../utils/adminWorkouts', () => ({
  updateWorkoutAdmin: (...args: unknown[]) => updateWorkoutAdminMock(...args),
}))

describe('AdminWorkoutEdit', () => {
  it('carrega o treino e salva as alterações', async () => {
    window.alert = vi.fn()

    render(
      <MemoryRouter initialEntries={['/admin/workouts/1']}>
        <Routes>
          <Route path="/admin/workouts/:day" element={<AdminWorkoutEdit />} />
        </Routes>
      </MemoryRouter>
    )

    const titleInput = await screen.findByDisplayValue('Treino Dia 1')
    fireEvent.change(titleInput, { target: { value: 'Treino Atualizado' } })

    fireEvent.click(screen.getByText('Salvar alterações'))

    await waitFor(() => {
      expect(updateWorkoutAdminMock).toHaveBeenCalledWith(1, {
        title: 'Treino Atualizado',
        video_url: 'https://example.com/video.mp4',
        exercises: [{ exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }],
      })
    })
  })

  it('adiciona um novo exercício vazio ao clicar em Adicionar exercício', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/workouts/1']}>
        <Routes>
          <Route path="/admin/workouts/:day" element={<AdminWorkoutEdit />} />
        </Routes>
      </MemoryRouter>
    )

    await screen.findByDisplayValue('Treino Dia 1')
    const before = screen.getAllByPlaceholderText('Nome do exercício').length
    fireEvent.click(screen.getByText('Adicionar exercício'))
    const after = screen.getAllByPlaceholderText('Nome do exercício').length
    expect(after).toBe(before + 1)
  })
})
