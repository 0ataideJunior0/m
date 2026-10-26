import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getUserMock, signInWithOtpMock, profiles, intentFilters, intentResult } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  signInWithOtpMock: vi.fn(),
  profiles: new Map<string, { is_admin: boolean }>(),
  intentFilters: [] as Array<[string, string, unknown]>,
  intentResult: { rows: [] as Array<{ id: string; password_set_at: string | null }> },
}))

vi.mock('../../api/_lib/supabaseAdmin', () => ({
  createSupabaseAdmin: () => ({
    auth: { getUser: getUserMock, signInWithOtp: signInWithOtpMock },
    from: (table: string) => {
      if (table === 'profiles') {
        return {
          select: () => ({
            eq: (_c: string, id: string) => ({
              maybeSingle: async () => ({ data: profiles.get(id) ?? null, error: null }),
            }),
          }),
        }
      }
      if (table === 'purchase_intents') {
        // Aplica de verdade o filtro de senha pedido, para o teste refletir o comportamento.
        const chain: any = {
          select: () => chain,
          eq: (c: string, v: unknown) => (intentFilters.push(['eq', c, v]), chain),
          is: (c: string, v: unknown) => (intentFilters.push(['is', c, v]), chain),
          limit: () => chain,
          then: (resolve: (v: unknown) => void) => {
            const onlyUnset = intentFilters.some(([op, c, v]) => op === 'is' && c === 'password_set_at' && v === null)
            const rows = intentResult.rows.filter((r) => !onlyUnset || r.password_set_at === null)
            resolve({ data: rows, error: null })
          },
        }
        return chain
      }
      throw new Error(`tabela inesperada: ${table}`)
    },
  }),
}))

import handler from '../../api/resend-access'

function createMockRes() {
  const res: any = {}
  res.status = vi.fn(() => res)
  res.json = vi.fn(() => res)
  return res
}

const req = (body: unknown, token?: string) => ({
  method: 'POST',
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body,
})

describe('POST /api/resend-access', () => {
  beforeEach(() => {
    process.env.PUBLIC_APP_URL = 'https://app.musafit.com/'
    intentFilters.length = 0
    intentResult.rows = []
    profiles.clear()
    profiles.set('admin-1', { is_admin: true })
    profiles.set('aluna-1', { is_admin: false })
    getUserMock.mockReset().mockResolvedValue({ data: { user: null }, error: { message: 'no' } })
    signInWithOtpMock.mockReset().mockResolvedValue({ error: null })
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    delete process.env.PUBLIC_APP_URL
    vi.restoreAllMocks()
  })

  it('retorna 405 se não for POST', async () => {
    const res = createMockRes()
    await handler({ method: 'GET', headers: {}, body: {} } as any, res)
    expect(res.status).toHaveBeenCalledWith(405)
  })

  it('retorna 400 para e-mail malformado e não envia', async () => {
    const res = createMockRes()
    await handler(req({ email: 'nao-e-email' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(signInWithOtpMock).not.toHaveBeenCalled()
  })

  it('e-mail sem compra: 200 {ok:true} e signInWithOtp NÃO é chamado', async () => {
    const res = createMockRes()
    await handler(req({ email: 'Ninguem@Exemplo.com' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
    expect(signInWithOtpMock).not.toHaveBeenCalled()
  })

  it('compra paga sem senha: envia o link para o e-mail normalizado', async () => {
    intentResult.rows = [{ id: 'i-1', password_set_at: null }]
    const res = createMockRes()
    await handler(req({ email: '  Ana@Exemplo.com ' }) as any, res)

    expect(intentFilters).toContainEqual(['eq', 'email', 'ana@exemplo.com'])
    expect(intentFilters).toContainEqual(['eq', 'status', 'paid'])
    expect(signInWithOtpMock).toHaveBeenCalledWith({
      email: 'ana@exemplo.com',
      options: { shouldCreateUser: false, emailRedirectTo: 'https://app.musafit.com/primeiro-acesso' },
    })
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('compra paga com senha já criada: anônima não recebe nada, mas a resposta é a mesma', async () => {
    intentResult.rows = [{ id: 'i-1', password_set_at: '2026-10-26T10:00:00Z' }]
    const res = createMockRes()
    await handler(req({ email: 'ana@exemplo.com' }) as any, res)
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('aluna logada que não é admin segue a regra das anônimas', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'aluna-1' } }, error: null })
    intentResult.rows = [{ id: 'i-1', password_set_at: '2026-10-26T10:00:00Z' }]
    const res = createMockRes()
    await handler(req({ email: 'ana@exemplo.com' }, 'tok-aluna') as any, res)
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('admin pode reenviar mesmo com senha já criada', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'admin-1' } }, error: null })
    intentResult.rows = [{ id: 'i-1', password_set_at: '2026-10-26T10:00:00Z' }]
    const res = createMockRes()
    await handler(req({ email: 'ana@exemplo.com' }, 'tok-admin') as any, res)
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('admin sem compra paga para o e-mail: nada é enviado', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: { id: 'admin-1' } }, error: null })
    const res = createMockRes()
    await handler(req({ email: 'ana@exemplo.com' }, 'tok-admin') as any, res)
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('token inválido vira anônima: 200 igual', async () => {
    intentResult.rows = [{ id: 'i-1', password_set_at: null }]
    const res = createMockRes()
    await handler(req({ email: 'ana@exemplo.com' }, 'lixo') as any, res)
    expect(signInWithOtpMock).toHaveBeenCalledTimes(1)
    expect(res.status).toHaveBeenCalledWith(200)
  })

  it('sem PUBLIC_APP_URL: registra o erro, não envia e responde 200', async () => {
    delete process.env.PUBLIC_APP_URL
    intentResult.rows = [{ id: 'i-1', password_set_at: null }]
    const res = createMockRes()
    await handler(req({ email: 'ana@exemplo.com' }) as any, res)
    expect(signInWithOtpMock).not.toHaveBeenCalled()
    expect(console.error).toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })

  it('falha no envio (ex.: limite do Supabase) não vaza: 200 {ok:true}', async () => {
    intentResult.rows = [{ id: 'i-1', password_set_at: null }]
    signInWithOtpMock.mockResolvedValueOnce({ error: { message: 'rate limit' } })
    const res = createMockRes()
    await handler(req({ email: 'ana@exemplo.com' }) as any, res)
    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith({ ok: true })
  })
})
