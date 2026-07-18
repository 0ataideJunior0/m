import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, selectSingleMock, updateEqMock, preApprovalUpdateMock, fromMock } = vi.hoisted(() => {
  const selectSingleMock = vi.fn()
  const updateEqMock = vi.fn().mockResolvedValue({ error: null })
  const fromMock = vi.fn((table: string) => {
    if (table === 'subscriptions') {
      return {
        select: () => ({ eq: () => ({ single: selectSingleMock }) }),
        update: () => ({ eq: updateEqMock }),
      }
    }
    throw new Error(`unexpected table ${table}`)
  })
  return {
    getUserMock: vi.fn(),
    selectSingleMock,
    updateEqMock,
    preApprovalUpdateMock: vi.fn(),
    fromMock,
  }
})

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({ auth: { getUser: getUserMock }, from: fromMock }),
}))

vi.mock('../../api/_lib/mercadopagoConfig', () => ({
  createMercadoPagoConfig: () => ({ mocked: 'config' }),
}))

vi.mock('mercadopago', () => ({
  PreApproval: vi.fn().mockImplementation(() => ({ update: preApprovalUpdateMock })),
}))

import handler from '../../api/cancel-subscription'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('POST /api/cancel-subscription', () => {
  beforeEach(() => {
    fromMock.mockClear()
    updateEqMock.mockClear()
    preApprovalUpdateMock.mockReset()
  })

  it('retorna 401 sem token', async () => {
    const req: any = { method: 'POST', headers: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('retorna 404 se o usuário não tem assinatura', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    selectSingleMock.mockResolvedValueOnce({ data: null, error: new Error('not found') })

    const req: any = { method: 'POST', headers: { authorization: 'Bearer good-token' } }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })

  it('cancela no Mercado Pago e atualiza a linha local', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    selectSingleMock.mockResolvedValueOnce({
      data: { preapproval_id: 'preapproval-999', status: 'authorized' },
      error: null,
    })
    preApprovalUpdateMock.mockResolvedValueOnce({ id: 'preapproval-999', status: 'cancelled' })

    const req: any = { method: 'POST', headers: { authorization: 'Bearer good-token' } }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalUpdateMock).toHaveBeenCalledWith({
      id: 'preapproval-999',
      body: { status: 'cancelled' },
    })
    expect(updateEqMock).toHaveBeenCalledWith('user_id', 'user-1')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true, status: 'cancelled' })
  })

  it('não chama o Mercado Pago se já está cancelada', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'user-1' } }, error: null })
    selectSingleMock.mockResolvedValueOnce({
      data: { preapproval_id: 'preapproval-999', status: 'cancelled' },
      error: null,
    })

    const req: any = { method: 'POST', headers: { authorization: 'Bearer good-token' } }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalUpdateMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })
})
