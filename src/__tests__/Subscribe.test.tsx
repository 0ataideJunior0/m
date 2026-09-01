import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Subscribe from '../pages/Subscribe'

const { createSubscriptionMock, getHasActiveSubscriptionMock, getMySubscriptionMock, createPixPaymentMock } =
  vi.hoisted(() => ({
    createSubscriptionMock: vi.fn(),
    getHasActiveSubscriptionMock: vi.fn(),
    getMySubscriptionMock: vi.fn(),
    createPixPaymentMock: vi.fn(),
  }))

vi.mock('../utils/subscription', () => ({
  createSubscription: createSubscriptionMock,
  getHasActiveSubscription: getHasActiveSubscriptionMock,
  getMySubscription: getMySubscriptionMock,
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

describe('Subscribe — renovação de acesso via Pix', () => {
  beforeEach(() => {
    mockState.isAdmin = false
    mockState.needsOnboarding = false
    mockState.setHasActiveSubscription = vi.fn()
    createSubscriptionMock.mockReset()
    getHasActiveSubscriptionMock.mockReset()
    getMySubscriptionMock.mockReset()
    createPixPaymentMock.mockReset()
  })

  const renderAt = (entry: string) =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )

  // Quem renova ainda tem acesso ativo. Sem a intenção explícita de renovar, o
  // guard que impede assinatura dupla expulsava a pessoa de volta pra Home e
  // tornava a renovação impossível.
  it('deixa renovar quem ainda tem acesso ativo, quando a intenção é explícita', async () => {
    mockState.hasActiveSubscription = true

    renderAt('/subscribe?renovar=1')

    expect(await screen.findByText('3 meses')).not.toBeNull()
    expect(screen.queryByText('Home Page')).toBeNull()
  })

  it('continua expulsando quem já tem acesso e chegou sem intenção de renovar', async () => {
    mockState.hasActiveSubscription = true

    renderAt('/subscribe')

    expect(await screen.findByText('Home Page')).not.toBeNull()
  })

  it('espera o pagamento NOVO ser gravado, e não some da tela só porque o acesso ainda vale', async () => {
    mockState.hasActiveSubscription = true
    createPixPaymentMock.mockResolvedValueOnce({
      charge: { payment_id: 'novo-999', qr_code: 'codigo', qr_code_base64: 'b64', amount: 149.9, months: 3 },
      error: null,
    })
    // assinatura ainda aponta pro pagamento ANTERIOR
    getMySubscriptionMock.mockResolvedValue({ payment_id: 'antigo-111' })

    renderAt('/subscribe?renovar=1')
    fireEvent.click(await screen.findByText(/Pagar R\$\s*149,90/))

    expect(await screen.findByText('codigo')).not.toBeNull()
    await waitFor(() => expect(getMySubscriptionMock).toHaveBeenCalled())
    // segue esperando: o pagamento novo ainda não chegou
    expect(screen.queryByText('Home Page')).toBeNull()
    expect(getHasActiveSubscriptionMock).not.toHaveBeenCalled()
  })
})

describe('Subscribe — plano de verificação restrito a admin', () => {
  beforeEach(() => {
    mockState.hasActiveSubscription = false
    mockState.needsOnboarding = false
    mockState.setHasActiveSubscription = vi.fn()
    createSubscriptionMock.mockReset()
    getHasActiveSubscriptionMock.mockReset()
    getMySubscriptionMock.mockReset()
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

  it('não mostra o plano de um centavo para usuária comum', () => {
    mockState.isAdmin = false
    renderSubscribe()

    expect(screen.getByText('1 mês')).not.toBeNull()
    expect(screen.queryByText('Verificação (admin)')).toBeNull()
  })

  // Admin não pode ser redirecionado daqui: /subscribe é onde ele roda a
  // verificação de R$ 0,01 depois de mexer em dominio, credencial ou webhook.
  it('mostra o plano de verificação para admin, sem redirecioná-lo para a Home', async () => {
    mockState.isAdmin = true
    renderSubscribe()

    expect(await screen.findByText('Verificação (admin)')).not.toBeNull()
    expect(screen.queryByText('Home Page')).toBeNull()
  })
})
