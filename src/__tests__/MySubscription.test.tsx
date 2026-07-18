import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import MySubscription from '../pages/MySubscription'

const { getMySubscriptionMock, cancelSubscriptionMock } = vi.hoisted(() => ({
  getMySubscriptionMock: vi.fn(),
  cancelSubscriptionMock: vi.fn(),
}))

vi.mock('../utils/subscription', () => ({
  getMySubscription: getMySubscriptionMock,
  cancelSubscription: cancelSubscriptionMock,
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' } }),
}))

describe('MySubscription', () => {
  beforeEach(() => {
    getMySubscriptionMock.mockReset()
    cancelSubscriptionMock.mockReset()
    window.confirm = vi.fn(() => true)
    window.alert = vi.fn()
  })

  it('mostra o status e a próxima cobrança de uma assinatura ativa', async () => {
    getMySubscriptionMock.mockResolvedValueOnce({
      id: 's1',
      user_id: 'u1',
      preapproval_id: 'p1',
      status: 'authorized',
      next_payment_date: '2026-08-18T00:00:00.000Z',
      created_at: '',
      updated_at: '',
    })

    render(
      <MemoryRouter initialEntries={['/minha-assinatura']}>
        <Routes>
          <Route path="/minha-assinatura" element={<MySubscription />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Ativa')).not.toBeNull()
    expect(screen.getByText('Cancelar assinatura')).not.toBeNull()
  })

  it('cancela a assinatura ao confirmar', async () => {
    getMySubscriptionMock.mockResolvedValueOnce({
      id: 's1', user_id: 'u1', preapproval_id: 'p1', status: 'authorized',
      next_payment_date: null, created_at: '', updated_at: '',
    })
    cancelSubscriptionMock.mockResolvedValueOnce({ ok: true, error: null })
    getMySubscriptionMock.mockResolvedValueOnce({
      id: 's1', user_id: 'u1', preapproval_id: 'p1', status: 'cancelled',
      next_payment_date: null, created_at: '', updated_at: '',
    })

    render(
      <MemoryRouter initialEntries={['/minha-assinatura']}>
        <Routes>
          <Route path="/minha-assinatura" element={<MySubscription />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByText('Cancelar assinatura'))

    await waitFor(() => expect(cancelSubscriptionMock).toHaveBeenCalled())
    expect(await screen.findByText('Cancelada')).not.toBeNull()
  })

  it('mostra mensagem quando não há assinatura', async () => {
    getMySubscriptionMock.mockResolvedValueOnce(null)

    render(
      <MemoryRouter initialEntries={['/minha-assinatura']}>
        <Routes>
          <Route path="/minha-assinatura" element={<MySubscription />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Nenhuma assinatura encontrada.')).not.toBeNull()
  })
})
