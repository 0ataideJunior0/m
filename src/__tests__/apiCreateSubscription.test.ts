import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

const { getUserMock, preApprovalCreateMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  preApprovalCreateMock: vi.fn(),
}))

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({ auth: { getUser: getUserMock } }),
}))

vi.mock('../../api/_lib/mercadopagoConfig', () => ({
  createMercadoPagoConfig: () => ({ mocked: 'config' }),
}))

vi.mock('mercadopago', () => ({
  PreApproval: vi.fn().mockImplementation(() => ({ create: preApprovalCreateMock })),
}))

import handler from '../../api/create-subscription'

// Os preços dependem da data (promoção até 26/09). Fixa o relógio dentro do
// prazo para que estes testes não passem a falhar quando a promoção acabar.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-22T12:00:00-03:00'))
})
afterAll(() => {
  vi.useRealTimers()
})


function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('POST /api/create-subscription', () => {
  it('retorna 405 se não for POST', async () => {
    const req: any = { method: 'GET', headers: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 401 sem token de autorização', async () => {
    const req: any = { method: 'POST', headers: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('retorna 401 com token inválido', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: new Error('invalid') })
    const req: any = { method: 'POST', headers: { authorization: 'Bearer bad-token' } }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('cria a assinatura e retorna init_point', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'ana@example.com' } },
      error: null,
    })
    preApprovalCreateMock.mockResolvedValueOnce({ init_point: 'https://mp.example/checkout/abc' })

    const req: any = {
      method: 'POST',
      headers: { authorization: 'Bearer good-token', host: 'traemusa20lfmz.vercel.app' },
    }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalCreateMock).toHaveBeenCalledWith({
      body: {
        reason: 'Musa Fit30 - Assinatura mensal',
        auto_recurring: {
          frequency: 1,
          frequency_type: 'months',
          transaction_amount: 49.90,
          currency_id: 'BRL',
        },
        payer_email: 'ana@example.com',
        external_reference: 'user-1',
        back_url: 'https://traemusa20lfmz.vercel.app/subscribe',
        status: 'pending',
      },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ init_point: 'https://mp.example/checkout/abc' })
  })

  it('retorna 500 se a criação falhar no Mercado Pago', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'ana@example.com' } },
      error: null,
    })
    preApprovalCreateMock.mockRejectedValueOnce(new Error('mp down'))

    const req: any = {
      method: 'POST',
      headers: { authorization: 'Bearer good-token', host: 'traemusa20lfmz.vercel.app' },
    }
    const res = createMockRes()
    await handler(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
  })
})
