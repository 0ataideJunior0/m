import { describe, it, expect, vi } from 'vitest'

const { profilesOrderMock, profilesEqMock, profilesSelectMock, progressEqMock, progressInMock, progressSelectMock, fromMock } = vi.hoisted(() => {
  const profilesOrderMock = vi.fn()
  const profilesEqMock = vi.fn(() => ({ order: profilesOrderMock }))
  const profilesSelectMock = vi.fn(() => ({ eq: profilesEqMock }))
  const progressEqMock = vi.fn()
  const progressInMock = vi.fn(() => ({ eq: progressEqMock }))
  const progressSelectMock = vi.fn(() => ({ in: progressInMock }))
  const fromMock = vi.fn((table: string) => {
    if (table === 'profiles') return { select: profilesSelectMock }
    if (table === 'user_progress') return { select: progressSelectMock }
    throw new Error(`unexpected table ${table}`)
  })
  return { profilesOrderMock, profilesEqMock, profilesSelectMock, progressEqMock, progressInMock, progressSelectMock, fromMock }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock },
}))

import { listNonAdminUsers } from '../utils/adminUsers'

describe('listNonAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  it('retorna usuários com contagem de dias completos', async () => {
    profilesOrderMock.mockResolvedValueOnce({
      data: [
        { id: 'u1', email: 'ana@example.com', username: 'Ana', created_at: '2026-01-01' },
        { id: 'u2', email: 'bea@example.com', username: null, created_at: '2026-02-01' },
      ],
      error: null,
    })
    progressEqMock.mockResolvedValueOnce({
      data: [{ user_id: 'u1' }, { user_id: 'u1' }, { user_id: 'u2' }],
      error: null,
    })

    const result = await listNonAdminUsers()

    expect(profilesEqMock).toHaveBeenCalledWith('is_admin', false)
    expect(progressInMock).toHaveBeenCalledWith('user_id', ['u1', 'u2'])
    expect(result).toEqual([
      { id: 'u1', email: 'ana@example.com', username: 'Ana', created_at: '2026-01-01', completedDays: 2 },
      { id: 'u2', email: 'bea@example.com', username: null, created_at: '2026-02-01', completedDays: 1 },
    ])
  })

  it('retorna lista vazia sem consultar progresso quando não há usuários', async () => {
    profilesOrderMock.mockResolvedValueOnce({ data: [], error: null })

    const result = await listNonAdminUsers()

    expect(result).toEqual([])
    expect(progressSelectMock).not.toHaveBeenCalled()
  })
})
