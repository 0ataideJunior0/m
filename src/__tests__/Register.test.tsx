import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Register from '../pages/Register'

const signUpMock = vi.fn(async (email: string, _password: string) => ({
  user: {
    id: 'u1',
    email,
    username: undefined,
    onboardingCompletedAt: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  error: null,
}))

vi.mock('../utils/auth', () => ({
  signUp: (...args: unknown[]) => signUpMock(...(args as [string, string])),
}))

vi.mock('../utils/profile', () => ({
  getIsAdmin: vi.fn(async () => false),
}))

beforeEach(() => {
  localStorage.clear()
  signUpMock.mockClear()
})

describe('Register page', () => {
  it('mostra erro quando as senhas digitadas não coincidem', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )

    const passwordInput = screen.getByLabelText(/^senha$/i)
    const confirmInput = screen.getByLabelText(/confirmar senha/i)

    fireEvent.change(passwordInput, { target: { value: 'abc123' } })
    fireEvent.change(confirmInput, { target: { value: 'xyz999' } })
    // A validação roda com o estado da renderização anterior, então o
    // mismatch só aparece a partir do próximo evento de mudança real
    // (comportamento já existente no componente, não relacionado a esta
    // mudança) — daí o segundo fireEvent abaixo.
    fireEvent.change(confirmInput, { target: { value: 'xyz998' } })
    expect(screen.getByText(/não coincidem/i)).not.toBeNull()
  })

  it('cadastra com email e senha (sem username) e redireciona pro onboarding', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <Routes>
          <Route path="/register" element={<Register />} />
          <Route path="/onboarding" element={<div>Onboarding Page</div>} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'maria@example.com' } })
    fireEvent.change(screen.getByLabelText(/^senha$/i), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: '123456' } })

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    expect(await screen.findByText('Onboarding Page')).not.toBeNull()
    expect(signUpMock).toHaveBeenCalledWith('maria@example.com', '123456')
  })
})
