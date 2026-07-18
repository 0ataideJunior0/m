import { describe, it, expect, vi, beforeEach } from 'vitest'

const { singleMock, eqMock, selectMock, fromMock, getSessionMock, fetchMock } = vi.hoisted(() => {
  const singleMock = vi.fn()
  const eqMock = vi.fn(() => ({ single: singleMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ select: selectMock }))
  return {
    singleMock,
    eqMock,
    selectMock,
    fromMock,
    getSessionMock: vi.fn(),
    fetchMock: vi.fn(),
  }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: fromMock, auth: { getSession: getSessionMock } },
}))

vi.stubGlobal('fetch', fetchMock)

import {
  getHasActiveSubscription,
  getMySubscription,
  createSubscription,
  cancelSubscription,
} from '../utils/subscription'

describe('getHasActiveSubscription', () => {
  it('retorna true quando status é authorized', async () => {
    singleMock.mockResolvedValueOnce({ data: { status: 'authorized' }, error: null })
    const result = await getHasActiveSubscription('u1')
    expect(fromMock).toHaveBeenCalledWith('subscriptions')
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
    expect(result).toBe(true)
  })

  it('retorna false quando status não é authorized', async () => {
    singleMock.mockResolvedValueOnce({ data: { status: 'pending' }, error: null })
    expect(await getHasActiveSubscription('u2')).toBe(false)
  })

  it('retorna false quando há erro ou não há linha', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    expect(await getHasActiveSubscription('u3')).toBe(false)
  })
})

describe('getMySubscription', () => {
  it('retorna a assinatura quando existe', async () => {
    const row = { id: 's1', user_id: 'u1', preapproval_id: 'p1', status: 'authorized', next_payment_date: null, created_at: '', updated_at: '' }
    singleMock.mockResolvedValueOnce({ data: row, error: null })
    expect(await getMySubscription('u1')).toEqual(row)
  })

  it('retorna null quando não existe', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    expect(await getMySubscription('u2')).toBeNull()
  })
})

describe('createSubscription', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    getSessionMock.mockReset()
  })

  it('retorna erro se não há sessão', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: null } })
    const result = await createSubscription()
    expect(result.error).not.toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('chama a function e retorna init_point', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'tok-1' } } })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ init_point: 'https://mp.example/checkout' }),
    })
    const result = await createSubscription()
    expect(fetchMock).toHaveBeenCalledWith('/api/create-subscription', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok-1' },
    })
    expect(result).toEqual({ initPoint: 'https://mp.example/checkout', error: null })
  })

  it('retorna erro quando a resposta não é ok', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'tok-1' } } })
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'falhou' }),
    })
    const result = await createSubscription()
    expect(result).toEqual({ initPoint: null, error: 'falhou' })
  })
})

describe('cancelSubscription', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    getSessionMock.mockReset()
  })

  it('chama a function e retorna ok', async () => {
    getSessionMock.mockResolvedValueOnce({ data: { session: { access_token: 'tok-1' } } })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, status: 'cancelled' }) })
    const result = await cancelSubscription()
    expect(fetchMock).toHaveBeenCalledWith('/api/cancel-subscription', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok-1' },
    })
    expect(result).toEqual({ ok: true, error: null })
  })
})
