import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Dashboard from '../pages/Dashboard'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
})

describe('Dashboard welcome', () => {
  it('exibe boas-vindas com username quando disponível', () => {
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
        <Dashboard />
      </MemoryRouter>
    )

    expect(screen.getByText(/olá, maria!/i)).toBeInTheDocument()
    expect(screen.queryByText(/não encontramos seu nome/i)).toBeNull()
  })

  it('usa email como fallback e mostra aviso quando username ausente', () => {
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
        <Dashboard />
      </MemoryRouter>
    )

    expect(screen.getByText(/olá, maria!/i)).toBeInTheDocument()
    expect(screen.getByText(/não encontramos seu nome/i)).toBeInTheDocument()
  })
})

