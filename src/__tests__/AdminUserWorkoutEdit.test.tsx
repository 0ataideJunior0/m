import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminUserWorkoutEdit from '../pages/admin/AdminUserWorkoutEdit'

const getUserProfileSummaryMock = vi.fn(async () => ({ id: 'u1', email: 'ana@example.com', username: 'Ana' }))
const getUserWorkoutMock = vi.fn(async () => ({
  id: 'w1',
  program_id: null,
  weekday: null,
  user_id: 'u1',
  title: 'Treino da Ana',
  video_url: 'https://example.com/video.mp4',
  exercises: [{ exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }],
  created_at: '',
}))
const saveUserWorkoutAdminMock = vi.fn(async () => ({ id: 'w1' }))
const deleteUserWorkoutAdminMock = vi.fn(async () => {})

vi.mock('../utils/adminUsers', () => ({
  getUserProfileSummary: (...args: unknown[]) => getUserProfileSummaryMock(...args),
}))

vi.mock('../utils/adminWorkouts', () => ({
  getUserWorkout: (...args: unknown[]) => getUserWorkoutMock(...args),
  saveUserWorkoutAdmin: (...args: unknown[]) => saveUserWorkoutAdminMock(...args),
  deleteUserWorkoutAdmin: (...args: unknown[]) => deleteUserWorkoutAdminMock(...args),
}))

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/users/u1/workout']}>
      <Routes>
        <Route path="/admin/users/:userId/workout" element={<AdminUserWorkoutEdit />} />
        <Route path="/admin/users" element={<div>Admin Users Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('AdminUserWorkoutEdit', () => {
  it('carrega o treino pessoal existente e salva as alterações', async () => {
    renderPage()

    await screen.findByText(/Editar treino pessoal.*Ana/)
    const titleInput = await screen.findByDisplayValue('Treino da Ana')
    fireEvent.change(titleInput, { target: { value: 'Treino Atualizado' } })

    fireEvent.click(screen.getByText('Salvar alterações'))

    await waitFor(() => {
      expect(saveUserWorkoutAdminMock).toHaveBeenCalledWith('u1', 'w1', {
        title: 'Treino Atualizado',
        video_url: 'https://example.com/video.mp4',
        exercises: [{ exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }],
      })
    })
  })

  it('não mostra o campo de Grupo (bi-set) — treino pessoal não agrupa', async () => {
    renderPage()

    await screen.findByDisplayValue('Treino da Ana')
    expect(screen.queryByPlaceholderText(/grupo/i)).toBeNull()
  })

  it('redireciona pra /admin/users quando a usuária não existe', async () => {
    getUserProfileSummaryMock.mockResolvedValueOnce(null as any)
    renderPage()

    expect(await screen.findByText('Admin Users Page')).toBeInTheDocument()
  })

  it('mostra "Criar treino" e não o botão de remover quando ainda não existe treino pessoal', async () => {
    getUserWorkoutMock.mockResolvedValueOnce(null as any)
    renderPage()

    await screen.findByText(/Criar treino pessoal/)
    expect(screen.getByText('Criar treino')).toBeInTheDocument()
    expect(screen.queryByText(/remover treino pessoal/i)).toBeNull()
  })

  it('remove o treino pessoal ao clicar em "Remover treino pessoal"', async () => {
    renderPage()

    await screen.findByDisplayValue('Treino da Ana')
    fireEvent.click(screen.getByText(/remover treino pessoal/i))

    await waitFor(() => {
      expect(deleteUserWorkoutAdminMock).toHaveBeenCalledWith('w1')
    })
  })
})
