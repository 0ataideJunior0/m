import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { getSessionMock, claimAccessMock } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  claimAccessMock: vi.fn(async (_step: string) => ({ ok: true })),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: getSessionMock, updateUser: vi.fn() } },
}))
vi.mock('../utils/checkout', () => ({
  claimAccess: (step: string) => claimAccessMock(step),
}))

import ResetPassword from '../pages/ResetPassword'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ResetPassword page', () => {
  it('com sessão de recuperação, mostra o formulário e registra link_opened uma vez', async () => {
    getSessionMock.mockResolvedValue({ data: { session: { access_token: 'tok' } } })
    render(<MemoryRouter><ResetPassword /></MemoryRouter>)

    expect(await screen.findByText('Definir nova senha')).not.toBeNull()
    await waitFor(() => expect(claimAccessMock).toHaveBeenCalledWith('link_opened'))
    expect(claimAccessMock).toHaveBeenCalledTimes(1)
  })

  it('sem sessão não registra nada', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })
    render(<MemoryRouter><ResetPassword /></MemoryRouter>)

    await waitFor(() => expect(getSessionMock).toHaveBeenCalled())
    expect(claimAccessMock).not.toHaveBeenCalled()
  })
})
