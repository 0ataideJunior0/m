import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
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

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString()

const ana: AdminUserSummary = {
  id: 'u1',
  email: 'ana@example.com',
  username: 'Ana',
  created_at: '2026-01-15T12:00:00.000Z',
  completedDays: 5,
  access: { active: false, until: null, source: null },
}
const bia: AdminUserSummary = {
  ...ana,
  id: 'u2',
  email: 'bia@example.com',
  username: 'Bia',
  access: { active: true, until: inDays(3), source: 'pix' },
}
const carla: AdminUserSummary = {
  ...ana,
  id: 'u3',
  email: 'carla@example.com',
  username: 'Carla',
  access: { active: true, until: '2099-02-10T12:00:00.000Z', source: 'manual' },
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/admin/users" element={<AdminUsers />} />
      </Routes>
    </MemoryRouter>
  )

const filterButton = (name: RegExp) => within(screen.getByRole('group', { name: /filtrar/i })).getByRole('button', { name })

beforeEach(() => {
  listNonAdminUsersMock.mockReset().mockResolvedValue([ana, bia, carla])
  grantAccessMock.mockReset().mockResolvedValue({ accessUntil: '2027-01-19T12:00:00.000Z', error: null })
})

describe('AdminUsers', () => {
  it('mostra cada aluna com status, treinos e origem do acesso, e as contagens por situação', async () => {
    renderPage()

    expect(await screen.findByText('carla@example.com')).toBeInTheDocument()
    expect(screen.getByText('Ativa até 10/02/2099')).toBeInTheDocument()
    expect(screen.getByText('Vence em 3 dias')).toBeInTheDocument()
    expect(screen.getAllByText(/5 treinos/)).toHaveLength(3)
    expect(screen.getByText(/liberado pela equipe/)).toBeInTheDocument()
    expect(screen.getByText('3 cadastradas · 2 com acesso')).toBeInTheDocument()

    expect(filterButton(/todas/i)).toHaveTextContent('3')
    expect(filterButton(/vencendo/i)).toHaveTextContent('1')
    expect(filterButton(/sem acesso/i)).toHaveTextContent('1')
  })

  it('o filtro Vencendo mostra só quem está pra vencer', async () => {
    renderPage()
    await screen.findByText('ana@example.com')

    fireEvent.click(filterButton(/vencendo/i))

    expect(filterButton(/vencendo/i)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('bia@example.com')).toBeInTheDocument()
    expect(screen.queryByText('ana@example.com')).toBeNull()
    expect(screen.queryByText('carla@example.com')).toBeNull()
  })

  it('busca por nome ou e-mail e oferece limpar quando nada bate', async () => {
    renderPage()
    await screen.findByText('ana@example.com')
    const search = screen.getByLabelText(/buscar aluna/i)

    fireEvent.change(search, { target: { value: 'carla' } })
    expect(screen.getByText('carla@example.com')).toBeInTheDocument()
    expect(screen.queryByText('ana@example.com')).toBeNull()

    fireEvent.change(search, { target: { value: 'ninguém' } })
    expect(screen.getByText('Nenhuma aluna encontrada.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /limpar busca/i }))
    expect(screen.getByText('ana@example.com')).toBeInTheDocument()
  })

  it('libera os meses escolhidos com a anotação e recarrega a lista', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Liberar acesso para Ana' }))
    expect(screen.getByText('O acesso começa a contar a partir de hoje.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: '3 meses' }))
    fireEvent.change(screen.getByLabelText(/anotação/i), { target: { value: 'Pago em dinheiro' } })
    fireEvent.click(screen.getByRole('button', { name: 'Liberar 3 meses' }))

    await waitFor(() => expect(grantAccessMock).toHaveBeenCalledWith('u1', 3, 'Pago em dinheiro'))
    expect(await screen.findByText(/Ana liberado até 19\/01\/2027/)).toBeInTheDocument()
    expect(listNonAdminUsersMock).toHaveBeenCalledTimes(2)
  })

  it('avisa que os meses entram depois do acesso que ainda está valendo', async () => {
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Liberar acesso para Carla' }))

    expect(screen.getByText(/entram depois do acesso atual, que vai até 10\/02\/2099/)).toBeInTheDocument()
  })

  it('mostra o erro da API quando a liberação falha', async () => {
    grantAccessMock.mockResolvedValue({ accessUntil: null, error: 'Não foi possível liberar o acesso' })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Liberar acesso para Ana' }))
    fireEvent.click(screen.getByRole('button', { name: 'Liberar 1 mês' }))

    expect(await screen.findByText('Não foi possível liberar o acesso')).toBeInTheDocument()
  })

  it('com assinatura ativa no cartão, explica e não deixa liberar', async () => {
    listNonAdminUsersMock.mockResolvedValue([
      { ...ana, access: { active: true, until: '2099-01-01T12:00:00.000Z', source: 'preapproval' } },
    ])
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Liberar acesso para Ana' }))

    expect(screen.getByRole('alert')).toHaveTextContent(/assinatura ativa no cartão/i)
    expect(screen.getByRole('button', { name: 'Liberar 1 mês' })).toBeDisabled()
  })
})
