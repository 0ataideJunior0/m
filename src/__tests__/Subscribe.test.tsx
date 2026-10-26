import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Subscribe from '../pages/Subscribe'

const { getHasActiveSubscriptionMock, getMySubscriptionMock, createPixPaymentMock, createCardPaymentMock } =
  vi.hoisted(() => ({
    getHasActiveSubscriptionMock: vi.fn(),
    getMySubscriptionMock: vi.fn(),
    createPixPaymentMock: vi.fn(),
    createCardPaymentMock: vi.fn(),
  }))

vi.mock('../utils/subscription', () => ({
  getHasActiveSubscription: getHasActiveSubscriptionMock,
  getMySubscription: getMySubscriptionMock,
}))

vi.mock('../utils/pixPayment', () => ({
  createPixPayment: createPixPaymentMock,
}))

vi.mock('../utils/checkout', () => ({
  createCardPayment: createCardPaymentMock,
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
    createCardPaymentMock.mockReset()
    getHasActiveSubscriptionMock.mockReset()
    createPixPaymentMock.mockReset()
  })

  it('redireciona para o checkout do cartão ao clicar em "Cartão (até 12x)" do trimestral', async () => {
    createCardPaymentMock.mockResolvedValueOnce({ data: { init_point: 'https://mp.example/checkout' } })
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

    fireEvent.click(within(screen.getByRole('group', { name: '3 meses' })).getByText('Cartão (até 12x)'))

    await waitFor(() => expect(window.location.href).toBe('https://mp.example/checkout'))
    expect(createCardPaymentMock).toHaveBeenCalledWith('trimestral')
  })

  it('avisa quando não dá para abrir o checkout do cartão', async () => {
    createCardPaymentMock.mockResolvedValueOnce({
      error: 'Você já tem uma assinatura ativa no cartão. Cancele antes de comprar um novo período.',
    })

    render(
      <MemoryRouter initialEntries={['/subscribe']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(within(screen.getByRole('group', { name: '1 mês' })).getByText('Cartão (até 12x)'))

    expect(
      await screen.findByText('Você já tem uma assinatura ativa no cartão. Cancele antes de comprar um novo período.')
    ).not.toBeNull()
  })

  it('ao voltar do checkout do cartão avulso, espera o webhook e redireciona pra /home', async () => {
    getHasActiveSubscriptionMock.mockResolvedValueOnce(true)

    render(
      <MemoryRouter initialEntries={['/subscribe?collection_status=approved&payment_id=999&preference_id=pref-1']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    expect(await screen.findByText('Home Page')).not.toBeNull()
    expect(mockState.setHasActiveSubscription).toHaveBeenCalledWith(true)
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
    createCardPaymentMock.mockReset()
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

  it('oferece Pix e cartão parcelado em cada plano, sem assinatura recorrente', () => {
    renderSubscribe()

    expect(screen.queryByText('Assinar agora')).toBeNull()
    expect(screen.queryByText(/com renovação automática/)).toBeNull()
    for (const title of ['1 mês', '3 meses', '6 meses', '12 meses']) {
      const plan = within(screen.getByRole('group', { name: title }))
      expect(plan.getByText('Pagar com Pix')).not.toBeNull()
      expect(plan.getByText('Cartão (até 12x)')).not.toBeNull()
    }
  })

  it('mostra o QR Code e o código copia e cola depois de gerar a cobrança', async () => {
    createPixPaymentMock.mockResolvedValueOnce({
      charge: {
        payment_id: '123',
        qr_code: '00020126-codigo-pix-copia-e-cola',
        qr_code_base64: 'iVBORw0KGgo=',
        amount: 129.9,
        months: 3,
      },
      error: null,
    })
    getHasActiveSubscriptionMock.mockResolvedValue(false)

    renderSubscribe()
    fireEvent.click(within(screen.getByRole('group', { name: '3 meses' })).getByText('Pagar com Pix'))

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
    fireEvent.click(within(screen.getByRole('group', { name: '1 mês' })).getByText('Pagar com Pix'))

    expect(await screen.findByText('Você já tem uma assinatura ativa no cartão.')).not.toBeNull()
  })
})

describe('Subscribe — renovação de acesso via Pix', () => {
  beforeEach(() => {
    mockState.isAdmin = false
    mockState.needsOnboarding = false
    mockState.setHasActiveSubscription = vi.fn()
    createCardPaymentMock.mockReset()
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
      charge: { payment_id: 'novo-999', qr_code: 'codigo', qr_code_base64: 'b64', amount: 129.9, months: 3 },
      error: null,
    })
    // assinatura ainda aponta pro pagamento ANTERIOR
    getMySubscriptionMock.mockResolvedValue({ payment_id: 'antigo-111' })

    renderAt('/subscribe?renovar=1')
    fireEvent.click(within(await screen.findByRole('group', { name: '3 meses' })).getByText('Pagar com Pix'))

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
    createCardPaymentMock.mockReset()
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

describe('Subscribe — preço padrão (sem promoção com prazo)', () => {
  beforeEach(() => {
    mockState.isAdmin = false
    mockState.hasActiveSubscription = false
    mockState.needsOnboarding = false
    mockState.setHasActiveSubscription = vi.fn()
  })

  const renderSubscribe = () =>
    render(
      <MemoryRouter initialEntries={['/subscribe']}>
        <Routes>
          <Route path="/subscribe" element={<Subscribe />} />
        </Routes>
      </MemoryRouter>
    )

  it('não mostra aviso de promoção nem preço riscado — R$ 49,90 é o preço padrão', () => {
    renderSubscribe()

    expect(screen.queryByText(/Promoção de lançamento/)).toBeNull()
    expect(within(screen.getByRole('group', { name: '1 mês' })).getByText(/R\$\s*49,90/)).not.toBeNull()
    expect(within(screen.getByRole('group', { name: '3 meses' })).getByText(/R\$\s*129,90/)).not.toBeNull()
  })
})
