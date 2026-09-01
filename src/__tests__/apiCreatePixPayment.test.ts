import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, paymentCreateMock, maybeSingleMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  return {
    getUserMock: vi.fn(),
    paymentCreateMock: vi.fn(),
    maybeSingleMock,
    fromMock: vi.fn(() => ({ select: selectMock })),
    selectMock,
    eqMock,
  }
})

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
  Payment: vi.fn().mockImplementation(() => ({ create: paymentCreateMock })),
}))

import handler from '../../api/create-pix-payment'

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

const approvedCharge = {
  id: 999,
  status: 'pending',
  point_of_interaction: {
    transaction_data: { qr_code: 'copia-e-cola', qr_code_base64: 'base64==', ticket_url: 'https://mp/ticket' },
  },
}

describe('POST /api/create-pix-payment', () => {
  beforeEach(() => {
    getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'user-1', email: 'a@b.com' } }, error: null })
    paymentCreateMock.mockReset().mockResolvedValue(approvedCharge)
    maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
  })

  it('retorna 405 se não for POST', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', headers: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 401 sem token de autorização', async () => {
    const res = createMockRes()
    await handler({ method: 'POST', headers: {}, body: { plan: 'mensal' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('rejeita plano que não existe', async () => {
    const res = createMockRes()
    await handler(authedReq({ plan: 'anual' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(paymentCreateMock).not.toHaveBeenCalled()
  })

  it('cobra o valor da tabela do servidor, ignorando qualquer valor vindo do cliente', async () => {
    const res = createMockRes()
    await handler(authedReq({ plan: 'trimestral', amount: 0.01, transaction_amount: 0.01 }) as any, res)

    expect(paymentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          transaction_amount: 149.9,
          payment_method_id: 'pix',
          external_reference: 'user-1|pix|3',
        }),
      })
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('devolve o QR Code e o copia e cola', async () => {
    const res = createMockRes()
    await handler(authedReq({ plan: 'mensal' }) as any, res)

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_id: '999',
        qr_code: 'copia-e-cola',
        qr_code_base64: 'base64==',
        amount: 59.9,
        months: 1,
      })
    )
  })

  it('bloqueia quem já tem assinatura ativa no cartão, para não ser cobrada duas vezes', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { source: 'preapproval', status: 'authorized' },
      error: null,
    })

    const res = createMockRes()
    await handler(authedReq({ plan: 'mensal' }) as any, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(paymentCreateMock).not.toHaveBeenCalled()
  })

  it('permite Pix quando a assinatura no cartão já foi cancelada', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { source: 'preapproval', status: 'cancelled' },
      error: null,
    })

    const res = createMockRes()
    await handler(authedReq({ plan: 'mensal' }) as any, res)

    expect(paymentCreateMock).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('permite renovação de quem já pagou via Pix', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { source: 'pix', status: 'authorized' },
      error: null,
    })

    const res = createMockRes()
    await handler(authedReq({ plan: 'trimestral' }) as any, res)

    expect(paymentCreateMock).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('retorna 502 quando o Mercado Pago responde sem QR Code', async () => {
    paymentCreateMock.mockResolvedValueOnce({ id: 1, status: 'rejected', point_of_interaction: undefined })

    const res = createMockRes()
    await handler(authedReq({ plan: 'mensal' }) as any, res)

    expect(res.status).toHaveBeenCalledWith(502)
  })
})
