import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUserMock, verificationUpsertMock, verificationSelectMock, intentSelectMock, intentIsMock, intentEqMock, intentFilters } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  verificationUpsertMock: vi.fn(),
  verificationSelectMock: vi.fn(),
  intentFilters: [] as Array<[string, string, unknown]>,
  intentSelectMock: vi.fn(),
  intentIsMock: vi.fn(),
  intentEqMock: vi.fn(),
}))

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({
    auth: { getUser: getUserMock },
    from: (table: string) => {
      if (table === 'email_verifications') {
        return {
          upsert: verificationUpsertMock,
          // select('user_id').eq('user_id', id).maybeSingle()
          select: () => ({ eq: () => ({ maybeSingle: verificationSelectMock }) }),
        }
      }
      if (table === 'purchase_intents') {
        return {
          // select(...).eq(user_id).eq(status).order(paid_at desc).limit(1).maybeSingle()
          select: (cols: string) => {
            const chain: any = {
              eq: (c: string, v: unknown) => (intentFilters.push(['eq', c, v]), chain),
              order: () => chain,
              limit: () => chain,
              maybeSingle: () => intentSelectMock(cols),
            }
            return chain
          },
          // update(values).eq(id).is(column, null)
          update: (values: unknown) => ({
            eq: (col: string, val: unknown) => {
              intentEqMock(values, col, val)
              return { is: (c: string, v: unknown) => intentIsMock(c, v) }
            },
          }),
        }
      }
      throw new Error(`tabela inesperada: ${table}`)
    },
  }),
}))

import handler from '../../api/claim-access'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

function tokenWith(amrMethod: string): string {
  const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')
  return `${b64({ alg: 'HS256' })}.${b64({ amr: [{ method: amrMethod, timestamp: 1 }] })}.sig`
}

const req = (body: unknown, token: string | null = tokenWith('otp')) => ({
  method: 'POST',
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body,
})

