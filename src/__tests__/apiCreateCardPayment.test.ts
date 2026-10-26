import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, preferenceCreateMock, maybeSingleMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  preferenceCreateMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}))

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({
    auth: { getUser: getUserMock },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }) }),
  }),
}))

vi.mock('../../api/_lib/mercadopagoConfig', () => ({
  createMercadoPagoConfig: () => ({ mocked: 'config' }),
}))

vi.mock('mercadopago', () => ({
  Preference: vi.fn().mockImplementation(() => ({ create: preferenceCreateMock })),
}))

import handler from '../../api/create-card-payment'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

const authedReq = (body: unknown) => ({
  method: 'POST',
  headers: { authorization: 'Bearer tok-1', host: 'musafit.example' },
  body,
})

describe('POST /api/create-card-payment', () => {
  beforeEach(() => {
    getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'u1', email: 'a@b.com' } }, error: null })
    preferenceCreateMock.mockReset().mockResolvedValue({ init_point: 'https://mp/checkout/xyz' })
    maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
  })

  it('retorna 405 se não for POST', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', headers: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 401 sem token', async () => {
    const res = createMockRes()
    await handler({ method: 'POST', headers: {}, body: { plan: 'semestral' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejeita plano inexistente', async () => {
    const res = createMockRes()
    await handler(authedReq({ plan: 'bienal' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
  })

  it('cria a preferência com referência u1|card|6 e volta para /subscribe', async () => {
    const res = createMockRes()
    await handler(authedReq({ plan: 'semestral', amount: 0.01 }) as any, res)

    const body = preferenceCreateMock.mock.calls[0][0].body
    expect(body.external_reference).toBe('u1|card|6')
    expect(body.items[0].unit_price).toBe(233.4)
    expect(body.payment_methods.installments).toBe(12)
    expect(body.payer.email).toBe('a@b.com')
    expect(body.back_urls.success).toBe('https://musafit.example/subscribe')
    expect(body.notification_url).toBe('https://musafit.example/api/mercadopago-webhook')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ init_point: 'https://mp/checkout/xyz' })
  })

  it('recusa o plano teste para quem não é admin', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { is_admin: false }, error: null })
    const res = createMockRes()
    await handler(authedReq({ plan: 'teste' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(preferenceCreateMock).not.toHaveBeenCalled()
  })

  it('bloqueia com 409 quem tem assinatura recorrente ativa', async () => {
    maybeSingleMock.mockResolvedValueOnce({ data: { source: 'preapproval', status: 'authorized' }, error: null })
    const res = createMockRes()
    await handler(authedReq({ plan: 'mensal' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(409)
    expect(preferenceCreateMock).not.toHaveBeenCalled()
  })

  it('retorna 500 quando o Mercado Pago falha', async () => {
    preferenceCreateMock.mockRejectedValueOnce(new Error('mp down'))
    const res = createMockRes()
    await handler(authedReq({ plan: 'mensal' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})
