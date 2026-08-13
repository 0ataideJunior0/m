import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
})
