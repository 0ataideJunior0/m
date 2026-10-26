import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Login from '../pages/Login'
import { useAuthStore } from '../store/authStore'

const signInMock = vi.fn(async (email: string, _password: string) => ({
  user: {
    id: 'u1',
    email,
    username: undefined,
    onboardingCompletedAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  error: null,
}))

const getHasActiveSubscriptionMock = vi.fn(async () => true)
const resendAccessMock = vi.fn(async (_email: string): Promise<{ ok: boolean; error?: string }> => ({ ok: true }))

vi.mock('../utils/checkout', () => ({
  resendAccess: (email: string) => resendAccessMock(email),
}))

vi.mock('../utils/auth', () => ({
  signIn: (...args: unknown[]) => signInMock(...(args as [string, string])),
}))

vi.mock('../utils/profile', () => ({
  getIsAdmin: vi.fn(async () => false),
}))

vi.mock('../utils/subscription', () => ({
  getHasActiveSubscription: () => getHasActiveSubscriptionMock(),
}))

beforeEach(() => {
  signInMock.mockClear()
  getHasActiveSubscriptionMock.mockClear()
  resendAccessMock.mockClear()
  useAuthStore.setState({ hasActiveSubscription: false })
})

describe('Login page', () => {
  it('busca hasActiveSubscription no login, pra assinante não ficar barrada até recarregar a página', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'maria@example.com' } })
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText('Home Page')).not.toBeNull()
    expect(getHasActiveSubscriptionMock).toHaveBeenCalled()
    expect(useAuthStore.getState().hasActiveSubscription).toBe(true)
  })

  describe('depois do pagamento (?pago=1)', () => {
    const renderPaid = (url = '/login?pago=1&email=a%40b.com') =>
      render(
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        </MemoryRouter>
      )

    afterEach(() => {
      vi.useRealTimers()
    })

    it('mostra o aviso com o e-mail e deixa o campo preenchido', () => {
      renderPaid()
      expect(
        screen.getByText('Pagamento recebido! Se for seu primeiro acesso, enviamos um link para a@b.com — confira também a caixa de spam. Se você já tem conta, é só entrar com sua senha.')
      ).not.toBeNull()
      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('a@b.com')
    })

    it('sem e-mail na URL, o aviso fala "o seu e-mail"', () => {
      renderPaid('/login?pago=1')
      expect(
        screen.getByText('Pagamento recebido! Se for seu primeiro acesso, enviamos um link para o seu e-mail — confira também a caixa de spam. Se você já tem conta, é só entrar com sua senha.')
      ).not.toBeNull()
    })

    it('sem pago=1, não mostra o aviso nem preenche o e-mail', () => {
      renderPaid('/login?email=a%40b.com')
      expect(screen.queryByText(/Pagamento recebido/)).toBeNull()
      expect(screen.queryByRole('button', { name: /reenviar link/i })).toBeNull()
      expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('')
    })

    it('"Reenviar link" chama resendAccess, desabilita por 1 minuto e volta depois', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      renderPaid()
      const button = screen.getByRole('button', { name: /reenviar link/i }) as HTMLButtonElement
      expect(button.disabled).toBe(false)

      await act(async () => { fireEvent.click(button) })

      expect(resendAccessMock).toHaveBeenCalledWith('a@b.com')
      expect(button.disabled).toBe(true)
      expect(screen.getByText('Enviado. Aguarde 1 minuto para pedir de novo.')).not.toBeNull()

      await act(async () => { await vi.advanceTimersByTimeAsync(59000) })
      expect(button.disabled).toBe(true)
      await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
      expect(button.disabled).toBe(false)
      expect(screen.queryByText(/Aguarde 1 minuto/)).toBeNull()
    })

    it('se o reenvio falha, mostra o erro e não trava o botão', async () => {
      resendAccessMock.mockResolvedValueOnce({ ok: false, error: 'Não foi possível falar com o servidor. Tente de novo.' })
      renderPaid()
      await act(async () => { fireEvent.click(screen.getByRole('button', { name: /reenviar link/i })) })
      expect(screen.getByText('Não foi possível falar com o servidor. Tente de novo.')).not.toBeNull()
      expect((screen.getByRole('button', { name: /reenviar link/i }) as HTMLButtonElement).disabled).toBe(false)
    })
  })
})
