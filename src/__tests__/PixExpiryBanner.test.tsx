import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PixExpiryBanner from '../components/PixExpiryBanner'

const { getMySubscriptionMock } = vi.hoisted(() => ({ getMySubscriptionMock: vi.fn() }))

vi.mock('../utils/subscription', () => ({ getMySubscription: getMySubscriptionMock }))

const FAKE_USER = { id: 'u1' }
vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: FAKE_USER }),
}))

const pixSub = (nextPaymentDate: string) => ({
  id: 's1',
  user_id: 'u1',
  preapproval_id: null,
  payment_id: 'pay-1',
  source: 'pix',
  status: 'authorized',
  next_payment_date: nextPaymentDate,
  created_at: '',
  updated_at: '',
})

const renderBanner = () =>
  render(
    <MemoryRouter>
      <PixExpiryBanner />
    </MemoryRouter>
  )

describe('PixExpiryBanner', () => {
  beforeEach(() => {
    getMySubscriptionMock.mockReset()
    vi.useRealTimers()
  })

  it('avisa quando o acesso via Pix está perto de vencer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
    getMySubscriptionMock.mockResolvedValueOnce(pixSub('2026-08-22T12:00:00.000Z'))

    renderBanner()

    expect(await screen.findByText(/vence em 3 dias/)).not.toBeNull()
    expect(screen.getByText('Renovar')).not.toBeNull()
  })

  it('fica calado quando o vencimento ainda está longe', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
    getMySubscriptionMock.mockResolvedValueOnce(pixSub('2026-11-19T12:00:00.000Z'))

    const { container } = renderBanner()
    await vi.waitFor(() => expect(getMySubscriptionMock).toHaveBeenCalled())

    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('fica calado para assinatura no cartão, que renova sozinha', async () => {
    getMySubscriptionMock.mockResolvedValueOnce({
      ...pixSub('2026-08-20T12:00:00.000Z'),
      source: 'preapproval',
      preapproval_id: 'pa-1',
      payment_id: null,
    })

    const { container } = renderBanner()
    await vi.waitFor(() => expect(getMySubscriptionMock).toHaveBeenCalled())

    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('fica calado quando não há assinatura nenhuma', async () => {
    getMySubscriptionMock.mockResolvedValueOnce(null)

    const { container } = renderBanner()
    await vi.waitFor(() => expect(getMySubscriptionMock).toHaveBeenCalled())

    expect(container.querySelector('[role="status"]')).toBeNull()
  })
})
