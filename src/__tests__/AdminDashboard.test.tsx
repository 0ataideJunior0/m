import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminDashboard from '../pages/admin/AdminDashboard'

const { listNonAdminUsersMock } = vi.hoisted(() => ({ listNonAdminUsersMock: vi.fn() }))

vi.mock('../utils/adminUsers', () => ({ listNonAdminUsers: listNonAdminUsersMock }))

const overdue = (id: string, username: string) => ({
  id,
  email: `${id}@example.com`,
  username,
  created_at: '2026-01-01T00:00:00.000Z',
  completedDays: 0,
  access: {
    active: false,
    until: new Date(Date.now() - 8 * 86400000).toISOString(),
    source: 'preapproval',
    status: 'authorized',
  },
})

const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<div>Users Page</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  listNonAdminUsersMock.mockReset().mockResolvedValue([])
})

describe('AdminDashboard', () => {
  it('alerta quando há cobrança do cartão atrasada e leva às usuárias', async () => {
    listNonAdminUsersMock.mockResolvedValue([overdue('u1', 'Juh'), overdue('u2', 'Elice')])
    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: /2 cobranças do cartão atrasadas/i }))

    expect(screen.getByText('Users Page')).toBeInTheDocument()
  })

  it('sem atraso não mostra alerta', async () => {
    renderDashboard()

    await waitFor(() => expect(listNonAdminUsersMock).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /atrasad/i })).toBeNull()
  })

  it('se não conseguir consultar, o painel continua funcionando', async () => {
    listNonAdminUsersMock.mockRejectedValue(new Error('rede'))
    renderDashboard()

    await waitFor(() => expect(listNonAdminUsersMock).toHaveBeenCalled())
    expect(screen.getByText('Treinos')).toBeInTheDocument()
  })

  it('navega para /admin/programs ao clicar em Treinos', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/programs" element={<div>Workouts Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Treinos'))
    expect(screen.getByText('Workouts Page')).not.toBeNull()
  })

  it('navega para /admin/users ao clicar em Usuárias', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<div>Users Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Usuárias'))
    expect(screen.getByText('Users Page')).not.toBeNull()
  })

  it('navega para /admin/funnel ao clicar em Funil', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/funnel" element={<div>Funnel Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Funil'))
    expect(screen.getByText('Funnel Page')).not.toBeNull()
  })
})
