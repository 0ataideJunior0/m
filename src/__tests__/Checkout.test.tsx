import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import Checkout from '../pages/Checkout'

const { startCheckoutMock, getCheckoutStatusMock } = vi.hoisted(() => ({
  startCheckoutMock: vi.fn(),
  getCheckoutStatusMock: vi.fn(),
}))

vi.mock('../utils/checkout', () => ({
  startCheckout: startCheckoutMock,
  getCheckoutStatus: getCheckoutStatusMock,
}))

function LoginProbe() {
  const location = useLocation()
  return <div>Login {location.search}</div>
}

function renderCheckout(url = '/comprar?plano=trimestral') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/comprar" element={<Checkout />} />
        <Route path="/login" element={<LoginProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

const pixReply = {
  data: {
    intentId: 'intent-1',
    method: 'pix',
    pix: { payment_id: 99, qr_code: 'codigo-pix-copia-e-cola', qr_code_base64: 'QUJD' },
  },
}

function typeEmail(value: string) {
  fireEvent.change(screen.getByLabelText('E-mail'), { target: { value } })
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /ir para o pagamento/i }))
  })
}

describe('Checkout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    startCheckoutMock.mockReset()
    getCheckoutStatusMock.mockReset().mockResolvedValue({ data: { status: 'pending', lastPaymentStatus: null } })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra o plano vindo da URL com meses, valor e equivalência mensal', () => {
    renderCheckout('/comprar?plano=trimestral')
    expect(screen.getByText('3 meses')).not.toBeNull()
    expect(screen.getByText(/129,90/)).not.toBeNull()
    expect(screen.getByText(/Equivale a R\$\s43,30 por mês/)).not.toBeNull()
  })

  it('"Trocar plano" abre as 4 opções, sem o plano teste', () => {
    renderCheckout('/comprar?plano=trimestral')
    fireEvent.click(screen.getByRole('button', { name: /trocar plano/i }))
    expect(screen.getAllByRole('radio', { name: /^(1 mês|3 meses|6 meses|12 meses)/ })).toHaveLength(4)
    expect(screen.queryByText(/Verificação/)).toBeNull()
  })

  it('escolher outro plano na lista atualiza o resumo', () => {
    renderCheckout('/comprar?plano=trimestral')
    fireEvent.click(screen.getByRole('button', { name: /trocar plano/i }))
    fireEvent.click(screen.getByRole('radio', { name: /12 meses/ }))
    expect(screen.getByText(/358,80/)).not.toBeNull()
    expect(screen.queryByRole('radio', { name: /6 meses/ })).toBeNull()
  })

  it.each(['/comprar', '/comprar?plano=bienal'])(
    'sem plano válido (%s) mostra as 4 opções sem pré-seleção e não deixa pagar',
    (url) => {
      renderCheckout(url)
      const options = screen.getAllByRole('radio', { name: /^(1 mês|3 meses|6 meses|12 meses)/ })
      expect(options).toHaveLength(4)
      expect(options.every((o) => o.getAttribute('aria-checked') === 'false')).toBe(true)
      expect(screen.queryByText(/Verificação/)).toBeNull()
      expect((screen.getByRole('button', { name: /ir para o pagamento/i }) as HTMLButtonElement).disabled).toBe(true)
    },
  )

  it('?plano=teste pré-seleciona o plano de verificação, mas ele nunca aparece nas opções', () => {
    renderCheckout('/comprar?plano=teste')
    expect(screen.getByText('Verificação (admin)')).not.toBeNull()
    expect(screen.getByText(/0,01/)).not.toBeNull()
    expect((screen.getByRole('button', { name: /ir para o pagamento/i }) as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /trocar plano/i }))
    expect(screen.getAllByRole('radio', { name: /^(1 mês|3 meses|6 meses|12 meses)/ })).toHaveLength(4)
    expect(screen.queryByText(/Verificação/)).toBeNull()
    expect(screen.queryByText(/0,01/)).toBeNull()
  })

  it('compra o plano teste quando vem na URL', async () => {
    startCheckoutMock.mockResolvedValueOnce(pixReply)
    renderCheckout('/comprar?plano=teste')
    typeEmail('dev@b.com')
    await submit()
    expect(startCheckoutMock).toHaveBeenCalledWith({ email: 'dev@b.com', plan: 'teste', method: 'pix' })
  })

  it('mostra para onde vai o acesso quando o e-mail é válido', () => {
    renderCheckout()
    expect(screen.queryByText(/O acesso vai para/)).toBeNull()
    typeEmail('ana@b.com')
    expect(screen.getByText('O acesso vai para ana@b.com. Confira se está certo.')).not.toBeNull()
  })

  it('sugere o e-mail corrigido e corrige o campo ao clicar', () => {
    renderCheckout()
    typeEmail('ana@gmial.com')
    fireEvent.click(screen.getByRole('button', { name: 'Você quis dizer ana@gmail.com?' }))
    expect((screen.getByLabelText('E-mail') as HTMLInputElement).value).toBe('ana@gmail.com')
    expect(screen.queryByRole('button', { name: /você quis dizer/i })).toBeNull()
    expect(screen.getByText('O acesso vai para ana@gmail.com. Confira se está certo.')).not.toBeNull()
  })

  it('não chama o servidor com e-mail inválido', async () => {
    renderCheckout()
    typeEmail('ana@')
    await submit()
    expect(startCheckoutMock).not.toHaveBeenCalled()
    expect(screen.getByText('Digite um e-mail válido.')).not.toBeNull()
  })

  it('Pix: gera o QR e, quando o status vira paid, vai para o login com pago=1', async () => {
    startCheckoutMock.mockResolvedValueOnce(pixReply)
    renderCheckout()
    typeEmail(' ana@b.com ')
    await submit()

    expect(startCheckoutMock).toHaveBeenCalledWith({ email: 'ana@b.com', plan: 'trimestral', method: 'pix' })
    expect(screen.getByAltText('QR Code do Pix')).not.toBeNull()
    expect(screen.getByText('codigo-pix-copia-e-cola')).not.toBeNull()
    expect(screen.getByRole('button', { name: /copiar código pix/i })).not.toBeNull()

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(getCheckoutStatusMock).toHaveBeenCalledWith('intent-1')
    expect(screen.queryByText(/^Login/)).toBeNull()

    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'paid', lastPaymentStatus: 'approved' } })
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })

    expect(screen.getByText('Login ?pago=1&email=ana%40b.com')).not.toBeNull()
  })

  it('Pix: a consulta roda a cada 4s e para ao sair da tela', async () => {
    startCheckoutMock.mockResolvedValueOnce(pixReply)
    const { unmount } = renderCheckout()
    typeEmail('ana@b.com')
    await submit()

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(getCheckoutStatusMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(3900) })
    expect(getCheckoutStatusMock).toHaveBeenCalledTimes(1)
    await act(async () => { await vi.advanceTimersByTimeAsync(100) })
    expect(getCheckoutStatusMock).toHaveBeenCalledTimes(2)

    unmount()
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(getCheckoutStatusMock).toHaveBeenCalledTimes(2)
  })

  it('Pix: mostra "não aprovado" e deixa tentar de novo quando o status vira rejected', async () => {
    startCheckoutMock.mockResolvedValueOnce(pixReply)
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'rejected', lastPaymentStatus: 'rejected' } })
    renderCheckout()
    typeEmail('ana@b.com')
    await submit()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(screen.getByText('O pagamento não foi aprovado.')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }))
    expect(screen.getByRole('button', { name: /ir para o pagamento/i })).not.toBeNull()
    await act(async () => { await vi.advanceTimersByTimeAsync(12000) })
    expect(getCheckoutStatusMock).toHaveBeenCalledTimes(1)
  })

  it('mostra o erro do servidor na tela (409 de assinatura ativa)', async () => {
    startCheckoutMock.mockResolvedValueOnce({ error: 'Você já tem uma assinatura ativa. Entre na sua conta.' })
    renderCheckout()
    typeEmail('ana@b.com')
    await submit()
    expect(screen.getByText('Você já tem uma assinatura ativa. Entre na sua conta.')).not.toBeNull()
    expect(screen.queryByAltText('QR Code do Pix')).toBeNull()
  })

  it('Cartão: manda method card e abre o checkout na mesma aba', async () => {
    startCheckoutMock.mockResolvedValueOnce({
      data: { intentId: 'intent-2', method: 'card', init_point: 'https://mp.example/checkout/abc' },
    })
    const originalLocation = window.location
    Object.defineProperty(window, 'location', { writable: true, value: { ...originalLocation, href: 'http://localhost/' } })
    try {
      renderCheckout()
      typeEmail('ana@b.com')
      fireEvent.click(screen.getByRole('radio', { name: /cartão/i }))
      await submit()

      expect(startCheckoutMock).toHaveBeenCalledWith({ email: 'ana@b.com', plan: 'trimestral', method: 'card' })
      expect(window.location.href).toBe('https://mp.example/checkout/abc')
      expect(sessionStorage.getItem('musa_checkout_email:intent-2')).toBe('ana@b.com')
    } finally {
      Object.defineProperty(window, 'location', { writable: true, value: originalLocation })
    }
  })
})
