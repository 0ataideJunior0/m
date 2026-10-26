import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  validateMock,
  preApprovalGetMock,
  paymentGetMock,
  upsertMock,
  updateMock,
  pixInsertMock,
  pixDeleteEqMock,
  maybeSingleMock,
  intentMaybeSingleMock,
  intentUpdateMock,
  intentUpdateFilters,
  verificationMaybeSingleMock,
  listUsersMock,
  getUserByIdMock,
  createUserMock,
  signInWithOtpMock,
  fromMock,
  FakeInvalidWebhookSignatureError,
} = vi.hoisted(() => {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const updateEqMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))
  const pixInsertMock = vi.fn().mockResolvedValue({ error: null })
  const pixDeleteEqMock = vi.fn().mockResolvedValue({ error: null })
  // subscriptions
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  // purchase_intents
  const intentMaybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
  // Cada update registra os filtros que recebeu (eq/neq/is), para os testes
  // conferirem que a gravação é condicional.
  const intentUpdateFilters: Array<Array<[string, string, unknown]>> = []
  const intentUpdateMock = vi.fn((_payload: unknown) => {
    const filters: Array<[string, string, unknown]> = []
    intentUpdateFilters.push(filters)
    const chain: any = {
      then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
    }
    for (const op of ['eq', 'neq', 'is']) {
      chain[op] = (col: string, val: unknown) => {
        filters.push([op, col, val])
        return chain
      }
    }
    return chain
  })
  // email_verifications
  const verificationMaybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const fromMock = vi.fn((table: string) => {
    if (table === 'pix_payments') {
      return { insert: pixInsertMock, delete: () => ({ eq: pixDeleteEqMock }) }
    }
    if (table === 'purchase_intents') {
      return { select: () => ({ eq: () => ({ maybeSingle: intentMaybeSingleMock }) }), update: intentUpdateMock }
    }
    if (table === 'email_verifications') {
      return { select: () => ({ eq: () => ({ maybeSingle: verificationMaybeSingleMock }) }) }
    }
    return { upsert: upsertMock, select: selectMock, update: updateMock }
  })
  class FakeInvalidWebhookSignatureError extends Error {}
  return {
    validateMock: vi.fn(),
    preApprovalGetMock: vi.fn(),
    paymentGetMock: vi.fn(),
    upsertMock,
    updateMock,
    pixInsertMock,
    pixDeleteEqMock,
    maybeSingleMock,
    intentMaybeSingleMock,
    intentUpdateMock,
    intentUpdateFilters,
    verificationMaybeSingleMock,
    listUsersMock: vi.fn(),
    getUserByIdMock: vi.fn(),
    createUserMock: vi.fn(),
    signInWithOtpMock: vi.fn(),
    fromMock,
    FakeInvalidWebhookSignatureError,
  }
})

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({
    from: fromMock,
    auth: {
      admin: { listUsers: listUsersMock, getUserById: getUserByIdMock, createUser: createUserMock },
      signInWithOtp: signInWithOtpMock,
    },
  }),
}))

vi.mock('../../api/_lib/mercadopagoConfig', () => ({
  createMercadoPagoConfig: () => ({ mocked: 'config' }),
}))

vi.mock('mercadopago', () => ({
  PreApproval: vi.fn().mockImplementation(() => ({ get: preApprovalGetMock })),
  Payment: vi.fn().mockImplementation(() => ({ get: paymentGetMock })),
  WebhookSignatureValidator: { validate: validateMock },
  InvalidWebhookSignatureError: FakeInvalidWebhookSignatureError,
}))

import handler from '../../api/mercadopago-webhook'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

