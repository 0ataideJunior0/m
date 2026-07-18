import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Subscribe from '../pages/Subscribe'

const { createSubscriptionMock, getHasActiveSubscriptionMock } = vi.hoisted(() => ({
  createSubscriptionMock: vi.fn(),
  getHasActiveSubscriptionMock: vi.fn(),
}))

vi.mock('../utils/subscription', () => ({
  createSubscription: createSubscriptionMock,
  getHasActiveSubscription: getHasActiveSubscriptionMock,
}))

const mockState: any = {
  user: { id: 'u1' },
  isAdmin: false,
  hasActiveSubscription: false,
  setHasActiveSubscription: vi.fn(),
}
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('Subscribe', () => {
  beforeEach(() => {
    mockState.isAdmin = false
    mockState.hasActiveSubscription = false
    mockState.setHasActiveSubscription = vi.fn()
    createSubscriptionMock.mockReset()
    getHasActiveSubscriptionMock.mockReset()
  })

  it('mostra o botão de assinar e redireciona pro checkout ao clicar', async () => {
    createSubscriptionMock.mockResolvedValueOnce({ initPoint: 'https://mp.example/checkout', error: null })
    const originalHref = window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, href: originalHref },
    })

    render(
      <MemoryRouter initialEntries={['/subscribe']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(screen.getByText('Assinar agora'))

    await waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout'))
  })

  it('ao voltar do checkout, confirma a assinatura e redireciona pra /home', async () => {
    getHasActiveSubscriptionMock.mockResolvedValueOnce(true)

    render(
      <MemoryRouter initialEntries={['/subscribe?preapproval_id=abc']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Home Page')).not.toBeNull()
    expect(mockState.setHasActiveSubscription).toHaveBeenCalledWith(true)
  })
})
