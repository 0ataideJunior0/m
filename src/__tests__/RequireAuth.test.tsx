import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireAuth from '../components/RequireAuth'

const mockState = { isAuthenticated: false, isLoading: false }
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('RequireAuth', () => {
  it('redireciona para /login quando não está autenticada', async () => {
    mockState.isAuthenticated = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/subscribe']}>
        <Routes>
          <Route path="/subscribe" element={<RequireAuth><div>Subscribe Content</div></RequireAuth>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Login Page')).not.toBeNull()
  })

  it('renderiza o conteúdo quando está autenticada, sem exigir onboarding ou assinatura', async () => {
    mockState.isAuthenticated = true
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/subscribe']}>
        <Routes>
          <Route path="/subscribe" element={<RequireAuth><div>Subscribe Content</div></RequireAuth>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Subscribe Content')).not.toBeNull()
  })
})