describe('POST /api/mercadopago-webhook', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'secret-abc')
    fromMock.mockClear()
    upsertMock.mockClear()
    maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
    paymentGetMock.mockReset()
    pixInsertMock.mockReset().mockResolvedValue({ error: null })
    updateMock.mockClear()
  })

  it('retorna 405 se não for POST', async () => {
    const req: any = { method: 'GET', headers: {}, query: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 500 quando MERCADOPAGO_WEBHOOK_SECRET não está configurado', async () => {
    vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', '')
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': '999', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(validateMock).not.toHaveBeenCalled()
  })

  it('retorna 401 quando a assinatura é inválida', async () => {
    validateMock.mockImplementationOnce(() => {
      throw new FakeInvalidWebhookSignatureError('bad signature')
    })
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=bad', 'x-request-id': 'req-1' },
      query: { 'data.id': '999', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('ignora e responde 200 para tipos de evento desconhecidos', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': '999', type: 'invoice' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(preApprovalGetMock).not.toHaveBeenCalled()
  })

  it('busca o estado real e faz upsert em subscriptions para subscription_preapproval', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({
      id: 'preapproval-999',
      external_reference: 'user-1',
      status: 'authorized',
      next_payment_date: '2026-08-18T00:00:00.000Z',
    })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-999', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalGetMock).toHaveBeenCalledWith({ id: 'preapproval-999' })
    expect(fromMock).toHaveBeenCalledWith('subscriptions')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        preapproval_id: 'preapproval-999',
        status: 'authorized',
        next_payment_date: '2026-08-18T00:00:00.000Z',
      }),
      { onConflict: 'user_id' }
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('assinar no cartão não encurta um acesso liberado manualmente que vai além da data do cartão', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({
      id: 'preapproval-777',
      external_reference: 'user-1',
      status: 'authorized',
      next_payment_date: '2026-08-18T00:00:00.000Z',
    })
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        preapproval_id: null,
        created_at: '2026-07-01T00:00:00.000Z',
        source: 'manual',
        next_payment_date: '2026-12-01T00:00:00.000Z',
      },
      error: null,
    })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-777', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ preapproval_id: 'preapproval-777', next_payment_date: '2026-12-01T00:00:00.000Z' }),
      { onConflict: 'user_id' }
    )
  })

  it('ignora notificação atrasada de uma preapproval já superada por uma assinatura mais nova', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({
      id: 'preapproval-OLD',
      external_reference: 'user-1',
      status: 'cancelled',
      date_created: '2026-08-01T00:00:00.000Z',
    })
    maybeSingleMock.mockResolvedValueOnce({
      data: { preapproval_id: 'preapproval-NEW', created_at: '2026-08-10T00:00:00.000Z' },
      error: null,
    })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-OLD', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)

    expect(upsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('processa normalmente quando a notificação é da mesma preapproval que já está salva', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({
      id: 'preapproval-NEW',
      external_reference: 'user-1',
      status: 'authorized',
      next_payment_date: '2026-09-10T00:00:00.000Z',
      date_created: '2026-08-10T00:00:00.000Z',
    })
    maybeSingleMock.mockResolvedValueOnce({
      data: { preapproval_id: 'preapproval-NEW', created_at: '2026-08-10T00:00:00.000Z' },
      error: null,
    })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-NEW', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', preapproval_id: 'preapproval-NEW', status: 'authorized' }),
      { onConflict: 'user_id' }
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('ignora quando o recurso não tem external_reference', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({ id: 'preapproval-999', status: 'authorized' })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-999', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)

    expect(upsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('processa quando body.type é subscription_preapproval mesmo com query.type divergente', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({
      id: 'preapproval-999',
      external_reference: 'user-1',
      status: 'authorized',
      next_payment_date: '2026-08-18T00:00:00.000Z',
    })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-999', type: 'subscription_authorized_payment' },
      body: { type: 'subscription_preapproval', entity: 'preapproval', data: { id: 'preapproval-999' } },
    }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalGetMock).toHaveBeenCalledWith({ id: 'preapproval-999' })
    expect(upsertMock).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('processa quando body.entity é preapproval mesmo sem body.type', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockResolvedValueOnce({
      id: 'preapproval-999',
      external_reference: 'user-1',
      status: 'authorized',
      next_payment_date: null,
    })

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'preapproval-999' },
      body: { entity: 'preapproval', data: { id: 'preapproval-999' } },
    }
    const res = createMockRes()
    await handler(req, res)

    expect(preApprovalGetMock).toHaveBeenCalledWith({ id: 'preapproval-999' })
    expect(upsertMock).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('retorna 500 e não deixa exceção sem tratamento quando a busca no Mercado Pago falha', async () => {
    validateMock.mockImplementationOnce(() => undefined)
    preApprovalGetMock.mockRejectedValueOnce(new Error('not found'))

    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': '123456', type: 'subscription_preapproval' },
      body: {},
    }
    const res = createMockRes()
    await handler(req, res)

    expect(upsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

describe('POST /api/mercadopago-webhook — pagamentos Pix', () => {
  const pixReq = (dataId = 'pay-1') => ({
    method: 'POST',
    headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
    query: { 'data.id': dataId, type: 'payment' },
    body: {},
  })

  beforeEach(() => {
    vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'secret-abc')
    fromMock.mockClear()
    upsertMock.mockClear()
    updateMock.mockClear()
    maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
    paymentGetMock.mockReset()
    pixInsertMock.mockReset().mockResolvedValue({ error: null })
    validateMock.mockImplementation(() => undefined)
  })

  it('credita o período no primeiro Pix aprovado', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
    paymentGetMock.mockResolvedValueOnce({
      id: 12345,
      status: 'approved',
      transaction_amount: 149.9,
      external_reference: 'user-1|pix|3',
    })

    const res = createMockRes()
    await handler(pixReq() as any, res)
    vi.useRealTimers()

    expect(pixInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_id: '12345', user_id: 'user-1', months: 3, amount: 149.9 })
    )
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        source: 'pix',
        payment_id: '12345',
        preapproval_id: null,
        status: 'authorized',
        next_payment_date: '2026-11-19T12:00:00.000Z',
      }),
      { onConflict: 'user_id' }
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('não credita nada enquanto o pagamento não foi aprovado', async () => {
    paymentGetMock.mockResolvedValueOnce({ id: 1, status: 'pending', external_reference: 'user-1|pix|1' })

    const res = createMockRes()
    await handler(pixReq() as any, res)

    expect(pixInsertMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('é idempotente: reentrega do mesmo pagamento não credita período de novo', async () => {
    paymentGetMock.mockResolvedValueOnce({
      id: 12345,
      status: 'approved',
      transaction_amount: 149.9,
      external_reference: 'user-1|pix|3',
    })
    // UNIQUE violation no livro-razão = já processamos este pagamento antes
    pixInsertMock.mockResolvedValueOnce({ error: { code: '23505' } })

    const res = createMockRes()
    await handler(pixReq() as any, res)

    expect(upsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('ignora pagamento aprovado que não é de um plano Pix nosso', async () => {
    paymentGetMock.mockResolvedValueOnce({
      id: 999,
      status: 'approved',
      external_reference: '224e4c07-a10c-49e6-ba3e-ffa7f6c38e99',
    })

    const res = createMockRes()
    await handler(pixReq() as any, res)

    expect(pixInsertMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('renovação antecipada soma ao período que ainda resta, em vez de descartá-lo', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
    paymentGetMock.mockResolvedValueOnce({
      id: 222,
      status: 'approved',
      transaction_amount: 149.9,
      external_reference: 'user-1|pix|3',
    })
    // ainda tem 1 mês de acesso pago
    maybeSingleMock.mockResolvedValueOnce({
      data: { source: 'pix', status: 'authorized', next_payment_date: '2026-09-19T12:00:00.000Z' },
      error: null,
    })

    const res = createMockRes()
    await handler(pixReq() as any, res)
    vi.useRealTimers()

    // 19/09 + 3 meses = 19/12, e não 19/11 (que seria descartar o mês restante)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ next_payment_date: '2026-12-19T12:00:00.000Z' }),
      { onConflict: 'user_id' }
    )
  })

  it('Pix pago em cima de um mês liberado manualmente soma ao que resta dele', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-19T12:00:00.000Z'))
    paymentGetMock.mockResolvedValueOnce({
      id: 223,
      status: 'approved',
      transaction_amount: 49.9,
      external_reference: 'user-1|pix|1',
    })
    maybeSingleMock.mockResolvedValueOnce({
      data: { source: 'manual', status: 'authorized', next_payment_date: '2026-09-10T12:00:00.000Z' },
      error: null,
    })

    const res = createMockRes()
    await handler(pixReq('pay-223') as any, res)
    vi.useRealTimers()

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'pix', next_payment_date: '2026-10-10T12:00:00.000Z' }),
      { onConflict: 'user_id' }
    )
  })

  it('credita o acesso mas preserva a assinatura no cartão quando as duas coexistem', async () => {
    paymentGetMock.mockResolvedValueOnce({
      id: 333,
      status: 'approved',
      transaction_amount: 59.9,
      external_reference: 'user-1|pix|1',
    })
    maybeSingleMock.mockResolvedValueOnce({
      data: { source: 'preapproval', status: 'authorized', preapproval_id: 'pa-1', next_payment_date: null },
      error: null,
    })

    const res = createMockRes()
    await handler(pixReq() as any, res)

    // não sobrescreve a linha do cartão (senão o cancelamento pararia de funcionar),
    // mas o acesso pago é creditado do mesmo jeito
    expect(upsertMock).not.toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ next_payment_date: expect.any(String) })
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

describe('POST /api/mercadopago-webhook — origem do data.id', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'secret-abc')
    validateMock.mockReset().mockImplementation(() => undefined)
    paymentGetMock.mockReset().mockResolvedValue({ id: 1, status: 'pending' })
    preApprovalGetMock.mockReset().mockResolvedValue({ id: 'pa-1', status: 'authorized' })
  })

  // Visto em produção: parte das notificações do MP não traz data.id na query,
  // só no corpo. Validar com id vazio quebra a assinatura (SignatureMismatch).
  it('usa o data.id do corpo quando a query não traz', async () => {
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { type: 'payment' },
      body: { type: 'payment', data: { id: '175689105273' } },
    }
    await handler(req, createMockRes())

    expect(validateMock).toHaveBeenCalledWith(expect.objectContaining({ dataId: '175689105273' }))
  })

  it('prefere a query quando as duas trazem o id', async () => {
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'da-query', type: 'payment' },
      body: { type: 'payment', data: { id: 'do-corpo' } },
    }
    await handler(req, createMockRes())

    expect(validateMock).toHaveBeenCalledWith(expect.objectContaining({ dataId: 'da-query' }))
  })

  it('passa string vazia quando não há id em lugar nenhum, sem quebrar', async () => {
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { type: 'subscription_preapproval' },
      body: {},
    }
    await handler(req, createMockRes())

    expect(validateMock).toHaveBeenCalledWith(expect.objectContaining({ dataId: '' }))
  })
})

