import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminUserWeek from '../pages/admin/AdminUserWeek'

const listUserWeekAdminMock = vi.fn()
const copyProgramToUserAdminMock = vi.fn(async () => {})
const setHideCatalogAdminMock = vi.fn(async () => {})
const getHideCatalogAdminMock = vi.fn(async () => false)
const getUserProfileSummaryMock = vi.fn()

vi.mock('../utils/adminUsers', () => ({
  getUserProfileSummary: (...args: unknown[]) => getUserProfileSummaryMock(...args),
}))

vi.mock('../utils/adminWorkouts', () => ({
  listUserWeekAdmin: (...args: unknown[]) => listUserWeekAdminMock(...args),
  listProgramsAdmin: vi.fn(async () => [
    { id: 'p1', slug: 'avancado', name: 'Avançado', sort_order: 1, created_at: '' },
    { id: 'p2', slug: 'iniciante', name: 'Iniciante', sort_order: 2, created_at: '' },
  ]),
  copyProgramToUserAdmin: (...args: unknown[]) => copyProgramToUserAdminMock(...args),
  getHideCatalogAdmin: (...args: unknown[]) => getHideCatalogAdminMock(...args),
  setHideCatalogAdmin: (...args: unknown[]) => setHideCatalogAdminMock(...args),
}))

const day = (weekday: number, title: string, n = 2) => ({
  id: `w${weekday}`,
  weekday,
  user_id: 'u1',
  program_id: null,
  title,
  video_url: '',
  created_at: '',
  exercises: Array.from({ length: n }, (_, i) => ({ exercise: `Ex ${i}`, reps: '10' })),
})

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/users/u1/workout']}>
      <Routes>
        <Route path="/admin/users/:userId/workout" element={<AdminUserWeek />} />
        <Route path="/admin/users/:userId/workout/day/:weekday" element={<div>Editor do dia</div>} />
        <Route path="/admin/users" element={<div>Admin Users Page</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  getUserProfileSummaryMock.mockReset().mockResolvedValue({ id: 'u1', email: 'ana@example.com', username: 'Ana' })
  listUserWeekAdminMock.mockReset().mockResolvedValue([day(1, 'Inferiores'), day(3, 'Superiores', 1)])
  copyProgramToUserAdminMock.mockClear()
  setHideCatalogAdminMock.mockClear()
  getHideCatalogAdminMock.mockReset().mockResolvedValue(false)
})

describe('AdminUserWeek', () => {
  it('mostra os 7 dias, com treino ou descanso', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Semana de Ana' })).toBeInTheDocument()
    expect(screen.getByText('2 dias de treino · 5 de descanso')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Segunda-feira: Inferiores' })).toBeInTheDocument()
    expect(screen.getByText('1 exercício')).toBeInTheDocument()
    expect(screen.getAllByText('Descanso')).toHaveLength(5)
  })

  it('abre o editor do dia ao tocar nele', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('link', { name: 'Terça-feira: descanso' }))

    expect(await screen.findByText('Editor do dia')).toBeInTheDocument()
  })

  it('copia a semana de um programa, avisando que substitui a atual', async () => {
    listUserWeekAdminMock
      .mockResolvedValueOnce([day(1, 'Inferiores')])
      .mockResolvedValueOnce([day(1, 'Avançado Seg'), day(2, 'Avançado Ter')])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /copiar de um programa/i }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/será substituída/)
    expect(within(dialog).getByRole('button', { name: 'Escolha um programa' })).toBeDisabled()

    fireEvent.click(within(dialog).getByRole('radio', { name: 'Avançado' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copiar Avançado' }))

    await waitFor(() => expect(copyProgramToUserAdminMock).toHaveBeenCalledWith('u1', 'p1'))
    expect(await screen.findByRole('link', { name: 'Terça-feira: Avançado Ter' })).toBeInTheDocument()
  })

  it('liga e desliga o catálogo da aluna', async () => {
    renderPage()

    const toggle = await screen.findByRole('switch', { name: /esconder os programas do catálogo/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    await waitFor(() => expect(setHideCatalogAdminMock).toHaveBeenCalledWith('u1', true))
    expect(screen.getByText('Ana vê só a semana dela na tela inicial.')).toBeInTheDocument()
  })

  it('se salvar a preferência falhar, volta o interruptor e avisa', async () => {
    setHideCatalogAdminMock.mockRejectedValueOnce(new Error('rede'))
    renderPage()

    const toggle = await screen.findByRole('switch', { name: /esconder/i })
    fireEvent.click(toggle)

    expect(await screen.findByText(/Erro ao salvar/)).toBeInTheDocument()
    expect(toggle).toHaveAttribute('aria-checked', 'false')
  })
})
