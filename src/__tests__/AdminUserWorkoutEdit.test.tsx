import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminUserWorkoutEdit from '../pages/admin/AdminUserWorkoutEdit'

const getUserProfileSummaryMock = vi.fn()
const getUserWorkoutForDayMock = vi.fn()
const saveUserWorkoutAdminMock = vi.fn(async () => ({ id: 'w1' }))
const deleteUserWorkoutAdminMock = vi.fn(async () => {})

vi.mock('../utils/adminUsers', () => ({
  getUserProfileSummary: (...args: unknown[]) => getUserProfileSummaryMock(...args),
}))

vi.mock('../utils/adminWorkouts', () => ({
  getUserWorkoutForDay: (...args: unknown[]) => getUserWorkoutForDayMock(...args),
  listUserWeekAdmin: vi.fn(async () => [{ id: 'w1', weekday: 1 }]),
  saveUserWorkoutAdmin: (...args: unknown[]) => saveUserWorkoutAdminMock(...args),
  deleteUserWorkoutAdmin: (...args: unknown[]) => deleteUserWorkoutAdminMock(...args),
}))

const monday = () => ({
  id: 'w1',
  program_id: null,
  weekday: 1,
  user_id: 'u1',
  title: 'Treino da Ana',
  video_url: 'https://example.com/video.mp4',
  exercises: [{ exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }],
  created_at: '',
})

const renderPage = (weekday = 1) =>
  render(
    <MemoryRouter initialEntries={[`/admin/users/u1/workout/day/${weekday}`]}>
      <Routes>
        <Route path="/admin/users/:userId/workout/day/:weekday" element={<AdminUserWorkoutEdit />} />
        <Route path="/admin/users/:userId/workout" element={<div>Semana Page</div>} />
        <Route path="/admin/users" element={<div>Admin Users Page</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  getUserProfileSummaryMock.mockReset().mockResolvedValue({ id: 'u1', email: 'ana@example.com', username: 'Ana' })
  getUserWorkoutForDayMock.mockReset().mockImplementation(async (_u: string, d: number) => (d === 1 ? monday() : null))
  saveUserWorkoutAdminMock.mockClear()
  deleteUserWorkoutAdminMock.mockClear()
})

describe('AdminUserWorkoutEdit (dia da semana pessoal)', () => {
  it('carrega o treino do dia e salva com o dia da semana', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Segunda-feira' })).toBeInTheDocument()
    expect(screen.getByText(/Semana de Ana/)).toBeInTheDocument()
    fireEvent.change(screen.getByDisplayValue('Treino da Ana'), { target: { value: 'Treino Atualizado' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => {
      expect(saveUserWorkoutAdminMock).toHaveBeenCalledWith('u1', 1, 'w1', {
        title: 'Treino Atualizado',
        video_url: 'https://example.com/video.mp4',
        exercises: [{ exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' }],
      })
    })
  })

  it('dia de descanso abre vazio, pronto para criar', async () => {
    renderPage(3)

    expect(await screen.findByRole('heading', { name: 'Quarta-feira' })).toBeInTheDocument()
    expect(screen.getByText('Nenhum exercício ainda')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar treino' })).toBeInTheDocument()
    expect(screen.queryByText(/transformar em descanso/i)).toBeNull()
  })

  it('tem a barra de dias e o campo de bi-set (o app da aluna agrupa bi-sets)', async () => {
    renderPage()

    await screen.findByDisplayValue('Treino da Ana')
    expect(screen.getByRole('navigation', { name: /dias/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Editar Agachamento' }))
    expect(screen.getByLabelText('Bi-set (opcional)')).toBeInTheDocument()
  })

  it('redireciona pra /admin/users quando a usuária não existe', async () => {
    getUserProfileSummaryMock.mockResolvedValue(null)
    renderPage()

    expect(await screen.findByText('Admin Users Page')).toBeInTheDocument()
  })

  it('transforma o dia em descanso só depois de confirmar', async () => {
    renderPage()

    await screen.findByDisplayValue('Treino da Ana')
    fireEvent.click(screen.getByRole('button', { name: /transformar em descanso/i }))
    expect(deleteUserWorkoutAdminMock).not.toHaveBeenCalled()

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Remover' }))

    await waitFor(() => expect(deleteUserWorkoutAdminMock).toHaveBeenCalledWith('w1'))
    expect(await screen.findByRole('button', { name: 'Criar treino' })).toBeInTheDocument()
  })
})