// Formato IPN antigo, observado em produção em 2026-09-01: o mesmo evento
// chega também como { query: {id, topic}, body: {resource, topic} }.
describe('POST /api/mercadopago-webhook — formato IPN antigo', () => {
  beforeEach(() => {
    vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'secret-abc')
    validateMock.mockReset().mockImplementation(() => undefined)
    paymentGetMock.mockReset().mockResolvedValue({ id: 1, status: 'pending' })
  })

  it('valida a assinatura com o id que o IPN antigo manda na query', async () => {
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { id: '176645487138', topic: 'payment' },
      body: { resource: '176645487138', topic: 'payment' },
    }
    await handler(req, createMockRes())

    expect(validateMock).toHaveBeenCalledWith(expect.objectContaining({ dataId: '176645487138' }))
    expect(paymentGetMock).toHaveBeenCalledWith({ id: '176645487138' })
  })

  it('extrai o id quando o IPN manda uma URL completa em resource', async () => {
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { topic: 'payment' },
      body: { resource: 'https://api.mercadolibre.com/collections/notifications/999', topic: 'payment' },
    }
    await handler(req, createMockRes())

    expect(validateMock).toHaveBeenCalledWith(expect.objectContaining({ dataId: '999' }))
  })

  it('o formato moderno continua tendo precedência quando os dois estão presentes', async () => {
    const req: any = {
      method: 'POST',
      headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
      query: { 'data.id': 'moderno', id: 'antigo', type: 'payment' },
      body: { type: 'payment', data: { id: 'moderno' }, resource: 'antigo' },
    }
    await handler(req, createMockRes())

    expect(validateMock).toHaveBeenCalledWith(expect.objectContaining({ dataId: 'moderno' }))
  })
})

