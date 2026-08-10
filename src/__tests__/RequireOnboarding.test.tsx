import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireOnboarding from '../components/RequireOnboarding'

const mockState = { isAuthenticated: false, needsOnboarding: false, isLoading: false }
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('RequireOnboarding', () => {
  it('redireciona para /login quando não está autenticada, mesmo sem precisar de onboarding', async () => {
    mockState.isAuthenticated = false
    mockState.needsOnboarding = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireOnboarding><div>Home Content</div></RequireOnboarding>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Login Page')).not.toBeNull()
  })

  it('redireciona para /onboarding quando autenticada mas precisa completar o onboarding', async () => {
    mockState.isAuthenticated = true
    mockState.needsOnboarding = true
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireOnboarding><div>Home Content</div></RequireOnboarding>} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
  })

  it('renderiza o conteúdo quando autenticada e com onboarding completo', async () => {
    mockState.isAuthenticated = true
    mockState.needsOnboarding = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireOnboarding><div>Home Content</div></RequireOnboarding>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Home Content')).not.toBeNull()
  })
})
