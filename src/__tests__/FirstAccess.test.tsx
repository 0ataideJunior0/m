import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

const calls: string[] = []

const { authMock, claimAccessMock, resendAccessMock, getCurrentUserMock, unsubscribeMock } = vi.hoisted(() => ({
  authMock: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
  claimAccessMock: vi.fn(),
  resendAccessMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  unsubscribeMock: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({ supabase: { auth: authMock } }))
vi.mock('../utils/checkout', () => ({
  claimAccess: (step: string) => claimAccessMock(step),
  resendAccess: (email: string) => resendAccessMock(email),
}))
vi.mock('../utils/auth', () => ({ getCurrentUser: () => getCurrentUserMock() }))
vi.mock('../utils/profile', () => ({ getIsAdmin: vi.fn(async () => false) }))
vi.mock('../utils/subscription', () => ({ getHasActiveSubscription: vi.fn(async () => true) }))

import FirstAccess from '../pages/FirstAccess'
import { useAuthStore } from '../store/authStore'

const SESSION = { data: { session: { access_token: 'tok' } } }
const NO_SESSION = { data: { session: null } }

const user = (onboardingCompletedAt: string | null) => ({
  id: 'u1',
  email: 'maria@example.com',
  username: undefined,
  onboardingCompletedAt,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/primeiro-acesso']}>
      <Routes>
        <Route path="/primeiro-acesso" element={<FirstAccess />} />
        <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        <Route path="/home" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

function fillAndSubmit(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: password } })
  fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: confirm } })
  fireEvent.click(screen.getByRole('button', { name: /salvar senha/i }))
}

beforeEach(() => {
  calls.length = 0
  vi.clearAllMocks()
  authMock.getSession.mockResolvedValue(SESSION)
  authMock.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: unsubscribeMock } } })
  authMock.updateUser.mockImplementation(async () => {
    calls.push('updateUser')
    return { data: {}, error: null }
  })
  authMock.signOut.mockImplementation(async () => {
    calls.push('signOut')
    return { error: null }
  })
  claimAccessMock.mockImplementation(async (step: string) => {
    calls.push(`claim:${step}`)
    return { ok: true }
  })
  resendAccessMock.mockResolvedValue({ ok: true })
  getCurrentUserMock.mockResolvedValue(user(null))
  useAuthStore.getState().logout()
})

