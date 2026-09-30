import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '../pages/Home'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const getMyWorkoutMock = vi.fn(async () => null as any)

vi.mock('../utils/workouts', () => ({
  getPrograms: vi.fn(async () => []),
  getMyWorkout: (...args: unknown[]) => getMyWorkoutMock(...(args as [string])),
}))

// A Home renderiza o PixExpiryBanner, que consulta a assinatura. Sem assinatura
// o banner não aparece, que é o cenário destes testes.
vi.mock('../utils/subscription', () => ({
  getMySubscription: vi.fn(async () => null),
}))

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  getMyWorkoutMock.mockClear()
  getMyWorkoutMock.mockResolvedValue(null)
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

describe('Home treino personalizado', () => {
  const setLoggedInUser = () => {
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
  }

  it('não mostra o card quando a usuária não tem treino pessoal', async () => {
    setLoggedInUser()
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    await screen.findByText(/olá, maria!/i)
    expect(screen.queryByText(/seu treino personalizado/i)).toBeNull()
  })

  it('mostra o card com o título do treino quando existe um treino pessoal', async () => {
    setLoggedInUser()
    getMyWorkoutMock.mockResolvedValueOnce({
      id: 'w1',
      program_id: null,
      weekday: null,
      user_id: 'u1',
      title: 'Treino da Maria',
      video_url: '',
      created_at: '',
      exercises: [],
    })

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

    expect(await screen.findByText(/seu treino personalizado/i)).toBeInTheDocument()
    expect(screen.getByText('Treino da Maria')).toBeInTheDocument()
  })
})
