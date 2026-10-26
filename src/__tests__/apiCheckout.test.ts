import { describe, it, expect, vi, beforeEach } from 'vitest'

const { listUsersMock, subscriptionMaybeSingleMock, countMock, insertMock, paymentCreateMock, preferenceCreateMock } =
  vi.hoisted(() => ({
    listUsersMock: vi.fn(),
    subscriptionMaybeSingleMock: vi.fn(),
    countMock: vi.fn(),
    insertMock: vi.fn(),
    paymentCreateMock: vi.fn(),
    preferenceCreateMock: vi.fn(),
  }))

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({
    auth: { admin: { listUsers: listUsersMock } },
    from: (table: string) => {
      if (table === 'subscriptions') {
        return { select: () => ({ eq: () => ({ maybeSingle: subscriptionMaybeSingleMock }) }) }
      }
      if (table === 'purchase_intents') {
        return {
          select: () => ({ eq: () => ({ gte: countMock }) }),
          insert: insertMock,
        }
      }
      throw new Error(`tabela inesperada: ${table}`)
    },
  }),
}))

vi.mock('../../api/_lib/mercadopagoConfig', () => ({
  createMercadoPagoConfig: () => ({ mocked: 'config' }),
}))

vi.mock('mercadopago', () => ({
  Payment: vi.fn().mockImplementation(() => ({ create: paymentCreateMock })),
  Preference: vi.fn().mockImplementation(() => ({ create: preferenceCreateMock })),
}))

import handler from '../../api/checkout'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

const req = (body: unknown) => ({
  method: 'POST',
  headers: { host: 'musafit.example' },
  body,
})

const pixCharge = {
  id: 777,
  status: 'pending',
  point_of_interaction: {
    transaction_data: { qr_code: 'copia-e-cola', qr_code_base64: 'b64==', ticket_url: 'https://mp/t' },
  },
}

