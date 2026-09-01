import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Subscribe from '../pages/Subscribe'

const { createSubscriptionMock, getHasActiveSubscriptionMock, createPixPaymentMock } = vi.hoisted(() => ({
  createSubscriptionMock: vi.fn(),
  getHasActiveSubscriptionMock: vi.fn(),
  createPixPaymentMock: vi.fn(),
}))

vi.mock('../utils/subscription', () => ({
  createSubscription: createSubscriptionMock,
  getHasActiveSubscription: getHasActiveSubscriptionMock,
}))

vi.mock('../utils/pixPayment', () => ({
  createPixPayment: createPixPaymentMock,
}))

const mockState: any = {
  user: { id: 'u1' },
  isAdmin: false,
  hasActiveSubscription: false,
  needsOnboarding: false,
  setHasActiveSubscription: vi.fn(),
}
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('Subscribe', () => {
  beforeEach(() => {
    mockState.isAdmin = false
    mockState.hasActiveSubscription = false
    mockState.needsOnboarding = false
    mockState.setHasActiveSubscription = vi.fn()
    createSubscriptionMock.mockReset()
    getHasActiveSubscriptionMock.mockReset()
    createPixPaymentMock.mockReset()
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

  it('ao voltar do checkout com onboarding pendente, redireciona pro onboarding em vez da home', async () => {
    mockState.needsOnboarding = true
    getHasActiveSubscriptionMock.mockResolvedValueOnce(true)

    render(
      <MemoryRouter initialEntries={['/subscribe?preapproval_id=abc']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
  })
})

describe('Subscribe — pagamento via Pix', () => {
  beforeEach(() => {
    mockState.isAdmin = false
    mockState.hasActiveSubscription = false
    mockState.needsOnboarding = false
    mockState.setHasActiveSubscription = vi.fn()
    createSubscriptionMock.mockReset()
    getHasActiveSubscriptionMock.mockReset()
    createPixPaymentMock.mockReset()
  })

  const renderSubscribe = () =>
    render(
      <MemoryRouter initialEntries={['/subscribe']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )

  it('oferece os dois planos de Pix junto com o cartão', () => {
    renderSubscribe()

    expect(screen.getByText('Assinar agora')).not.toBeNull()
    expect(screen.getByText('1 mês')).not.toBeNull()
    expect(screen.getByText('3 meses')).not.toBeNull()
  })

  it('mostra o QR Code e o código copia e cola depois de gerar a cobrança', async () => {
    createPixPaymentMock.mockResolvedValueOnce({
      charge: {
        payment_id: '123',
        qr_code: '00020126-codigo-pix-copia-e-cola',
        qr_code_base64: 'iVBORw0KGgo=',
        amount: 149.9,
        months: 3,
      },
      error: null,
    })
    getHasActiveSubscriptionMock.mockResolvedValue(false)

    renderSubscribe()
    fireEvent.click(screen.getByText(/Pagar R\$\s*149,90/))

    expect(await screen.findByText('00020126-codigo-pix-copia-e-cola')).not.toBeNull()
    expect(screen.getByAltText('QR Code do Pix')).not.toBeNull()
    expect(createPixPaymentMock).toHaveBeenCalledWith('trimestral')
  })

  it('avisa quando não dá para gerar a cobrança, em vez de travar na tela', async () => {
    createPixPaymentMock.mockResolvedValueOnce({
      charge: null,
      error: 'Você já tem uma assinatura ativa no cartão.',
    })

    renderSubscribe()
    fireEvent.click(screen.getByText(/Pagar R\$\s*59,90/))

    expect(await screen.findByText('Você já tem uma assinatura ativa no cartão.')).not.toBeNull()
  })
})
