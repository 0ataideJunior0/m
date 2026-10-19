import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const {
  profilesOrderMock,
  profilesSingleMock,
  profilesEqMock,
  profilesSelectMock,
  progressInMock,
  progressSelectMock,
  subsInMock,
  getSessionMock,
  fromMock,
} = vi.hoisted(() => {
  const profilesOrderMock = vi.fn()
  const profilesSingleMock = vi.fn()
  const profilesEqMock = vi.fn(() => ({ order: profilesOrderMock, single: profilesSingleMock }))
  const profilesSelectMock = vi.fn(() => ({ eq: profilesEqMock }))
  const progressInMock = vi.fn()
  const progressSelectMock = vi.fn(() => ({ in: progressInMock }))
  const subsInMock = vi.fn()
  const subsSelectMock = vi.fn(() => ({ in: subsInMock }))
  const getSessionMock = vi.fn()
  const fromMock = vi.fn((table: string) => {
    if (table === 'profiles') return { select: profilesSelectMock }
    if (table === 'user_progress') return { select: progressSelectMock }
    if (table === 'subscriptions') return { select: subsSelectMock }
    throw new Error(`unexpected table ${table}`)
  })
  return {
    profilesOrderMock,
    profilesSingleMock,
    profilesEqMock,
    profilesSelectMock,
    progressInMock,
    progressSelectMock,
    subsInMock,
    getSessionMock,
    fromMock,
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, auth: { getSession: getSessionMock } },
}))

import { listNonAdminUsers, getUserProfileSummary, grantAccess } from '../utils/adminUsers'

describe('listNonAdminUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    subsInMock.mockResolvedValue({ data: [], error: null })
  })

  it('retorna usuárias com dias completos e a situação do acesso', async () => {
    profilesOrderMock.mockResolvedValueOnce({
      data: [
        { id: 'u1', email: 'ana@example.com', username: 'Ana', created_at: '2026-01-01' },
        { id: 'u2', email: 'bea@example.com', username: null, created_at: '2026-02-01' },
      ],
      error: null,
    })
    progressInMock.mockResolvedValueOnce({
      data: [
        { user_id: 'u1', completion_count: 2 },
        { user_id: 'u2', completion_count: 1 },
      ],
      error: null,
    })
    subsInMock.mockResolvedValueOnce({
      data: [{ user_id: 'u1', status: 'authorized', source: 'manual', next_payment_date: '2099-01-01T00:00:00.000Z' }],
      error: null,
    })

    const result = await listNonAdminUsers()

    expect(profilesEqMock).toHaveBeenCalledWith('is_admin', false)
    expect(progressInMock).toHaveBeenCalledWith('user_id', ['u1', 'u2'])
    expect(subsInMock).toHaveBeenCalledWith('user_id', ['u1', 'u2'])
    expect(result).toEqual([
      {
        id: 'u1',
        email: 'ana@example.com',
        username: 'Ana',
        created_at: '2026-01-01',
        completedDays: 2,
        access: { active: true, until: '2099-01-01T00:00:00.000Z', source: 'manual' },
      },
      {
        id: 'u2',
        email: 'bea@example.com',
        username: null,
        created_at: '2026-02-01',
        completedDays: 1,
        access: { active: false, until: null, source: null },
      },
    ])
  })

  it('acesso vencido aparece como inativo, mas mantém a data pra admin saber quando acabou', async () => {
    profilesOrderMock.mockResolvedValueOnce({
      data: [{ id: 'u1', email: 'ana@example.com', username: 'Ana', created_at: '2026-01-01' }],
      error: null,
    })
    progressInMock.mockResolvedValueOnce({ data: [], error: null })
    subsInMock.mockResolvedValueOnce({
      data: [{ user_id: 'u1', status: 'authorized', source: 'pix', next_payment_date: '2020-01-01T00:00:00.000Z' }],
      error: null,
    })

    const [ana] = await listNonAdminUsers()

    expect(ana.access).toEqual({ active: false, until: '2020-01-01T00:00:00.000Z', source: 'pix' })
  })

  it('retorna lista vazia sem consultar progresso quando não há usuários', async () => {
    profilesOrderMock.mockResolvedValueOnce({ data: [], error: null })

    const result = await listNonAdminUsers()

    expect(result).toEqual([])
    expect(progressSelectMock).not.toHaveBeenCalled()
  })
})

describe('getUserProfileSummary', () => {
  it('retorna id, email e username da usuária', async () => {
    profilesSingleMock.mockResolvedValueOnce({
      data: { id: 'u1', email: 'ana@example.com', username: 'Ana' },
      error: null,
    })

    const result = await getUserProfileSummary('u1')

    expect(profilesSelectMock).toHaveBeenCalledWith('id, email, username')
    expect(profilesEqMock).toHaveBeenCalledWith('id', 'u1')
    expect(result).toEqual({ id: 'u1', email: 'ana@example.com', username: 'Ana' })
  })

  it('retorna null quando a usuária não existe', async () => {
    profilesSingleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })

    const result = await getUserProfileSummary('inexistente')

    expect(result).toBeNull()
  })
})

describe('grantAccess', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
    getSessionMock.mockReset().mockResolvedValue({ data: { session: { access_token: 'tok-admin' } } })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('chama a API com o token da admin e devolve a nova data de fim', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ accessUntil: '2026-11-19T12:00:00.000Z' }) })

    const result = await grantAccess('u1', 1, 'Pago em dinheiro')

    expect(fetchMock).toHaveBeenCalledWith('/api/admin-grant-access', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok-admin', 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'u1', months: 1, note: 'Pago em dinheiro' }),
    })
    expect(result).toEqual({ accessUntil: '2026-11-19T12:00:00.000Z', error: null })
  })

  it('repassa a mensagem de erro da API (ex.: cartão ativo)', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Esta aluna tem assinatura ativa no cartão.' }) })

    const result = await grantAccess('u1', 1)

    expect(result).toEqual({ accessUntil: null, error: 'Esta aluna tem assinatura ativa no cartão.' })
  })

  it('quando a API não responde (ou responde algo que não é JSON), diz que não falou com o servidor', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => { throw new SyntaxError('Unexpected token <') } })

    const result = await grantAccess('u1', 1)

    expect(result).toEqual({ accessUntil: null, error: 'Não foi possível falar com o servidor. Tente de novo.' })
  })

  it('sem sessão, não chama a API', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } })

    const result = await grantAccess('u1', 1)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.error).toBeTruthy()
  })
})
