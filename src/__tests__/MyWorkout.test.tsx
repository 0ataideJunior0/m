import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MyWorkout from '../pages/MyWorkout'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const getMyWeekMock = vi.fn()

vi.mock('../utils/workouts', () => ({
  getMyWeek: (...args: unknown[]) => getMyWeekMock(...args),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}))

const todayNumber = ((new Date().getDay() + 6) % 7) + 1
const day = (weekday: number, title: string) => ({
  id: `w${weekday}`,
  program_id: null,
  weekday,
  user_id: 'u1',
  title,
  video_url: '',
  created_at: '',
  exercises: [{ exercise: 'Agachamento', reps: '12' }],
})

const renderWeek = () =>
  render(
    <MemoryRouter initialEntries={['/meu-treino']}>
      <Routes>
        <Route path="/meu-treino" element={<MyWorkout />} />
        <Route path="/meu-treino/dia/:weekday" element={<div>Dia aberto</div>} />
        <Route path="/home" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  getMyWeekMock.mockReset().mockResolvedValue([day(todayNumber, 'Treino de Hoje')])
})

describe('MyWorkout (semana pessoal)', () => {
  it('lista os 7 dias, marca hoje e mostra descanso nos dias sem treino', async () => {
    renderWeek()

    expect(await screen.findByText(/Treino de Hoje · 1 exercício/)).toBeInTheDocument()
    expect(screen.getByText('Hoje')).toBeInTheDocument()
    expect(screen.getAllByText('Descanso')).toHaveLength(6)
  })

  it('abre o dia ao tocar nele', async () => {
    renderWeek()

    fireEvent.click(await screen.findByRole('button', { name: /Treino de Hoje/ }))

    expect(await screen.findByText('Dia aberto')).toBeInTheDocument()
  })

  it('mostra estado vazio quando a usuária não tem semana pessoal', async () => {
    getMyWeekMock.mockResolvedValue([])
    renderWeek()

    await screen.findByText(/nenhum treino pessoal/i)
    fireEvent.click(screen.getByRole('button', { name: /voltar à home/i }))

    expect(await screen.findByText('Home Page')).toBeInTheDocument()
  })
})
