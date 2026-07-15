import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import RequireAdmin from '../components/RequireAdmin'

const mockState = { isAdmin: false, isLoading: false }
vi.mock('../store/authStore', () => ({
  useAuthStore: () => mockState,
}))

describe('RequireAdmin', () => {
  it('redireciona para /home quando não é admin', async () => {
    mockState.isAdmin = false
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<RequireAdmin><div>Admin Content</div></RequireAdmin>} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Home Page')).not.toBeNull()
  })

  it('renderiza o conteúdo quando é admin', async () => {
    mockState.isAdmin = true
    mockState.isLoading = false
    render(
      <MemoryRouter initialEntries={['/admin/users']}>
        <Routes>
          <Route path="/admin/users" element={<RequireAdmin><div>Admin Content</div></RequireAdmin>} />
          <Route path="/home" element={<div>Home Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(await screen.findByText('Admin Content')).not.toBeNull()
  })
})
