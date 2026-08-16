import { describe, it, expect, vi, beforeEach } from 'vitest'

const { validateMock, preApprovalGetMock, upsertMock, maybeSingleMock, fromMock, FakeInvalidWebhookSignatureError } =
  vi.hoisted(() => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null })
    const eqMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }))
    const selectMock = vi.fn(() => ({ eq: eqMock }))
    const fromMock = vi.fn(() => ({ upsert: upsertMock, select: selectMock }))
    class FakeInvalidWebhookSignatureError extends Error {}
    return {
      validateMock: vi.fn(),
      preApprovalGetMock: vi.fn(),
      upsertMock,
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
      query: { 'data.id': '999', type: 'payment' },
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