describe('POST /api/checkout', () => {
  beforeEach(() => {
    delete process.env.CHECKOUT_TEST_EMAILS
    listUsersMock.mockReset().mockResolvedValue({ data: { users: [] }, error: null })
    subscriptionMaybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
    countMock.mockReset().mockResolvedValue({ count: 0, error: null })
    insertMock.mockReset().mockResolvedValue({ error: null })
    paymentCreateMock.mockReset().mockResolvedValue(pixCharge)
    preferenceCreateMock.mockReset().mockResolvedValue({ init_point: 'https://mp/checkout/abc' })
  })

  it('retorna 405 se não for POST', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', headers: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({ error: 'Método não permitido.' })
  })

  it('rejeita e-mail inválido com 400', async () => {
    const res = createMockRes()
    await handler(req({ email: 'nao-e-email', plan: 'mensal', method: 'pix' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'E-mail inválido.' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('rejeita plano inexistente com 400', async () => {
    const res = createMockRes()
    await handler(req({ email: 'a@b.com', plan: 'bienal', method: 'pix' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Plano inválido.' })
  })

  it('rejeita método inválido com 400', async () => {
    const res = createMockRes()
    await handler(req({ email: 'a@b.com', plan: 'mensal', method: 'boleto' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Método de pagamento inválido.' })
  })

  it('recusa o plano teste sem o e-mail na lista, com 403', async () => {
    const res = createMockRes()
    await handler(req({ email: 'a@b.com', plan: 'teste', method: 'pix' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'Plano indisponível.' })
    expect(insertMock).not.toHaveBeenCalled()
    expect(paymentCreateMock).not.toHaveBeenCalled()
  })

  it('aceita o plano teste para e-mail da lista CHECKOUT_TEST_EMAILS', async () => {
    process.env.CHECKOUT_TEST_EMAILS = 'Dev@B.com, outro@b.com'
    const res = createMockRes()
    await handler(req({ email: 'dev@b.com', plan: 'teste', method: 'pix' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({ amount: 0.01 }))
  })

  it('devolve 409 e não cria intent quando o e-mail tem assinatura recorrente ativa', async () => {
    listUsersMock.mockResolvedValueOnce({
      data: { users: [{ id: 'u1', email: 'Ana@B.com' }] },
      error: null,
    })
    subscriptionMaybeSingleMock.mockResolvedValueOnce({
      data: { source: 'preapproval', status: 'authorized' },
      error: null,
    })

    const res = createMockRes()
    await handler(req({ email: 'ana@b.com', plan: 'mensal', method: 'pix' }) as any, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith({ error: 'Você já tem uma assinatura ativa. Entre na sua conta.' })
    expect(insertMock).not.toHaveBeenCalled()
    expect(paymentCreateMock).not.toHaveBeenCalled()
  })

  it('não bloqueia quem tem conta mas sem assinatura recorrente ativa', async () => {
    listUsersMock.mockResolvedValueOnce({ data: { users: [{ id: 'u1', email: 'ana@b.com' }] }, error: null })
    subscriptionMaybeSingleMock.mockResolvedValueOnce({ data: { source: 'pix', status: 'authorized' }, error: null })

    const res = createMockRes()
    await handler(req({ email: 'ana@b.com', plan: 'mensal', method: 'pix' }) as any, res)

    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('devolve 429 com 5 ou mais intents do e-mail na última hora', async () => {
    countMock.mockResolvedValueOnce({ count: 5, error: null })

    const res = createMockRes()
    await handler(req({ email: 'a@b.com', plan: 'mensal', method: 'pix' }) as any, res)

    expect(res.status).toHaveBeenCalledWith(429)
    expect(res.json).toHaveBeenCalledWith({ error: 'Muitas tentativas. Aguarde alguns minutos.' })
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('Pix: grava o intent (e-mail normalizado, UTM, valor do servidor) antes de cobrar', async () => {
    const order: string[] = []
    insertMock.mockImplementation(async () => {
      order.push('insert')
      return { error: null }
    })
    paymentCreateMock.mockImplementation(async () => {
      order.push('charge')
      return pixCharge
    })

    const res = createMockRes()
    await handler(
      req({
        email: '  Ana@B.com ',
        plan: 'trimestral',
        method: 'pix',
        amount: 0.01,
        utm: { source: 'instagram', medium: 'bio', campaign: 'out', content: 'c1', term: 't1' },
        referrer: 'https://instagram.com/',
      }) as any,
      res,
    )

    expect(order).toEqual(['insert', 'charge'])
    const row = insertMock.mock.calls[0][0]
    expect(row).toMatchObject({
      email: 'ana@b.com',
      plan_id: 'trimestral',
      method: 'pix',
      months: 3,
      amount: 129.9,
      utm_source: 'instagram',
      utm_medium: 'bio',
      utm_campaign: 'out',
      utm_content: 'c1',
      utm_term: 't1',
      referrer: 'https://instagram.com/',
    })
    expect(paymentCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          transaction_amount: 129.9,
          payment_method_id: 'pix',
          external_reference: `intent|${row.id}`,
          payer: { email: 'ana@b.com' },
          notification_url: 'https://musafit.example/api/mercadopago-webhook',
        }),
      }),
    )
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({
      intentId: row.id,
      method: 'pix',
      pix: expect.objectContaining({ payment_id: '777', qr_code: 'copia-e-cola' }),
    })
  })

  it('cartão: cria a preferência com 12x e retorno em /comprar/retorno?intent=<id>', async () => {
    const res = createMockRes()
    await handler(req({ email: 'a@b.com', plan: 'semestral', method: 'card' }) as any, res)

    const row = insertMock.mock.calls[0][0]
    expect(row).toMatchObject({ method: 'card', months: 6, amount: 233.4 })
    const body = preferenceCreateMock.mock.calls[0][0].body
    expect(body.payment_methods.installments).toBe(12)
    expect(body.back_urls.success).toBe(`https://musafit.example/comprar/retorno?intent=${row.id}`)
    expect(body.external_reference).toBe(`intent|${row.id}`)
    expect(body.items[0].unit_price).toBe(233.4)
    expect(res.json).toHaveBeenCalledWith({
      intentId: row.id,
      method: 'card',
      init_point: 'https://mp/checkout/abc',
    })
  })

  it('usa http em localhost', async () => {
    const res = createMockRes()
    await handler(
      { method: 'POST', headers: { host: 'localhost:3000' }, body: { email: 'a@b.com', plan: 'mensal', method: 'card' } } as any,
      res,
    )
    const body = preferenceCreateMock.mock.calls[0][0].body
    expect(body.back_urls.success).toMatch(/^http:\/\/localhost:3000\/comprar\/retorno\?intent=/)
  })

  it('retorna 500 quando não consegue gravar o intent, sem cobrar', async () => {
    insertMock.mockResolvedValueOnce({ error: { message: 'boom' } })
    const res = createMockRes()
    await handler(req({ email: 'a@b.com', plan: 'mensal', method: 'pix' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ error: 'Não foi possível iniciar o pagamento. Tente de novo.' })
    expect(paymentCreateMock).not.toHaveBeenCalled()
  })

  it('retorna 502 quando o Mercado Pago responde sem QR Code', async () => {
    paymentCreateMock.mockResolvedValueOnce({ id: 1, status: 'rejected' })
    const res = createMockRes()
    await handler(req({ email: 'a@b.com', plan: 'mensal', method: 'pix' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(502)
    expect(res.json).toHaveBeenCalledWith({ error: 'Não foi possível iniciar o pagamento. Tente de novo.' })
  })
})
