import { describe, it, expect, vi, beforeEach } from 'vitest'

const { validateMock, preApprovalGetMock, upsertMock, fromMock, FakeInvalidWebhookSignatureError } = vi.hoisted(
  () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const fromMock = vi.fn(() => ({ upsert: upsertMock }))
    class FakeInvalidWebhookSignatureError extends Error {}
    return {
      validateMock: vi.fn(),
      preApprovalGetMock: vi.fn(),
      upsertMock,
      fromMock,
      FakeInvalidWebhookSignatureError,
    }
  }
)

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
  })

  it('retorna 405 se não for POST', async () => {
    const req: any = { method: 'GET', headers: {}, query: {} }
    const res = createMockRes()
    await handler(req, res)
    expect(res.status).toHaveBeenCalledWith(405)
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
})
