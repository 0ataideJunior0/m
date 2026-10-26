import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import {
  MAX_INTENTS_PER_EMAIL_PER_HOUR,
  buildIntentReference,
  normalizeEmail,
  parseTestEmails,
  resolveCheckoutPlan,
} from './_lib/checkoutRules.js'
import { findAuthUserIdByEmail } from './_lib/authUsers.js'
import { createCardCheckout, createPixCharge, ChargeResponseError, requestOrigin } from './_lib/charges.js'

const CHARGE_ERROR = 'Não foi possível iniciar o pagamento. Tente de novo.'
const UTM_KEYS = ['source', 'medium', 'campaign', 'content', 'term'] as const

/** Texto livre vindo do cliente: só string, aparada e com teto de tamanho. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().slice(0, max)
  return trimmed || null
}

/**
 * Checkout aberto (pagar primeiro, conta depois): recebe e-mail + plano +
 * método, registra a intenção de compra e cria a cobrança. Não cria conta nem
 * manda e-mail — isso só acontece com o pagamento aprovado (webhook).
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' })
    return
  }

  const body = req.body ?? {}
  const email = normalizeEmail(body.email)
  if (!email) {
    res.status(400).json({ error: 'E-mail inválido.' })
    return
  }

  const resolved = resolveCheckoutPlan(body.plan, email, parseTestEmails(process.env.CHECKOUT_TEST_EMAILS))
  if ('error' in resolved) {
    if (resolved.error === 'invalid_plan') res.status(400).json({ error: 'Plano inválido.' })
    else res.status(403).json({ error: 'Plano indisponível.' })
    return
  }
  const { plan } = resolved

  const method = body.method
  if (method !== 'pix' && method !== 'card') {
    res.status(400).json({ error: 'Método de pagamento inválido.' })
    return
  }

  const admin = createSupabaseAdmin()

  try {
    // Quem tem recorrente ativa seria cobrada duas vezes. Acha a conta pelo
    // e-mail de autenticação (profiles.email não é confiável).
    const userId = await findAuthUserIdByEmail(admin, email)
    if (userId) {
      const { data: existing } = await admin
        .from('subscriptions')
        .select('source, status')
        .eq('user_id', userId)
        .maybeSingle()
      if (existing && existing.source === 'preapproval' && existing.status === 'authorized') {
        res.status(409).json({ error: 'Você já tem uma assinatura ativa. Entre na sua conta.' })
        return
      }
    }

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error: countError } = await admin
      .from('purchase_intents')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .gte('created_at', since)
    if (countError) throw countError
    if ((count ?? 0) >= MAX_INTENTS_PER_EMAIL_PER_HOUR) {
      res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' })
      return
    }

    // O intent é gravado ANTES da cobrança: o webhook e a tela de retorno
    // dependem dele existir quando o Mercado Pago responder.
    const utm = body.utm && typeof body.utm === 'object' ? body.utm : {}
    const intentId = randomUUID()
    const { error: insertError } = await admin.from('purchase_intents').insert({
      id: intentId,
      email,
      plan_id: plan.id,
      method,
      months: plan.months,
      amount: plan.amount,
      ...Object.fromEntries(UTM_KEYS.map((key) => [`utm_${key}`, cleanText(utm[key], 200)])),
      referrer: cleanText(body.referrer, 500),
    })
    if (insertError) throw insertError

    const origin = requestOrigin(req.headers)
    const externalReference = buildIntentReference(intentId)
    const notificationUrl = `${origin}/api/mercadopago-webhook`

    if (method === 'pix') {
      const pix = await createPixCharge({
        amount: plan.amount,
        months: plan.months,
        email,
        externalReference,
        notificationUrl,
      })
      res.status(200).json({ intentId, method: 'pix', pix })
      return
    }

    const { init_point } = await createCardCheckout({
      amount: plan.amount,
      months: plan.months,
      email,
      externalReference,
      notificationUrl,
      backUrl: `${origin}/comprar/retorno?intent=${intentId}`,
    })
    res.status(200).json({ intentId, method: 'card', init_point })
  } catch (error) {
    if (error instanceof ChargeResponseError) {
      res.status(502).json({ error: CHARGE_ERROR })
      return
    }
    console.error('checkout error:', JSON.stringify(error, Object.getOwnPropertyNames(error as object)))
    res.status(500).json({ error: CHARGE_ERROR })
  }
}
