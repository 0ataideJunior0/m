import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import Home from '../pages/Home'
import { MemoryRouter } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

const getMyWeekMock = vi.fn(async () => [] as any[])
const getMyPlanMock = vi.fn(async () => ({ hideCatalog: false }))

vi.mock('../utils/workouts', () => ({
  getPrograms: vi.fn(async () => [{ id: 'p1', slug: 'avancado', name: 'Avançado', sort_order: 1, created_at: '' }]),
  getMyWeek: (...args: unknown[]) => getMyWeekMock(...(args as [])),
  getMyPlan: (...args: unknown[]) => getMyPlanMock(...(args as [])),
}))

// A Home renderiza o PixExpiryBanner, que consulta a assinatura. Sem assinatura
// o banner não aparece, que é o cenário destes testes.
vi.mock('../utils/subscription', () => ({
  getMySubscription: vi.fn(async () => null),
}))

beforeEach(() => {
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: false })
  getMyWeekMock.mockReset().mockResolvedValue([])
  getMyPlanMock.mockReset().mockResolvedValue({ hideCatalog: false })
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

  const day = (weekday: number, title: string) => ({
    id: `w${weekday}`,
    program_id: null,
    weekday,
    user_id: 'u1',
    title,
    video_url: '',
    created_at: '',
    exercises: [],
  })
  const todayNumber = ((new Date().getDay() + 6) % 7) + 1
  const otherDay = (todayNumber % 7) + 1

  const renderHome = () =>
    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    )

  it('sem semana pessoal, não mostra o card e mostra os programas', async () => {
    setLoggedInUser()
    renderHome()

    await screen.findByText(/olá, maria!/i)
    expect(screen.queryByText(/sua semana personalizada/i)).toBeNull()
    expect(screen.getByText('Avançado')).toBeInTheDocument()
  })

  it('mostra o treino de hoje da semana pessoal', async () => {
    setLoggedInUser()
    getMyWeekMock.mockResolvedValue([day(todayNumber, 'Glúteo da Maria')])
    renderHome()

    expect(await screen.findByText(/sua semana personalizada/i)).toBeInTheDocument()
    expect(screen.getByText(/Glúteo da Maria/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Treino de hoje' })).toBeInTheDocument()
  })

  it('em dia de descanso, avisa e só oferece ver a semana', async () => {
    setLoggedInUser()
    getMyWeekMock.mockResolvedValue([day(otherDay, 'Outro dia')])
    renderHome()

    expect(await screen.findByText('Hoje é dia de descanso.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Treino de hoje' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver minha semana' })).toBeInTheDocument()
  })

  it('esconde os programas do catálogo quando a admin marcou e ela tem semana', async () => {
    setLoggedInUser()
    getMyWeekMock.mockResolvedValue([day(todayNumber, 'Treino')])
    getMyPlanMock.mockResolvedValue({ hideCatalog: true })
    renderHome()

    await screen.findByText(/sua semana personalizada/i)
    expect(screen.queryByText('Avançado')).toBeNull()
  })

  it('com o catálogo escondido mas sem semana, os programas continuam aparecendo', async () => {
    setLoggedInUser()
    getMyPlanMock.mockResolvedValue({ hideCatalog: true })
    renderHome()

    expect(await screen.findByText('Avançado')).toBeInTheDocument()
  })
})
