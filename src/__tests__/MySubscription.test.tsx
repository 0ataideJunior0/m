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

  it('pede o motivo antes de cancelar, e envia motivo e comentário ao confirmar', async () => {
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

    // sem motivo selecionado, o botão de confirmação fica desabilitado
    const confirmButton = await screen.findByText('Confirmar cancelamento')
    expect(confirmButton.closest('button')).toBeDisabled()

    fireEvent.click(screen.getByText('O preço'))
    fireEvent.change(screen.getByLabelText('Quer contar mais? (opcional)'), {
      target: { value: 'Achei caro pro que uso' },
    })
    fireEvent.click(confirmButton)

    await waitFor(() =>
      expect(cancelSubscriptionMock).toHaveBeenCalledWith('preco', 'Achei caro pro que uso')
    )
    expect(await screen.findByText('Cancelada')).not.toBeNull()
  })

  it('mostra "Acesso liberado até" quando cancelada mas o período pago ainda não acabou', async () => {
    const future = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    getMySubscriptionMock.mockResolvedValueOnce({
      id: 's1', user_id: 'u1', preapproval_id: 'p1', status: 'cancelled',
      next_payment_date: future, created_at: '', updated_at: '',
    })

    render(
      <MemoryRouter initialEntries={['/minha-assinatura']}>
        <Routes>
          <Route path="/minha-assinatura" element={<MySubscription />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Acesso liberado até')).not.toBeNull()
    expect(screen.queryByText('Cancelar assinatura')).toBeNull()
  })

  it('para acesso via Pix, mostra a data de fim e oferece renovar em vez de cancelar', async () => {
    getMySubscriptionMock.mockResolvedValueOnce({
      id: 's1', user_id: 'u1', preapproval_id: null, payment_id: 'pay-1', source: 'pix',
      status: 'authorized', next_payment_date: '2026-11-19T12:00:00.000Z', created_at: '', updated_at: '',
    })

    render(
      <MemoryRouter initialEntries={['/minha-assinatura']}>
        <Routes>
          <Route path="/minha-assinatura" element={<MySubscription />} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Acesso via Pix')).not.toBeNull()
    expect(screen.getByText('Acesso liberado até')).not.toBeNull()
    // cancelar não faz sentido no Pix: não há cobrança recorrente para interromper
    expect(screen.queryByText('Cancelar assinatura')).toBeNull()
    expect(screen.getByText('Renovar acesso')).not.toBeNull()
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
