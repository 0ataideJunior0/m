import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Register from '../pages/Register'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../utils/auth', () => ({
  signUp: vi.fn(async (email: string, _password: string, username?: string) => ({
    user: {
      id: 'u1',
      email,
      username,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    error: null,
  })),
}))

beforeEach(() => {
  localStorage.clear()
})

describe('Register page', () => {
  it('valida nome de usuária em tempo real', () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )

    const usernameInput = screen.getByLabelText(/nome de usuária/i)
    fireEvent.change(usernameInput, { target: { value: 'ab' } })
    expect(screen.getByText(/mínimo de 3 caracteres/i)).toBeInTheDocument()

    fireEvent.change(usernameInput, { target: { value: 'mariafit' } })
    expect(screen.queryByText(/mínimo de 3 caracteres/i)).toBeNull()
  })

  it('salva username no localStorage após cadastro bem-sucedido', async () => {
    render(
      <MemoryRouter>
        <Register />
      </MemoryRouter>
    )

    fireEvent.change(screen.getByLabelText(/nome de usuária/i), { target: { value: 'maria' } })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'maria@example.com' } })
    fireEvent.change(screen.getByLabelText(/senha/i), { target: { value: '123456' } })
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), { target: { value: '123456' } })

    fireEvent.click(screen.getByRole('button', { name: /criar conta/i }))

    await screen.findByRole('button', { name: /criar conta/i })
    expect(localStorage.getItem('musa_username')).toBe('maria')
  })
})

