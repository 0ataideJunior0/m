import { supabase } from '../lib/supabase'
import type { PixPlanId } from './pixPlans'
import type { PixCharge } from './pixPayment'
import { getAttribution } from './attribution'

const NETWORK_ERROR = 'Não foi possível falar com o servidor. Tente de novo.'
const GENERIC_ERROR = 'Algo deu errado. Tente de novo.'

export type CheckoutMethod = 'pix' | 'card'

/** Resposta de POST /api/checkout, discriminada pelo método. */
export type CheckoutResponse =
  | { intentId: string; method: 'pix'; pix: Omit<PixCharge, 'amount' | 'months'> }
  | { intentId: string; method: 'card'; init_point: string }

export interface CheckoutStatus {
  status: 'pending' | 'paid' | 'rejected'
  /** Último status bruto do Mercado Pago (pending, in_process, rejected...). */
  lastPaymentStatus: string | null
}

export type AccessStep = 'link_opened' | 'password_set'

export interface StartCheckoutInput {
  email: string
  plan: PixPlanId
  method: CheckoutMethod
}

interface Reply {
  ok: boolean
  body: Record<string, unknown> | null
}

/** Faz a chamada e lê o JSON do corpo. Falha de rede lança; quem chama traduz para NETWORK_ERROR. */
async function call(url: string, init: RequestInit): Promise<Reply> {
  const response = await fetch(url, init)
  let body: Record<string, unknown> | null = null
  try {
    body = await response.json()
  } catch {
    // Corpo vazio ou que não é JSON (ex.: página de erro do gateway).
  }
  return { ok: response.ok, body }
}

function errorMessage(reply: Reply): string {
  const error = reply.body?.error
  return typeof error === 'string' && error ? error : GENERIC_ERROR
}

async function accessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token
}

function jsonPost(payload: unknown, token?: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  }
}

/** Começa uma compra no checkout aberto: grava a intenção e devolve o Pix ou o link do cartão. */
export async function startCheckout(
  input: StartCheckoutInput,
): Promise<{ data?: CheckoutResponse; error?: string }> {
  const attribution = getAttribution()
  const payload = {
    ...input,
    ...(attribution && {
      utm: {
        source: attribution.source,
        medium: attribution.medium,
        campaign: attribution.campaign,
        content: attribution.content,
        term: attribution.term,
      },
      referrer: attribution.referrer,
    }),
  }

  try {
    const reply = await call('/api/checkout', jsonPost(payload))
    if (!reply.ok) return { error: errorMessage(reply) }
    return { data: reply.body as unknown as CheckoutResponse }
  } catch {
    return { error: NETWORK_ERROR }
  }
}

/** Andamento da compra (a tela de retorno faz polling). */
export async function getCheckoutStatus(
  intentId: string,
): Promise<{ data?: CheckoutStatus; error?: string }> {
  try {
    const reply = await call(`/api/checkout-status?intent=${encodeURIComponent(intentId)}`, { method: 'GET' })
    if (!reply.ok) return { error: errorMessage(reply) }
    return { data: reply.body as unknown as CheckoutStatus }
  } catch {
    return { error: NETWORK_ERROR }
  }
}

/**
 * Reenvia o link de acesso. A rota é pública e sempre responde ok; com sessão
 * aberta o token vai junto, e é ele que deixa um admin reenviar.
 */
export async function resendAccess(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await accessToken()
    const reply = await call('/api/resend-access', jsonPost({ email }, token))
    return reply.ok ? { ok: true } : { ok: false, error: errorMessage(reply) }
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
}

/** Registra um passo do primeiro acesso (precisa da sessão aberta pelo link do e-mail). */
export async function claimAccess(step: AccessStep): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await accessToken()
    if (!token) return { ok: false, error: 'Sessão inválida' }
    const reply = await call('/api/claim-access', jsonPost({ step }, token))
    return reply.ok ? { ok: true } : { ok: false, error: errorMessage(reply) }
  } catch {
    return { ok: false, error: NETWORK_ERROR }
  }
}

/** Cartão avulso (parcelado) para quem já está logada. */
export async function createCardPayment(
  plan: PixPlanId,
): Promise<{ data?: { init_point: string }; error?: string }> {
  try {
    const token = await accessToken()
    if (!token) return { error: 'Sessão inválida' }
    const reply = await call('/api/create-card-payment', jsonPost({ plan }, token))
    if (!reply.ok) return { error: errorMessage(reply) }
    return { data: reply.body as unknown as { init_point: string } }
  } catch {
    return { error: NETWORK_ERROR }
  }
}