describe('FirstAccess (/primeiro-acesso)', () => {
  it('com sessão do link mostra "Crie sua senha", sem botão de pular, e avisa o servidor uma vez', async () => {
    renderPage()

    expect(await screen.findByRole('heading', { name: /crie sua senha/i })).not.toBeNull()
    expect(screen.queryByRole('button', { name: /pular/i })).toBeNull()
    expect(screen.queryByText(/pular/i)).toBeNull()
    await waitFor(() => expect(claimAccessMock).toHaveBeenCalledWith('link_opened'))
    expect(claimAccessMock.mock.calls.filter(([step]) => step === 'link_opened')).toHaveLength(1)
  })

  it('sem sessão depois de carregar mostra link expirado e reenvia o link para o e-mail digitado', async () => {
    authMock.getSession.mockResolvedValue(NO_SESSION)
    renderPage()

    expect(await screen.findByText('Este link expirou ou já foi usado.', {}, { timeout: 3000 })).not.toBeNull()
    expect(claimAccessMock).not.toHaveBeenCalled()
    expect(screen.queryByLabelText(/confirmar senha/i)).toBeNull()

    fireEvent.change(screen.getByLabelText(/e-?mail/i), { target: { value: 'maria@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /enviar novo link/i }))

    await waitFor(() => expect(resendAccessMock).toHaveBeenCalledWith('maria@example.com'))
    expect(await screen.findByRole('status')).not.toBeNull()
  })

  it('a sessão do hash pode chegar depois da montagem: o evento do supabase abre o formulário', async () => {
    authMock.getSession.mockResolvedValue(NO_SESSION)
    let listener: ((event: string, session: unknown) => void) | undefined
    authMock.onAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
      listener = cb
      return { data: { subscription: { unsubscribe: unsubscribeMock } } }
    })
    renderPage()

    await waitFor(() => expect(listener).toBeDefined())
    act(() => listener!('SIGNED_IN', { access_token: 'tok' }))

    expect(await screen.findByRole('heading', { name: /crie sua senha/i })).not.toBeNull()
    expect(screen.queryByText('Este link expirou ou já foi usado.')).toBeNull()
  })

  it('desinscreve do onAuthStateChange ao desmontar', async () => {
    const { unmount } = renderPage()
    await screen.findByRole('heading', { name: /crie sua senha/i })
    unmount()
    expect(unsubscribeMock).toHaveBeenCalled()
  })

  it('senhas diferentes bloqueiam o envio', async () => {
    renderPage()
    await screen.findByRole('heading', { name: /crie sua senha/i })

    fillAndSubmit('abc123', 'xyz999')

    expect(await screen.findByText(/não coincidem/i)).not.toBeNull()
    expect(authMock.updateUser).not.toHaveBeenCalled()
  })

  it('senha curta bloqueia o envio', async () => {
    renderPage()
    await screen.findByRole('heading', { name: /crie sua senha/i })

    fillAndSubmit('abc', 'abc')

    expect(await screen.findByText(/pelo menos 6 caracteres/i)).not.toBeNull()
    expect(authMock.updateUser).not.toHaveBeenCalled()
  })

  it('salvar: updateUser, signOut dos outros dispositivos, claimAccess(password_set) e onboarding, nessa ordem', async () => {
    renderPage()
    await screen.findByRole('heading', { name: /crie sua senha/i })

    fillAndSubmit('abc123', 'abc123')

    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
    expect(authMock.updateUser).toHaveBeenCalledWith({ password: 'abc123' })
    expect(authMock.signOut).toHaveBeenCalledWith({ scope: 'others' })
    expect(claimAccessMock).toHaveBeenCalledWith('password_set')
    expect(calls.filter((c) => c !== 'claim:link_opened')).toEqual(['updateUser', 'signOut', 'claim:password_set'])
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().needsOnboarding).toBe(true)
    expect(useAuthStore.getState().hasActiveSubscription).toBe(true)
  })

  it('quem já fez o onboarding vai para a home', async () => {
    getCurrentUserMock.mockResolvedValue(user(new Date().toISOString()))
    renderPage()
    await screen.findByRole('heading', { name: /crie sua senha/i })

    fillAndSubmit('abc123', 'abc123')

    expect(await screen.findByText('Home Page')).not.toBeNull()
  })

  it('falha no signOut dos outros dispositivos e no claimAccess não travam a compradora', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    authMock.signOut.mockResolvedValue({ error: new Error('boom') })
    claimAccessMock.mockImplementation(async (step: string) =>
      step === 'password_set' ? { ok: false, error: 'E-mail ainda não confirmado' } : { ok: true }
    )
    renderPage()
    await screen.findByRole('heading', { name: /crie sua senha/i })

    fillAndSubmit('abc123', 'abc123')

    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('erro do updateUser mostra a mensagem em português e não segue adiante', async () => {
    authMock.updateUser.mockResolvedValue({
      data: {},
      error: { code: 'weak_password', message: 'Password should be at least 6 characters.' },
    })
    renderPage()
    await screen.findByRole('heading', { name: /crie sua senha/i })

    fillAndSubmit('abc123', 'abc123')

    expect(await screen.findByText('A senha deve ter pelo menos 6 caracteres.')).not.toBeNull()
    expect(screen.queryByText(/Password should be/)).toBeNull()
    expect(authMock.signOut).not.toHaveBeenCalled()
    expect(claimAccessMock).not.toHaveBeenCalledWith('password_set')
    expect(screen.queryByText('Onboarding Page')).toBeNull()
  })

  it('senha igual à atual (same_password) conta como sucesso e segue o fluxo', async () => {
    authMock.updateUser.mockImplementation(async () => {
      calls.push('updateUser')
      return {
        data: {},
        error: { code: 'same_password', message: 'New password should be different from the old password.' },
      }
    })
    renderPage()
    await screen.findByRole('heading', { name: /crie sua senha/i })

    fillAndSubmit('abc123', 'abc123')

    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
    expect(calls.filter((c) => c !== 'claim:link_opened')).toEqual(['updateUser', 'signOut', 'claim:password_set'])
  })
})