describe('POST /api/claim-access', () => {
  beforeEach(() => {
    getUserMock.mockReset().mockResolvedValue({ data: { user: { id: 'u-1', email: 'Ana@Exemplo.com' } }, error: null })
    verificationUpsertMock.mockReset().mockResolvedValue({ error: null })
    verificationSelectMock.mockReset().mockResolvedValue({
      data: { user_id: 'u-1', email: 'ana@exemplo.com', method: 'link' },
      error: null,
    })
    intentFilters.length = 0
    intentSelectMock.mockReset().mockResolvedValue({
      data: { id: 'intent-1', link_opened_at: null, password_set_at: null },
      error: null,
    })
    intentIsMock.mockReset().mockResolvedValue({ error: null })
    intentEqMock.mockReset()
  })

  it('retorna 405 se não for POST', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', headers: {}, body: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 401 sem token e não consulta nada', async () => {
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }, null) as any, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(getUserMock).not.toHaveBeenCalled()
  })

  it('retorna 401 com sessão inválida', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: { message: 'bad' } })
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(verificationUpsertMock).not.toHaveBeenCalled()
  })

  it('retorna 400 para passo inválido', async () => {
    const res = createMockRes()
    await handler(req({ step: 'qualquer' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(verificationUpsertMock).not.toHaveBeenCalled()
  })

  it('link_opened com sessão de senha: 403 e nenhuma escrita', async () => {
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }, tokenWith('password')) as any, res)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(verificationUpsertMock).not.toHaveBeenCalled()
    expect(intentIsMock).not.toHaveBeenCalled()
  })

  it('link_opened com sessão de link e sem prova: grava o e-mail atual (minúsculo) como provado e carimba o intent', async () => {
    verificationSelectMock.mockResolvedValueOnce({ data: null, error: null })
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }) as any, res)

    expect(verificationUpsertMock).toHaveBeenCalledWith(
      { user_id: 'u-1', email: 'ana@exemplo.com', method: 'link', verified_at: expect.any(String) },
      { onConflict: 'user_id' },
    )
    expect(intentFilters).toContainEqual(['eq', 'user_id', 'u-1'])
    expect(intentFilters).toContainEqual(['eq', 'status', 'paid'])
    expect(intentEqMock).toHaveBeenCalledWith({ link_opened_at: expect.any(String) }, 'id', 'intent-1')
    expect(intentIsMock).toHaveBeenCalledWith('link_opened_at', null)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it("link_opened com prova 'legacy' do MESMO e-mail: não mexe na prova", async () => {
    verificationSelectMock.mockResolvedValueOnce({
      data: { user_id: 'u-1', email: 'ana@exemplo.com', method: 'legacy' },
      error: null,
    })
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }) as any, res)

    expect(verificationUpsertMock).not.toHaveBeenCalled()
    expect(intentEqMock).toHaveBeenCalledWith({ link_opened_at: expect.any(String) }, 'id', 'intent-1')
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('link_opened com prova de OUTRO e-mail: troca a prova para o e-mail atual', async () => {
    verificationSelectMock.mockResolvedValueOnce({
      data: { user_id: 'u-1', email: 'antigo@exemplo.com', method: 'legacy' },
      error: null,
    })
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }) as any, res)

    expect(verificationUpsertMock).toHaveBeenCalledWith(
      { user_id: 'u-1', email: 'ana@exemplo.com', method: 'link', verified_at: expect.any(String) },
      { onConflict: 'user_id' },
    )
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('link_opened não recarimba se o intent já tem link_opened_at', async () => {
    verificationSelectMock.mockResolvedValueOnce({ data: null, error: null })
    intentSelectMock.mockResolvedValueOnce({
      data: { id: 'intent-1', link_opened_at: '2026-10-26T10:00:00Z', password_set_at: null },
      error: null,
    })
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }) as any, res)
    expect(verificationUpsertMock).toHaveBeenCalled()
    expect(intentIsMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('link_opened sem intent pago (ex.: recuperação de senha): registra a prova e devolve 200', async () => {
    verificationSelectMock.mockResolvedValueOnce({ data: null, error: null })
    intentSelectMock.mockResolvedValueOnce({ data: null, error: null })
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }, tokenWith('recovery')) as any, res)
    expect(verificationUpsertMock).toHaveBeenCalled()
    expect(intentIsMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('password_set sem e-mail provado: 403 e nada é carimbado', async () => {
    verificationSelectMock.mockResolvedValueOnce({ data: null, error: null })
    const res = createMockRes()
    await handler(req({ step: 'password_set' }, tokenWith('password')) as any, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'E-mail ainda não confirmado' })
    expect(intentSelectMock).not.toHaveBeenCalled()
    expect(intentIsMock).not.toHaveBeenCalled()
    expect(verificationUpsertMock).not.toHaveBeenCalled()
  })

  it('password_set com prova de OUTRO e-mail: 403 e nada é carimbado', async () => {
    verificationSelectMock.mockResolvedValueOnce({
      data: { user_id: 'u-1', email: 'antigo@exemplo.com', method: 'link' },
      error: null,
    })
    const res = createMockRes()
    await handler(req({ step: 'password_set' }, tokenWith('password')) as any, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'E-mail ainda não confirmado' })
    expect(intentIsMock).not.toHaveBeenCalled()
  })

  it('password_set com e-mail provado carimba password_set_at sem exigir sessão de link', async () => {
    const res = createMockRes()
    await handler(req({ step: 'password_set' }, tokenWith('password')) as any, res)

    expect(verificationUpsertMock).not.toHaveBeenCalled()
    expect(intentFilters).toContainEqual(['eq', 'user_id', 'u-1'])
    expect(intentFilters).toContainEqual(['eq', 'status', 'paid'])
    expect(intentEqMock).toHaveBeenCalledWith({ password_set_at: expect.any(String) }, 'id', 'intent-1')
    expect(intentIsMock).toHaveBeenCalledWith('password_set_at', null)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('password_set sem token: 401', async () => {
    const res = createMockRes()
    await handler(req({ step: 'password_set' }, null) as any, res)
    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('devolve 500 se gravar falhar', async () => {
    verificationSelectMock.mockResolvedValueOnce({ data: null, error: null })
    verificationUpsertMock.mockResolvedValueOnce({ error: { message: 'boom' } })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = createMockRes()
    await handler(req({ step: 'link_opened' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(500)
    vi.restoreAllMocks()
  })
})
