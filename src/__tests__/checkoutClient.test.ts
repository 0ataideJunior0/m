import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getSessionMock } = vi.hoisted(() => ({ getSessionMock: vi.fn() }))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: getSessionMock } },
}))

import {
  startCheckout,
  getCheckoutStatus,
  resendAccess,
  claimAccess,
  createCardPayment,
} from '../utils/checkout'

const NETWORK_ERROR = 'Não foi possível falar com o servidor. Tente de novo.'
const WITH_SESSION = { data: { session: { access_token: 'tok' } } }

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const fetchMock = vi.fn()

describe('cliente das rotas de checkout', () => {
  beforeEach(() => {
    sessionStorage.clear()
    fetchMock.mockReset()
    getSessionMock.mockReset()
    getSessionMock.mockResolvedValue({ data: { session: null } })
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  describe('startCheckout', () => {
    it('envia e-mail, plano e método e devolve a resposta do Pix', async () => {
      const pix = { payment_id: '1', qr_code: 'code' }
      fetchMock.mockResolvedValue(jsonResponse(200, { intentId: 'abc', method: 'pix', pix }))

      const result = await startCheckout({ email: 'ana@gmail.com', plan: 'mensal', method: 'pix' })

      expect(result).toEqual({ data: { intentId: 'abc', method: 'pix', pix } })
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/checkout')
      expect(init.method).toBe('POST')
      expect(init.headers.Authorization).toBeUndefined()
      expect(JSON.parse(init.body)).toEqual({ email: 'ana@gmail.com', plan: 'mensal', method: 'pix' })
    })

    it('devolve o init_point no cartão', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { intentId: 'abc', method: 'card', init_point: 'https://mp/x' }))
      const result = await startCheckout({ email: 'ana@gmail.com', plan: 'anual', method: 'card' })
      expect(result.data).toEqual({ intentId: 'abc', method: 'card', init_point: 'https://mp/x' })
    })

    it('anexa utm e referrer guardados na sessão', async () => {
      sessionStorage.setItem(
        'musa_attribution',
        JSON.stringify({
          source: 'instagram',
          medium: null,
          campaign: 'out',
          content: null,
          term: null,
          referrer: 'https://l.instagram.com/',
        }),
      )
      fetchMock.mockResolvedValue(jsonResponse(200, { intentId: 'abc', method: 'card', init_point: 'u' }))

      await startCheckout({ email: 'ana@gmail.com', plan: 'mensal', method: 'card' })

      expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
        email: 'ana@gmail.com',
        plan: 'mensal',
        method: 'card',
        utm: { source: 'instagram', medium: null, campaign: 'out', content: null, term: null },
        referrer: 'https://l.instagram.com/',
      })
    })

    it('409 devolve a mensagem do servidor', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(409, { error: 'Você já tem uma assinatura ativa. Entre na sua conta.' }),
      )
      const result = await startCheckout({ email: 'ana@gmail.com', plan: 'mensal', method: 'pix' })
      expect(result).toEqual({ error: 'Você já tem uma assinatura ativa. Entre na sua conta.' })
    })

    it('erro sem corpo legível cai numa mensagem genérica', async () => {
      fetchMock.mockResolvedValue(new Response('<html>', { status: 500 }))
      const result = await startCheckout({ email: 'ana@gmail.com', plan: 'mensal', method: 'pix' })
      expect(result.data).toBeUndefined()
      expect(result.error).toBeTruthy()
    })

    it('fetch rejeitado devolve a mensagem de rede', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      const result = await startCheckout({ email: 'ana@gmail.com', plan: 'mensal', method: 'pix' })
      expect(result).toEqual({ error: NETWORK_ERROR })
    })
  })

  describe('getCheckoutStatus', () => {
    it('consulta pelo id da intenção e devolve o status', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { status: 'paid', lastPaymentStatus: 'approved' }))
      const result = await getCheckoutStatus('abc 123')
      expect(result).toEqual({ data: { status: 'paid', lastPaymentStatus: 'approved' } })
      expect(fetchMock.mock.calls[0][0]).toBe('/api/checkout-status?intent=abc%20123')
    })

    it('404 devolve o erro do servidor', async () => {
      fetchMock.mockResolvedValue(jsonResponse(404, { error: 'Not found' }))
      expect(await getCheckoutStatus('abc')).toEqual({ error: 'Not found' })
    })

    it('fetch rejeitado devolve a mensagem de rede', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      expect(await getCheckoutStatus('abc')).toEqual({ error: NETWORK_ERROR })
    })
  })

  describe('resendAccess', () => {
    it('sem sessão não manda Authorization', async () => {
      fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))
      const result = await resendAccess('ana@gmail.com')
      expect(result).toEqual({ ok: true })
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/resend-access')
      expect(init.headers.Authorization).toBeUndefined()
      expect(JSON.parse(init.body)).toEqual({ email: 'ana@gmail.com' })
    })

    it('com sessão manda o Bearer (reenvio de admin)', async () => {
      getSessionMock.mockResolvedValue(WITH_SESSION)
      fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))
      await resendAccess('ana@gmail.com')
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok')
    })

    it('fetch rejeitado devolve a mensagem de rede', async () => {
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      expect(await resendAccess('ana@gmail.com')).toEqual({ ok: false, error: NETWORK_ERROR })
    })

    it('400 devolve o erro do servidor', async () => {
      fetchMock.mockResolvedValue(jsonResponse(400, { error: 'Invalid email' }))
      expect(await resendAccess('x')).toEqual({ ok: false, error: 'Invalid email' })
    })
  })

  describe('claimAccess', () => {
    it('sem sessão devolve "Sessão inválida" sem chamar fetch', async () => {
      expect(await claimAccess('link_opened')).toEqual({ ok: false, error: 'Sessão inválida' })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('com sessão manda o passo com Bearer', async () => {
      getSessionMock.mockResolvedValue(WITH_SESSION)
      fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }))
      expect(await claimAccess('password_set')).toEqual({ ok: true })
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/claim-access')
      expect(init.headers.Authorization).toBe('Bearer tok')
      expect(JSON.parse(init.body)).toEqual({ step: 'password_set' })
    })

    it('403 devolve o erro do servidor', async () => {
      getSessionMock.mockResolvedValue(WITH_SESSION)
      fetchMock.mockResolvedValue(jsonResponse(403, { error: 'E-mail ainda não confirmado' }))
      expect(await claimAccess('password_set')).toEqual({ ok: false, error: 'E-mail ainda não confirmado' })
    })

    it('fetch rejeitado devolve a mensagem de rede', async () => {
      getSessionMock.mockResolvedValue(WITH_SESSION)
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      expect(await claimAccess('link_opened')).toEqual({ ok: false, error: NETWORK_ERROR })
    })
  })

  describe('createCardPayment', () => {
    it('sem sessão devolve "Sessão inválida" sem chamar fetch', async () => {
      expect(await createCardPayment('mensal')).toEqual({ error: 'Sessão inválida' })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('com sessão devolve o init_point', async () => {
      getSessionMock.mockResolvedValue(WITH_SESSION)
      fetchMock.mockResolvedValue(jsonResponse(200, { init_point: 'https://mp/x' }))
      expect(await createCardPayment('trimestral')).toEqual({ data: { init_point: 'https://mp/x' } })
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('/api/create-card-payment')
      expect(init.headers.Authorization).toBe('Bearer tok')
      expect(JSON.parse(init.body)).toEqual({ plan: 'trimestral' })
    })

    it('erro do servidor é repassado', async () => {
      getSessionMock.mockResolvedValue(WITH_SESSION)
      fetchMock.mockResolvedValue(jsonResponse(409, { error: 'Você já tem uma assinatura ativa no cartão.' }))
      expect(await createCardPayment('mensal')).toEqual({ error: 'Você já tem uma assinatura ativa no cartão.' })
    })

    it('fetch rejeitado devolve a mensagem de rede', async () => {
      getSessionMock.mockResolvedValue(WITH_SESSION)
      fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
      expect(await createCardPayment('mensal')).toEqual({ error: NETWORK_ERROR })
    })
  })
})
