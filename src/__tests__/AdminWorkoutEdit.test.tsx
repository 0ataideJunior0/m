import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminWorkoutEdit from '../pages/admin/AdminWorkoutEdit'

const updateWorkoutAdminMock = vi.fn(async () => {})
const createWorkoutAdminMock = vi.fn(async () => ({ id: 'w-new' }))
const getWorkoutMock = vi.fn()

vi.mock('../utils/workouts', () => ({
  getProgramBySlug: vi.fn(async () => ({ id: 'p1', slug: 'avancado', name: 'Avançado', sort_order: 1, created_at: '' })),
  getWorkoutByProgramAndWeekday: (...args: unknown[]) => getWorkoutMock(...args),
}))

vi.mock('../utils/adminWorkouts', () => ({
  updateWorkoutAdmin: (...args: unknown[]) => updateWorkoutAdminMock(...args),
  createWorkoutAdmin: (...args: unknown[]) => createWorkoutAdminMock(...args),
  listWorkoutsForProgramAdmin: vi.fn(async () => [{ id: 'w1', weekday: 1 }, { id: 'w3', weekday: 3 }]),
}))

const workout = () => ({
  id: 'w1',
  program_id: 'p1',
  weekday: 1,
  title: 'Treino Dia 1',
  video_url: 'https://example.com/video.mp4',
  exercises: [
    { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' },
    { exercise: 'Stiff', reps: '10', sets: '4', type: 'normal' },
  ],
  created_at: '',
})

const renderPage = (path = '/admin/programs/avancado/day/1') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/programs/:slug/day/:weekday" element={<AdminWorkoutEdit />} />
        <Route path="/admin/programs/:slug" element={<div>Lista do programa</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  updateWorkoutAdminMock.mockClear()
  createWorkoutAdminMock.mockClear()
  getWorkoutMock.mockReset().mockImplementation(async () => workout())
})

describe('AdminWorkoutEdit', () => {
  it('mostra os exercícios recolhidos com resumo e salva as alterações', async () => {
    renderPage()

    const titleInput = await screen.findByDisplayValue('Treino Dia 1')
    expect(screen.getByText('Agachamento')).toBeInTheDocument()
    expect(screen.getByText('3 × 12')).toBeInTheDocument()
    expect(screen.getByText('Tudo salvo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeDisabled()

    fireEvent.change(titleInput, { target: { value: 'Treino Atualizado' } })
    expect(screen.getByText('Alterações não salvas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => {
      expect(updateWorkoutAdminMock).toHaveBeenCalledWith('w1', {
        title: 'Treino Atualizado',
        video_url: 'https://example.com/video.mp4',
        exercises: workout().exercises,
      })
    })
    expect(await screen.findByText('Tudo salvo')).toBeInTheDocument()
  })

  it('adicionar exercício abre o formulário dele, já com o foco no nome', async () => {
    renderPage()
    await screen.findByDisplayValue('Treino Dia 1')

    fireEvent.click(screen.getByRole('button', { name: /adicionar exercício/i }))

    const nameInputs = screen.getAllByLabelText('Nome do exercício')
    expect(nameInputs).toHaveLength(1)
    await waitFor(() => expect(nameInputs[0]).toHaveFocus())
  })

  it('não salva exercício sem nome e aponta qual é', async () => {
    renderPage()
    await screen.findByDisplayValue('Treino Dia 1')

    fireEvent.click(screen.getByRole('button', { name: /adicionar exercício/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    expect(await screen.findAllByText('Falta o nome do exercício.')).not.toHaveLength(0)
    expect(updateWorkoutAdminMock).not.toHaveBeenCalled()
  })

  it('reordena, edita o tipo e o bi-set pelo formulário do exercício', async () => {
    renderPage()
    await screen.findByDisplayValue('Treino Dia 1')

    fireEvent.click(screen.getByRole('button', { name: 'Mover Stiff para cima' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar Stiff' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Drop-set' }))
    fireEvent.change(screen.getByLabelText('Bi-set (opcional)'), { target: { value: 'b' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }))

    await waitFor(() => {
      expect(updateWorkoutAdminMock).toHaveBeenCalledWith('w1', expect.objectContaining({
        exercises: [
          { exercise: 'Stiff', reps: '10', sets: '4', type: 'drop_set', group: 'B' },
          { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal' },
        ],
      }))
    })
  })

  it('remover pode ser desfeito', async () => {
    renderPage()
    await screen.findByDisplayValue('Treino Dia 1')

    fireEvent.click(screen.getByRole('button', { name: 'Editar Agachamento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }))
    expect(screen.queryByRole('button', { name: 'Editar Agachamento' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /desfazer/i }))
    expect(screen.getByText('Agachamento')).toBeInTheDocument()
    expect(screen.getByText('Tudo salvo')).toBeInTheDocument()
  })

  it('pede confirmação antes de sair com alterações não salvas', async () => {
    renderPage()
    const titleInput = await screen.findByDisplayValue('Treino Dia 1')
    fireEvent.change(titleInput, { target: { value: 'Outro' } })

    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByText('Sair sem salvar?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sair sem salvar' }))
    expect(await screen.findByText('Lista do programa')).toBeInTheDocument()
  })

  it('troca de dia pela barra de dias e marca quais já têm treino', async () => {
    renderPage()
    await screen.findByDisplayValue('Treino Dia 1')

    expect(screen.getByRole('button', { name: 'Seg' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('button', { name: 'Ter (sem treino)' })).toBeInTheDocument()

    getWorkoutMock.mockResolvedValueOnce(null)
    fireEvent.click(screen.getByRole('button', { name: 'Ter (sem treino)' }))

    expect(await screen.findByRole('heading', { name: 'Terça-feira' })).toBeInTheDocument()
    expect(screen.getByText('Nenhum exercício ainda')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar treino' })).toBeInTheDocument()
  })
})
