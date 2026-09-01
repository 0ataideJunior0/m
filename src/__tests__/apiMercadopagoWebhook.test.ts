import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  validateMock,
  preApprovalGetMock,
  paymentGetMock,
  upsertMock,
  updateMock,
  pixInsertMock,
  maybeSingleMock,
  fromMock,
  FakeInvalidWebhookSignatureError,
} = vi.hoisted(() => {
  const upsertMock = vi.fn().mockResolvedValue({ error: null })
  const updateEqMock = vi.fn().mockResolvedValue({ error: null })
  const updateMock = vi.fn(() => ({ eq: updateEqMock }))
  const pixInsertMock = vi.fn().mockResolvedValue({ error: null })
  const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
  const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
  const selectMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn((table: string) =>
    table === 'pix_payments'
      ? { insert: pixInsertMock }
      : { upsert: upsertMock, select: selectMock, update: updateMock }
  )
  class FakeInvalidWebhookSignatureError extends Error {}
  return {
    validateMock: vi.fn(),
    preApprovalGetMock: vi.fn(),
    paymentGetMock: vi.fn(),
    upsertMock,
    updateMock,
    pixInsertMock,
    maybeSingleMock,
    fromMock,
    FakeInvalidWebhookSignatureError,
  }
})

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({ from: fromMock }),
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
