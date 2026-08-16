import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireSubscription from '../components/RequireSubscription'

const mockState = { isAuthenticated: true, isAdmin: false, hasActiveSubscription: false, isLoading: false }
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('RequireSubscription', () => {
  it('redireciona para /login quando não está autenticada', async () => {
    mockState.isAuthenticated = false
    mockState.isAdmin = false
    mockState.hasActiveSubscription = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/subscribe']}>
        <Routes>
          <Route path="/subscribe" element={<RequireSubscription><div>Subscribe Content</div></RequireSubscription>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Login Page')).not.toBeNull()
  })

  it('redireciona para /subscribe quando está autenticada mas não é admin nem tem assinatura ativa', async () => {
    mockState.isAuthenticated = true
    mockState.isAdmin = false
    mockState.hasActiveSubscription = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireSubscription><div>Home Content</div></RequireSubscription>} />
          <Route path="/subscribe" element={<div>Subscribe Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Subscribe Page')).not.toBeNull()
  })

  it('renderiza o conteúdo quando tem assinatura ativa', async () => {
    mockState.isAuthenticated = true
    mockState.isAdmin = false
    mockState.hasActiveSubscription = true
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireSubscription><div>Home Content</div></RequireSubscription>} />
          <Route path="/subscribe" element={<div>Subscribe Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Home Content')).not.toBeNull()
  })

  it('renderiza o conteúdo quando é admin, mesmo sem assinatura', async () => {
    mockState.isAuthenticated = true
    mockState.isAdmin = true
    mockState.hasActiveSubscription = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/home']}>
        <Routes>
          <Route path="/home" element={<RequireSubscription><div>Home Content</div></RequireSubscription>} />
          <Route path="/subscribe" element={<div>Subscribe Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Home Content')).not.toBeNull()
  })
})
