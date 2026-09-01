import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '../pages/Home'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

vi.mock('../utils/workouts', () => ({
  getPrograms: vi.fn(async () => []),
}))

// A Home renderiza o PixExpiryBanner, que consulta a assinatura. Sem assinatura
// o banner não aparece, que é o cenário destes testes.
vi.mock('../utils/subscription', () => ({
  getMySubscription: vi.fn(async () => null),
}))

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
})

describe('Home welcome', () => {
  it('exibe boas-vindas com username quando disponível', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'maria@example.com',
        username: 'Maria',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(await screen.findByText(/olá, maria!/i)).toBeInTheDocument()
  })

  it('usa o prefixo do e-mail como fallback quando não há username', async () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'maria@example.com',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      isAuthenticated: true,
      isLoading: false,
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(await screen.findByText(/olá, maria!/i)).toBeInTheDocument()
  })
})