describe('POST /api/mercadopago-webhook — checkout aberto (intent) e cartão avulso', () => {
  const INTENT_ID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'
  const payReq = (dataId = 'pay-9') => ({
    method: 'POST',
    headers: { 'x-signature': 'ts=1,v1=good', 'x-request-id': 'req-1' },
    query: { 'data.id': dataId, type: 'payment' },
    body: {},
  })
  const approvedIntentPayment = {
    id: 777,
    status: 'approved',
    transaction_amount: 129.9,
    external_reference: `intent|${INTENT_ID}`,
  }
  const pendingIntent = {
    id: INTENT_ID,
    email: 'ana@exemplo.com',
    months: 3,
    method: 'pix',
    status: 'pending',
    user_id: null,
    access_email_sent_at: null,
  }

  beforeEach(() => {
    vi.stubEnv('MERCADOPAGO_WEBHOOK_SECRET', 'secret-abc')
    vi.stubEnv('PUBLIC_APP_URL', 'https://musafit.me')
    validateMock.mockReset().mockImplementation(() => undefined)
    fromMock.mockClear()
    upsertMock.mockClear()
    updateMock.mockClear()
    maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
    paymentGetMock.mockReset()
    pixInsertMock.mockReset().mockResolvedValue({ error: null })
    intentMaybeSingleMock.mockReset().mockResolvedValue({ data: pendingIntent, error: null })
    intentUpdateMock.mockClear()
    intentUpdateFilters.length = 0
    pixDeleteEqMock.mockClear()
    verificationMaybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
    listUsersMock.mockReset().mockResolvedValue({ data: { users: [] }, error: null })
    getUserByIdMock.mockReset().mockResolvedValue({ data: { user: { id: 'old-user', email: 'Ana@Exemplo.com' } }, error: null })
    createUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'new-user' } }, error: null })
    signInWithOtpMock.mockReset().mockResolvedValue({ data: {}, error: null })
  })

  it('conta nova: cria a usuária, credita 3 meses, marca o intent pago e manda o link de acesso', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'))
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)

    const res = createMockRes()
    await handler(payReq() as any, res)
    vi.useRealTimers()

    expect(createUserMock).toHaveBeenCalledWith({ email: 'ana@exemplo.com', email_confirm: true })
    expect(pixInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ payment_id: '777', user_id: 'new-user', months: 3, amount: 129.9 }),
    )
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'new-user', source: 'pix', next_payment_date: '2027-01-26T12:00:00.000Z' }),
      { onConflict: 'user_id' },
    )
    expect(intentUpdateMock).toHaveBeenCalledWith({
      status: 'paid',
      paid_at: '2026-10-26T12:00:00.000Z',
      payment_id: '777',
      user_id: 'new-user',
      last_payment_status: 'approved',
    })
    // marcar pago é condicional: nunca reescreve um intent já pago
    expect(intentUpdateFilters[0]).toEqual([
      ['eq', 'id', INTENT_ID],
      ['neq', 'status', 'paid'],
    ])
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'ana@exemplo.com',
      options: { shouldCreateUser: false, emailRedirectTo: 'https://musafit.me/primeiro-acesso' },
    })
    expect(intentUpdateMock).toHaveBeenCalledWith({ access_email_sent_at: '2026-10-26T12:00:00.000Z' })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('cartão no checkout aberto grava source card', async () => {
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    intentMaybeSingleMock.mockResolvedValueOnce({ data: { ...pendingIntent, method: 'card' }, error: null })

    await handler(payReq() as any, createMockRes())

    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ source: 'card' }), { onConflict: 'user_id' })
  })

  it('conta existente com e-mail provado: credita, sem createUser e sem e-mail', async () => {
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    listUsersMock.mockResolvedValueOnce({ data: { users: [{ id: 'old-user', email: 'Ana@Exemplo.com' }] }, error: null })
    verificationMaybeSingleMock.mockResolvedValueOnce({ data: { email: 'ana@exemplo.com' }, error: null })

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(createUserMock).not.toHaveBeenCalled()
    expect(getUserByIdMock).toHaveBeenCalledWith('old-user')
    expect(pixInsertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'old-user' }))
    expect(intentUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', user_id: 'old-user' }))
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('prova de OUTRO e-mail (conta trocou de e-mail depois de provar): conta como não provada e manda o link', async () => {
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    listUsersMock.mockResolvedValueOnce({ data: { users: [{ id: 'old-user', email: 'ana@exemplo.com' }] }, error: null })
    verificationMaybeSingleMock.mockResolvedValueOnce({ data: { email: 'antigo@exemplo.com' }, error: null })

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(signInWithOtpMock).toHaveBeenCalledTimes(1)
    expect(intentUpdateMock).toHaveBeenCalledWith({ access_email_sent_at: expect.any(String) })
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('conta existente sem e-mail provado: credita e manda o link de acesso', async () => {
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    listUsersMock.mockResolvedValueOnce({ data: { users: [{ id: 'old-user', email: 'ana@exemplo.com' }] }, error: null })

    await handler(payReq() as any, createMockRes())

    expect(createUserMock).not.toHaveBeenCalled()
    expect(pixInsertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'old-user' }))
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1)
  })

  it('reentrega de intent já concluído (ledger 23505): não cria conta nem manda e-mail de novo', async () => {
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    intentMaybeSingleMock.mockResolvedValueOnce({
      data: {
        ...pendingIntent,
        status: 'paid',
        user_id: 'new-user',
        payment_id: '777',
        access_email_sent_at: '2026-10-26T12:00:00.000Z',
      },
      error: null,
    })
    pixInsertMock.mockResolvedValueOnce({ error: { code: '23505' } })

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(createUserMock).not.toHaveBeenCalled()
    expect(listUsersMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled()
    expect(intentUpdateMock).not.toHaveBeenCalled()
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('reentrega depois de falha parcial (período creditado, intent ainda pendente): termina conta e e-mail', async () => {
    // A entrega anterior criou a conta e gravou o livro-razão, mas caiu antes
    // de marcar o intent. A reentrega acha a conta pelo e-mail e conclui.
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    listUsersMock.mockResolvedValueOnce({ data: { users: [{ id: 'new-user', email: 'ana@exemplo.com' }] }, error: null })
    pixInsertMock.mockResolvedValueOnce({ error: { code: '23505' } })

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(createUserMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled() // período não é creditado duas vezes
    expect(intentUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', user_id: 'new-user' }))
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('reentrega com intent pago mas e-mail ainda não enviado: manda o e-mail sem remarcar o intent', async () => {
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    intentMaybeSingleMock.mockResolvedValueOnce({
      data: { ...pendingIntent, status: 'paid', user_id: 'new-user', payment_id: '777' },
      error: null,
    })
    pixInsertMock.mockResolvedValueOnce({ error: { code: '23505' } })

    await handler(payReq() as any, createMockRes())

    expect(createUserMock).not.toHaveBeenCalled()
    expect(intentUpdateMock).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }))
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1)
    expect(intentUpdateMock).toHaveBeenCalledWith({ access_email_sent_at: expect.any(String) })
  })

  it('intent com user_id já preenchido: usa esse id e não busca por e-mail', async () => {
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    intentMaybeSingleMock.mockResolvedValueOnce({ data: { ...pendingIntent, user_id: 'known-user' }, error: null })

    await handler(payReq() as any, createMockRes())

    expect(listUsersMock).not.toHaveBeenCalled()
    expect(createUserMock).not.toHaveBeenCalled()
    expect(pixInsertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'known-user' }))
  })

  it('createUser corrido por outra entrega ("already registered"): busca de novo e segue', async () => {
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    listUsersMock
      .mockResolvedValueOnce({ data: { users: [] }, error: null })
      .mockResolvedValueOnce({ data: { users: [{ id: 'raced-user', email: 'ana@exemplo.com' }] }, error: null })
    createUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { code: 'email_exists', message: 'A user with this email address has already been registered' },
    })

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(pixInsertMock).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'raced-user' }))
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('outro erro no createUser vira 500 e nada é creditado (o MP reenvia)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    createUserMock.mockResolvedValueOnce({ data: { user: null }, error: { code: 'unexpected_failure', message: 'boom' } })

    const res = createMockRes()
    await handler(payReq() as any, res)
    errorSpy.mockRestore()

    expect(pixInsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('sem PUBLIC_APP_URL e precisando mandar o e-mail: 500 sem marcar o envio (o MP reenvia)', async () => {
    vi.stubEnv('PUBLIC_APP_URL', '')
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(errorSpy).toHaveBeenCalledWith(
      'mercadopago-webhook processing error:',
      expect.objectContaining({ error: expect.stringContaining('PUBLIC_APP_URL') }),
    )
    errorSpy.mockRestore()
    expect(upsertMock).toHaveBeenCalled()
    expect(intentUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid' }))
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(intentUpdateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ access_email_sent_at: expect.anything() }),
    )
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('sem PUBLIC_APP_URL mas com e-mail provado (não manda e-mail): 200', async () => {
    vi.stubEnv('PUBLIC_APP_URL', '')
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    listUsersMock.mockResolvedValueOnce({ data: { users: [{ id: 'old-user', email: 'ana@exemplo.com' }] }, error: null })
    verificationMaybeSingleMock.mockResolvedValueOnce({ data: { email: 'ana@exemplo.com' }, error: null })

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('falha no envio do e-mail vira 500 sem marcar access_email_sent_at (o MP reenvia)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    signInWithOtpMock.mockResolvedValueOnce({ data: {}, error: { message: 'smtp down' } })

    const res = createMockRes()
    await handler(payReq() as any, res)
    errorSpy.mockRestore()

    expect(intentUpdateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ access_email_sent_at: expect.anything() }),
    )
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('falha ao gravar a assinatura: 500, livro-razão desfeito, intent não marcado e sem e-mail', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    upsertMock.mockResolvedValueOnce({ error: { code: 'XX000', message: 'boom' } })

    const res = createMockRes()
    await handler(payReq() as any, res)
    errorSpy.mockRestore()

    expect(pixDeleteEqMock).toHaveBeenCalledWith('payment_id', '777')
    expect(intentUpdateMock).not.toHaveBeenCalled()
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(500)
  })

  it('reentrega depois dessa falha credita normalmente e conclui', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    // 1ª entrega: conta criada, livro-razão gravado, assinatura falha → desfeito
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    upsertMock.mockResolvedValueOnce({ error: { code: 'XX000', message: 'boom' } })
    const first = createMockRes()
    await handler(payReq() as any, first)
    errorSpy.mockRestore()
    expect(first.status).toHaveBeenCalledWith(500)

    // 2ª entrega: a conta já existe; o livro-razão aceita de novo (linha apagada)
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    listUsersMock.mockResolvedValueOnce({ data: { users: [{ id: 'new-user', email: 'ana@exemplo.com' }] }, error: null })
    const second = createMockRes()
    await handler(payReq() as any, second)

    expect(createUserMock).toHaveBeenCalledTimes(1)
    expect(pixInsertMock).toHaveBeenCalledTimes(2)
    expect(upsertMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ user_id: 'new-user', source: 'pix' }),
      { onConflict: 'user_id' },
    )
    expect(intentUpdateMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'paid', user_id: 'new-user' }))
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1)
    expect(second.status).toHaveBeenCalledWith(200)
  })

  it('intent inexistente: ignora sem criar conta nem creditar', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    paymentGetMock.mockResolvedValueOnce(approvedIntentPayment)
    intentMaybeSingleMock.mockResolvedValueOnce({ data: null, error: null })

    const res = createMockRes()
    await handler(payReq() as any, res)
    errorSpy.mockRestore()

    expect(createUserMock).not.toHaveBeenCalled()
    expect(pixInsertMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('cartão avulso logado (u1|card|1) aprovado: credita com source card, sem e-mail', async () => {
    paymentGetMock.mockResolvedValueOnce({
      id: 555,
      status: 'approved',
      transaction_amount: 49.9,
      external_reference: 'u1|card|1',
    })

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(pixInsertMock).toHaveBeenCalledWith(expect.objectContaining({ payment_id: '555', user_id: 'u1', months: 1 }))
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', source: 'card' }),
      { onConflict: 'user_id' },
    )
    expect(createUserMock).not.toHaveBeenCalled()
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("intent com pagamento rejected: status 'rejected', nada creditado", async () => {
    paymentGetMock.mockResolvedValueOnce({ ...approvedIntentPayment, status: 'rejected' })

    const res = createMockRes()
    await handler(payReq() as any, res)

    expect(intentUpdateMock).toHaveBeenCalledWith({ last_payment_status: 'rejected', status: 'rejected' })
    expect(intentUpdateFilters[0]).toEqual([
      ['eq', 'id', INTENT_ID],
      ['neq', 'status', 'paid'],
    ])
    expect(pixInsertMock).not.toHaveBeenCalled()
    expect(upsertMock).not.toHaveBeenCalled()
    expect(createUserMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it("intent com pagamento cancelled também vira 'rejected'", async () => {
    paymentGetMock.mockResolvedValueOnce({ ...approvedIntentPayment, status: 'cancelled' })

    await handler(payReq() as any, createMockRes())

    expect(intentUpdateMock).toHaveBeenCalledWith({ last_payment_status: 'cancelled', status: 'rejected' })
  })

  it('intent com pagamento em análise: atualiza last_payment_status e volta a pending (nova tentativa)', async () => {
    paymentGetMock.mockResolvedValueOnce({ ...approvedIntentPayment, status: 'in_process' })

    await handler(payReq() as any, createMockRes())

    expect(intentUpdateMock).toHaveBeenCalledWith({ last_payment_status: 'in_process', status: 'pending' })
    expect(intentUpdateFilters[0]).toContainEqual(['neq', 'status', 'paid'])
    expect(pixInsertMock).not.toHaveBeenCalled()
  })
})
