import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getUserMock, profiles, subscriptionMock, upsertMock, grantInsertMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  profiles: new Map<string, { id: string; is_admin: boolean }>(),
  subscriptionMock: vi.fn(),
  upsertMock: vi.fn(),
  grantInsertMock: vi.fn(),
}))

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_col: string, id: string) => ({
              maybeSingle: async () => ({ data: profiles.get(id) ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'subscriptions') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: subscriptionMock }) }),
          upsert: upsertMock,
        }
      }
      if (table === 'manual_grants') return { insert: grantInsertMock }
      throw new Error(`tabela inesperada: ${table}`)
    },
  }),
}))

import handler from '../../api/admin-grant-access'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

const req = (body: unknown, token = 'tok-admin') => ({
  method: 'POST',
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body,
})

describe('POST /api/admin-grant-access', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-19T12:00:00.000Z'))
    profiles.clear()
    profiles.set('admin-1', { id: 'admin-1', is_admin: true })
    profiles.set('aluna-1', { id: 'aluna-1', is_admin: false })
    getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'admin-1' } }, error: null })
    subscriptionMock.mockReset().mockResolvedValue({ data: null, error: null })
    upsertMock.mockReset().mockResolvedValue({ error: null })
    grantInsertMock.mockReset().mockResolvedValue({ error: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retorna 405 se não for POST', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', headers: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 401 sem token', async () => {
    const res = createMockRes()
    await handler(req({ userId: 'aluna-1', months: 1 }, '') as any, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('retorna 403 quando quem chama não é admin', async () => {
    getUserMock.mockResolvedValue({ data: { user: { id: 'aluna-1' } }, error: null })
    const res = createMockRes()
    await handler(req({ userId: 'aluna-1', months: 1 }) as any, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('rejeita quantidade de meses fora dos pacotes', async () => {
    const res = createMockRes()
    await handler(req({ userId: 'aluna-1', months: 2 }) as any, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('retorna 404 quando a aluna não existe', async () => {
    const res = createMockRes()
    await handler(req({ userId: 'ninguem', months: 1 }) as any, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('libera 1 mês a partir de hoje pra quem não tem acesso', async () => {
    const res = createMockRes()
    await handler(req({ userId: 'aluna-1', months: 1, note: '  Pago em dinheiro  ' }) as any, res)

    expect(grantInsertMock).toHaveBeenCalledWith({
      user_id: 'aluna-1',
      granted_by: 'admin-1',
      months: 1,
      access_until: '2026-11-19T12:00:00.000Z',
      note: 'Pago em dinheiro',
    })
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'aluna-1',
        source: 'manual',
        status: 'authorized',
        next_payment_date: '2026-11-19T12:00:00.000Z',
        preapproval_id: null,
        payment_id: null,
      }),
      { onConflict: 'user_id' }
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ accessUntil: '2026-11-19T12:00:00.000Z' })
  })

  it('soma depois do acesso pago que ainda está valendo', async () => {
    subscriptionMock.mockResolvedValue({
      data: { source: 'pix', status: 'authorized', next_payment_date: '2026-11-05T12:00:00.000Z' },
      error: null,
    })
    const res = createMockRes()
    await handler(req({ userId: 'aluna-1', months: 3 }) as any, res)

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ next_payment_date: '2027-02-05T12:00:00.000Z' }),
      { onConflict: 'user_id' }
    )
  })

  it('bloqueia quando a aluna tem assinatura ativa no cartão (seria cobrada em dobro)', async () => {
    subscriptionMock.mockResolvedValue({
      data: { source: 'preapproval', status: 'authorized', next_payment_date: '2026-11-01T00:00:00.000Z' },
      error: null,
    })
    const res = createMockRes()
    await handler(req({ userId: 'aluna-1', months: 1 }) as any, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(grantInsertMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('não libera acesso se o registro da liberação falhar', async () => {
    grantInsertMock.mockResolvedValue({ error: new Error('boom') })
    const res = createMockRes()
    await handler(req({ userId: 'aluna-1', months: 1 }) as any, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(upsertMock).not.toHaveBeenCalled()
  })

  it('corta anotação longa demais em 500 caracteres', async () => {
    const res = createMockRes()
    await handler(req({ userId: 'aluna-1', months: 1, note: 'x'.repeat(800) }) as any, res)

    expect(grantInsertMock.mock.calls[0][0].note).toHaveLength(500)
  })
})
