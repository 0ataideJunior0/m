import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MyWorkout from '../pages/MyWorkout'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const getMyWorkoutMock = vi.fn(async () => ({
  id: 'w1',
  program_id: null,
  weekday: null,
  user_id: 'u1',
  title: 'Treino da Ana',
  video_url: '',
  created_at: new Date().toISOString(),
  exercises: [
    { exercise: 'Agachamento', reps: '12', sets: '3', type: 'normal', video: 'https://www.youtube.com/watch?v=abc123' },
    { exercise: 'Prancha', reps: '30s', sets: '3', type: 'core' },
  ],
}))

vi.mock('../utils/workouts', () => ({
  getMyWorkout: (...args: unknown[]) => getMyWorkoutMock(...(args as [string])),
  markWorkoutComplete: vi.fn(async () => true),
}))

vi.mock('../store/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'u1' }, isAuthenticated: true }),
}))

const renderMyWorkout = () =>
  render(
    <MemoryRouter initialEntries={['/meu-treino']}>
      <Routes>
        <Route path="/meu-treino" element={<MyWorkout />} />
        <Route path="/home" element={<div>Home Page</div>} />
      </Routes>
    </MemoryRouter>
  )

describe('MyWorkout', () => {
  it('renderiza os exercícios do treino pessoal em lista simples (sem agrupamento de bi-set)', async () => {
    renderMyWorkout()

    await screen.findByText('Treino da Ana')
    expect(screen.getByText('Agachamento')).toBeInTheDocument()
    expect(screen.getByText('Prancha')).toBeInTheDocument()
    expect(screen.queryByText(/bi-set/i)).toBeNull()
  })

  it('mostra estado vazio quando a usuária não tem treino pessoal', async () => {
    getMyWorkoutMock.mockResolvedValueOnce(null as any)
    renderMyWorkout()

    await screen.findByText(/nenhum treino pessoal/i)
    fireEvent.click(screen.getByRole('button', { name: /voltar à home/i }))

    expect(await screen.findByText('Home Page')).toBeInTheDocument()
  })

  it('abre o modal de vídeo ao clicar em "Ver execução"', async () => {
    renderMyWorkout()

    await screen.findByText('Agachamento')
    const watchButtons = await screen.findAllByRole('button', { name: /ver execução/i })
    fireEvent.click(watchButtons[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
  })

  it('ao concluir o treino, navega de volta pra Home', async () => {
    renderMyWorkout()

    await screen.findByText('Treino da Ana')
    fireEvent.click(screen.getByRole('button', { name: /marcar como concluído/i }))

    expect(await screen.findByText('Home Page')).toBeInTheDocument()
  })
})
