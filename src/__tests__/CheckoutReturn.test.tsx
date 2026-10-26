import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import CheckoutReturn from '../pages/CheckoutReturn'

const { getCheckoutStatusMock } = vi.hoisted(() => ({ getCheckoutStatusMock: vi.fn() }))

vi.mock('../utils/checkout', () => ({
  getCheckoutStatus: getCheckoutStatusMock,
}))

function Probe({ name }: { name: string }) {
  const location = useLocation()
  return <div>{name} {location.search}</div>
}

function renderReturn(url = '/comprar/retorno?intent=intent-1') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/comprar/retorno" element={<CheckoutReturn />} />
        <Route path="/comprar" element={<Probe name="Comprar" />} />
        <Route path="/login" element={<Probe name="Login" />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function flush(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms) })
}

describe('CheckoutReturn', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    getCheckoutStatusMock.mockReset()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('enquanto confirma, mostra a espera', () => {
    getCheckoutStatusMock.mockReturnValue(new Promise(() => {}))
    renderReturn()
    expect(screen.getByText('Estamos confirmando seu pagamento...')).not.toBeNull()
  })

  it('rejected mostra a mensagem e o botão volta para /comprar', async () => {
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'rejected', lastPaymentStatus: 'rejected' } })
    renderReturn()
    await flush()

    expect(getCheckoutStatusMock).toHaveBeenCalledWith('intent-1')
    expect(screen.getByText('O pagamento não foi aprovado.')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /tentar de novo/i }))
    expect(screen.getByText(/^Comprar/)).not.toBeNull()
  })

  it('pending em análise (in_process) mostra o aviso, oferece voltar à compra e continua consultando a cada 4s', async () => {
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'pending', lastPaymentStatus: 'in_process' } })
    renderReturn()
    await flush()
    expect(
      screen.getByText('Pagamento em análise. Assim que for aprovado, seu acesso é liberado.'),
    ).not.toBeNull()
    await flush(4000)
    expect(getCheckoutStatusMock).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: /voltar para a compra/i }))
    expect(screen.getByText(/^Comprar/)).not.toBeNull()
  })

  it("pending com lastPaymentStatus 'pending' também é em análise", async () => {
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'pending', lastPaymentStatus: 'pending' } })
    renderReturn()
    await flush()
    expect(
      screen.getByText('Pagamento em análise. Assim que for aprovado, seu acesso é liberado.'),
    ).not.toBeNull()
    expect(screen.getByRole('button', { name: /voltar para a compra/i })).not.toBeNull()
  })

  it('pending sem nenhum pagamento ainda (saiu do MP sem pagar): confirma e, depois de 60s, oferece voltar à compra', async () => {
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'pending', lastPaymentStatus: null } })
    renderReturn()
    await flush()
    expect(screen.getByText('Estamos confirmando seu pagamento...')).not.toBeNull()
    expect(screen.queryByText(/em análise/i)).toBeNull()
    expect(screen.queryByRole('button', { name: /voltar para a compra/i })).toBeNull()

    await flush(59_000)
    expect(screen.queryByRole('button', { name: /voltar para a compra/i })).toBeNull()

    await flush(1_000)
    fireEvent.click(screen.getByRole('button', { name: /voltar para a compra/i }))
    expect(screen.getByText(/^Comprar/)).not.toBeNull()
  })

  it('paid leva ao login com pago=1 e o e-mail guardado antes do cartão', async () => {
    sessionStorage.setItem('musa_checkout_email:intent-1', 'ana@b.com')
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'paid', lastPaymentStatus: 'approved' } })
    renderReturn()
    await flush()
    expect(screen.getByText('Login ?pago=1&email=ana%40b.com')).not.toBeNull()
  })

  it('paid sem e-mail guardado ainda leva ao login com pago=1', async () => {
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'paid', lastPaymentStatus: 'approved' } })
    renderReturn()
    await flush()
    expect(screen.getByText('Login ?pago=1')).not.toBeNull()
  })

  it('para de consultar depois de um status final', async () => {
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'rejected', lastPaymentStatus: 'rejected' } })
    renderReturn()
    await flush()
    await flush(20000)
    expect(getCheckoutStatusMock).toHaveBeenCalledTimes(1)
  })

  it('para de consultar ao sair da tela', async () => {
    getCheckoutStatusMock.mockResolvedValue({ data: { status: 'pending', lastPaymentStatus: null } })
    const { unmount } = renderReturn()
    await flush()
    unmount()
    await flush(20000)
    expect(getCheckoutStatusMock).toHaveBeenCalledTimes(1)
  })

  it('sem intent na URL, não consulta e oferece voltar à compra', async () => {
    renderReturn('/comprar/retorno')
    await flush()
    expect(getCheckoutStatusMock).not.toHaveBeenCalled()
    expect(screen.getByText('Não encontramos o seu pedido.')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /voltar para a compra/i }))
    expect(screen.getByText(/^Comprar/)).not.toBeNull()
  })
})
