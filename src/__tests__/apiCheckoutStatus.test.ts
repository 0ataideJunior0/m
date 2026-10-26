import { describe, it, expect, vi, beforeEach } from 'vitest'

const { maybeSingleMock, selectMock } = vi.hoisted(() => {
  const maybeSingleMock = vi.fn()
  return { maybeSingleMock, selectMock: vi.fn(() => ({ eq: () => ({ maybeSingle: maybeSingleMock }) })) }
})

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({ from: () => ({ select: selectMock }) }),
}))

import handler from '../../api/checkout-status'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

const UUID = '3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b'

describe('GET /api/checkout-status', () => {
  beforeEach(() => {
    selectMock.mockClear()
    maybeSingleMock.mockReset().mockResolvedValue({ data: null, error: null })
  })

  it('retorna 405 se não for GET', async () => {
    const res = createMockRes()
    await handler({ method: 'POST', headers: {}, query: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(405)
    expect(res.json).toHaveBeenCalledWith({ error: 'Método não permitido.' })
  })

  it('retorna 400 e não consulta o banco quando o intent não é uuid', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', headers: {}, query: { intent: 'x-or-1=1' } } as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ error: 'Pedido inválido.' })
    expect(selectMock).not.toHaveBeenCalled()
  })

  it('retorna 404 quando o intent não existe', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', headers: {}, query: { intent: UUID } } as any, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Pedido não encontrado.' })
  })

  it('devolve status e último status do pagamento, sem e-mail', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: { status: 'paid', last_payment_status: 'approved', email: 'ana@b.com' },
      error: null,
    })
    const res = createMockRes()
    await handler({ method: 'GET', headers: {}, query: { intent: UUID } } as any, res)

    expect(selectMock).toHaveBeenCalledWith('status, last_payment_status')
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ status: 'paid', lastPaymentStatus: 'approved' })
  })
})
