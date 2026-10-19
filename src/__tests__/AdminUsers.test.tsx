import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import AdminUsers from '../pages/admin/AdminUsers'
import type { AdminUserSummary } from '../utils/adminUsers'

const { listNonAdminUsersMock, grantAccessMock } = vi.hoisted(() => ({
  listNonAdminUsersMock: vi.fn(),
  grantAccessMock: vi.fn(),
}))

vi.mock('../utils/adminUsers', () => ({
  listNonAdminUsers: listNonAdminUsersMock,
  grantAccess: grantAccessMock,
}))

const ana: AdminUserSummary = {
  id: 'u1',
  email: 'ana@example.com',
  username: 'Ana',
  created_at: '2026-01-01T00:00:00.000Z',
  completedDays: 5,
  access: { active: false, until: null, source: null },
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/admin/users" element={<AdminUsers />} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  listNonAdminUsersMock.mockReset().mockResolvedValue([ana])
  grantAccessMock.mockReset().mockResolvedValue({ accessUntil: '2027-01-19T12:00:00.000Z', error: null })
})

describe('AdminUsers', () => {
  it('lista usuárias com progresso e situação do acesso', async () => {
    listNonAdminUsersMock.mockResolvedValue([
      ana,
      {
        ...ana,
        id: 'u2',
        email: 'bea@example.com',
        username: null,
        access: { active: true, until: '2099-02-10T12:00:00.000Z', source: 'manual' },
      },
    ])
    renderPage()

    expect(await screen.findByText('ana@example.com')).not.toBeNull()
    expect(screen.getAllByText('5/30')).toHaveLength(2)
    expect(screen.getByText('Sem acesso')).toBeInTheDocument()
    expect(screen.getByText(/Ativo até 10\/02\/2099/)).toBeInTheDocument()
    expect(screen.getByText('liberado')).toBeInTheDocument()
  })

  it('libera os meses escolhidos com a anotação e recarrega a lista', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /liberar acesso para ana@example.com/i }))
    expect(screen.getByText('O acesso começa a contar a partir de hoje.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: '3 meses' }))
    fireEvent.change(screen.getByLabelText(/anotação/i), { target: { value: 'Pago em dinheiro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Liberar 3 meses' }))

    await waitFor(() => expect(grantAccessMock).toHaveBeenCalledWith('u1', 3, 'Pago em dinheiro'))
    expect(await screen.findByText(/liberado até 19\/01\/2027/)).toBeInTheDocument()
    expect(listNonAdminUsersMock).toHaveBeenCalledTimes(2)
  })

  it('avisa que os meses entram depois do acesso que ainda está valendo', async () => {
    listNonAdminUsersMock.mockResolvedValue([
      { ...ana, access: { active: true, until: '2099-03-01T12:00:00.000Z', source: 'pix' } },
    ])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /liberar acesso para/i }))

    expect(screen.getByText(/entram depois do acesso atual, que vai até 01\/03\/2099/)).toBeInTheDocument()
  })

  it('mostra o erro da API quando a liberação falha', async () => {
    grantAccessMock.mockResolvedValue({ accessUntil: null, error: 'Não foi possível liberar o acesso' })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /liberar acesso para/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Liberar 1 mês' }))

    expect(await screen.findByText('Não foi possível liberar o acesso')).toBeInTheDocument()
  })

  it('com assinatura ativa no cartão, explica e não deixa liberar', async () => {
    listNonAdminUsersMock.mockResolvedValue([
      { ...ana, access: { active: true, until: '2099-01-01T00:00:00.000Z', source: 'preapproval' } },
    ])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: /liberar acesso para/i }))

    expect(screen.getByRole('alert')).toHaveTextContent(/assinatura ativa no cartão/i)
    expect(screen.getByRole('button', { name: 'Liberar 1 mês' })).toBeDisabled()
  })
})
