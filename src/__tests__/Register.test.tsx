import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Register from '../pages/Register'

const signUpMock = vi.fn(async (email: string, _password: string) => ({
  user: {
    id: 'u1',
    email,
    username: undefined,
    onboardingCompletedAt: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  error: null,
  needsEmailConfirmation: false,
}))

vi.mock('../utils/auth', () => ({
  signUp: (...args: unknown[]) => signUpMock(...(args as [string, string])),
}))

const updateSignupUtmMock = vi.fn(async (_userId: string, _utm: unknown): Promise<{ error: Error | null }> => ({ error: null }))
const getAttributionMock = vi.fn((): unknown => null)

vi.mock('../utils/profile', () => ({
  getIsAdmin: vi.fn(async () => false),
  updateSignupUtm: (userId: string, utm: unknown) => updateSignupUtmMock(userId, utm),
}))

vi.mock('../utils/subscription', () => ({
  getHasActiveSubscription: vi.fn(async () => false),
}))

vi.mock('../utils/attribution', () => ({
  getAttribution: () => getAttributionMock(),
}))

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<Register />} />
        <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        <Route path="/subscribe" element={<div>Subscribe Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'maria@example.com' } })
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: '123456' } })
  fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))
}

beforeEach(() => {
  localStorage.clear()
  signUpMock.mockClear()
  updateSignupUtmMock.mockClear()
  getAttributionMock.mockReset()
  getAttributionMock.mockReturnValue(null)
})

describe('Register page', () => {
  it('erro do Supabase em inglês aparece traduzido', async () => {
    signUpMock.mockResolvedValueOnce({
      user: null,
      error: Object.assign(new Error('User already registered'), { code: 'user_already_exists' }),
      needsEmailConfirmation: false,
    } as any)
    renderRegister()
    fillAndSubmit()

    expect(
      await screen.findByText("Já existe uma conta com esse e-mail. Entre ou use 'Esqueci a senha'."),
    ).not.toBeNull()
    expect(screen.queryByText('User already registered')).toBeNull()
  })

  it('mostra erro quando as senhas digitadas não coincidem', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )

    const passwordInput = screen.getByLabelText(/^senha$/i)
    const confirmInput = screen.getByLabelText(/confirmar senha/i)

    fireEvent.change(passwordInput, { target: { value: 'abc123' } })
    fireEvent.change(confirmInput, { target: { value: 'xyz999' } })
    // A validação roda com o estado da renderização anterior, então o
    // mismatch só aparece a partir do próximo evento de mudança real
    // (comportamento já existente no componente, não relacionado a esta
    // mudança) — daí o segundo fireEvent abaixo.
    fireEvent.change(confirmInput, { target: { value: 'xyz998' } })
    expect(screen.getByText(/não coincidem/i)).not.toBeNull()
  })

  it('cadastra com email e senha (sem username) e, com sessão, segue direto para o onboarding', async () => {
    renderRegister()
    fillAndSubmit()

    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
    expect(signUpMock).toHaveBeenCalledWith('maria@example.com', '123456')
    expect(updateSignupUtmMock).not.toHaveBeenCalled()
  })

  it('com sessão e origem do tráfego, grava profiles.signup_utm sem o referrer', async () => {
    getAttributionMock.mockReturnValue({
      source: 'instagram', medium: 'bio', campaign: 'lancamento', content: null, term: null,
      referrer: 'https://l.instagram.com/',
    })
    renderRegister()
    fillAndSubmit()

    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
    expect(updateSignupUtmMock).toHaveBeenCalledWith('u1', {
      source: 'instagram', medium: 'bio', campaign: 'lancamento', content: null, term: null,
    })
  })

  it('falha ao gravar signup_utm não trava o cadastro', async () => {
    getAttributionMock.mockReturnValue({
      source: 'instagram', medium: null, campaign: null, content: null, term: null, referrer: null,
    })
    updateSignupUtmMock.mockResolvedValueOnce({ error: new Error('sem permissão') })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderRegister()
    fillAndSubmit()

    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  // Com "Confirm email" ligado na Supabase, o cadastro devolve um user mas
  // nenhuma sessão — logar como se tivesse dado certo (isAuthenticated=true
  // sem sessão real) quebra tudo na primeira chamada autenticada. A tela
  // precisa reconhecer esse caso e pedir pra checar o email, em vez de
  // navegar pra assinatura como se já estivesse logada.
  it('quando a conta precisa de confirmação por email, mostra aviso em vez de navegar como se estivesse logada', async () => {
    signUpMock.mockResolvedValueOnce({
      user: {
        id: 'u2',
        email: 'nova@example.com',
        username: undefined,
        onboardingCompletedAt: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      error: null,
      needsEmailConfirmation: true,
    })

    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/subscribe" element={<div>Subscribe Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'nova@example.com' } })
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: '123456' } })

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(await screen.findByText(/confirme seu email/i)).not.toBeNull()
    expect(screen.queryByText('Subscribe Page')).toBeNull()
    expect(screen.queryByText('Onboarding Page')).toBeNull()
    expect(updateSignupUtmMock).not.toHaveBeenCalled()
  })
})
