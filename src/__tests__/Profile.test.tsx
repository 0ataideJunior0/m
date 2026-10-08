import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Profile from '../pages/Profile'
import { useAuthStore } from '../store/authStore'
import type { Completion } from '../utils/activity'

const getCompletionsMock = vi.fn(async (): Promise<Completion[]> => [])

vi.mock('../utils/activity', async () => {
  const actual = await vi.importActual<typeof import('../utils/activity')>('../utils/activity')
  return { ...actual, getCompletions: () => getCompletionsMock() }
})

vi.mock('../utils/profile', () => ({
  updateProfileFields: vi.fn(async () => ({ error: null })),
}))

const daysAgo = (n: number, hour = 12): Date => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d
}

const completion = (n: number, programName: string | null = 'Avançado', hour = 12): Completion => ({
  completedAt: daysAgo(n, hour).toISOString(),
  programName,
})

const renderProfile = () =>
  render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>
  )

beforeEach(() => {
  getCompletionsMock.mockReset()
  getCompletionsMock.mockResolvedValue([])
  useAuthStore.setState({
    user: {
      id: 'u1',
      email: 'maria@example.com',
      username: 'Maria Alves',
      goal: 'ganhar_musculo',
      age: 29,
      heightCm: 165,
      weightKg: 62,
      onboardingCompletedAt: new Date().toISOString(),
      created_at: '2026-06-10T12:00:00.000Z',
      updated_at: '2026-06-10T12:00:00.000Z',
    },
    isAuthenticated: true,
    isLoading: false,
    isAdmin: false,
  })
})

describe('Profile', () => {
  it('mostra o cartão de membro com nome, objetivo e dados cadastrais', async () => {
    renderProfile()

    expect(await screen.findByText('Maria Alves')).toBeInTheDocument()
    expect(screen.getByText(/objetivo · ganhar músculo/i)).toBeInTheDocument()
    expect(screen.getByText('29 anos')).toBeInTheDocument()
    expect(screen.getByText('165 cm')).toBeInTheDocument()
    expect(screen.getByText('62 kg')).toBeInTheDocument()
  })

  it('sem nenhum treino: sequência zerada, meta 0/5 e estados vazios', async () => {
    renderProfile()

    await screen.findByText('Maria Alves')
    expect(screen.getByText('0/5')).toBeInTheDocument()
    expect(screen.getByText('Faltam 5 treinos')).toBeInTheDocument()
    expect(screen.getByText(/conclua um treino para ver qual programa/i)).toBeInTheDocument()
    expect(screen.getByText('0 de 6')).toBeInTheDocument()
  })

  it('com histórico: totais, sequência, meta da semana e programa favorito', async () => {
    getCompletionsMock.mockResolvedValue([
      completion(0),
      completion(1),
      completion(2, 'Avançado', 6),
      completion(3, 'Iniciante'),
    ])
    renderProfile()

    await screen.findByText('Maria Alves')
    expect(screen.getByText(/4 treinos nas últimas 18 semanas/i)).toBeInTheDocument()
    expect(screen.getByText('Sequência atual · recorde de 4')).toBeInTheDocument()
    expect(screen.getByText('Avançado')).toBeInTheDocument()
    expect(screen.getByText('3×')).toBeInTheDocument()
    // Primeiro treino + Madrugadora (treino antes das 7h) desbloqueadas
    expect(screen.getByText('2 de 6')).toBeInTheDocument()
  })

  it('admin vê o atalho do painel em vez de Minha assinatura', async () => {
    useAuthStore.setState({ isAdmin: true })
    renderProfile()

    expect(await screen.findByText('Painel Admin')).toBeInTheDocument()
    expect(screen.queryByText('Minha assinatura')).toBeNull()
  })
})
