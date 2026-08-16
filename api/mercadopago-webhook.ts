import type { VercelRequest, VercelResponse } from '@vercel/node'
import { PreApproval, WebhookSignatureValidator, InvalidWebhookSignatureError } from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig.js'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const dataId = (req.query['data.id'] as string) || ''
  const xSignature = (req.headers['x-signature'] as string) || ''
  const xRequestId = (req.headers['x-request-id'] as string) || ''
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET || ''

  if (!secret) {
    console.error('MERCADOPAGO_WEBHOOK_SECRET is not configured')
    res.status(500).json({ error: 'Webhook is not configured' })
    return
  }

  try {
    WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId, secret })
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      // Diagnóstico sem vazar material sensível: nem o valor de x-signature
      // (contém o HMAC calculado pelo MP) nem o tamanho do segredo entram no
      // log. reason/xRequestIdValue/dataId bastam para correlacionar com o
      // painel do Mercado Pago e são publicamente rastreáveis de qualquer forma.
      console.error('mercadopago-webhook signature mismatch:', {
        reason: error.reason,
        xSignaturePresent: Boolean(xSignature),
        xRequestIdPresent: Boolean(xRequestId),
        xRequestIdValue: xRequestId,
        dataId,
      })
      res.status(401).json({ error: 'Invalid signature' })
      return
    }
    throw error
  }

  const bodyType = (req.body?.type as string) || ''
  const bodyEntity = (req.body?.entity as string) || ''
  const queryType = (req.query.type as string) || (req.query.topic as string) || ''
  const isPreapprovalEvent =
    bodyType === 'subscription_preapproval' || bodyEntity === 'preapproval' || queryType === 'subscription_preapproval'

  if (!isPreapprovalEvent) {
    res.status(200).json({ ignored: true })
    return
  }

  try {
    const preApproval = new PreApproval(createMercadoPagoConfig())
    const resource = await preApproval.get({ id: dataId })

    const userId = resource.external_reference
    if (!userId) {
      res.status(200).json({ ignored: true, reason: 'missing external_reference' })
      return
    }

    const supabaseAdmin = createSupabaseAdmin()

    // Notificação atrasada ou reentregue pode chegar depois que a usuária já
    // cancelou essa preapproval e assinou de novo (nova preapproval, mais
    // recente). Sem essa checagem, o upsert por user_id sobrescreveria a
    // linha atual com o estado velho da preapproval superada.
    const { data: existing } = await supabaseAdmin
      .from('subscriptions')
      .select('preapproval_id, created_at')
      .eq('user_id', userId)
      .maybeSingle()

    if (
      existing &&
      existing.preapproval_id !== resource.id &&
      resource.date_created &&
      new Date(existing.created_at) > new Date(resource.date_created)
    ) {
      res.status(200).json({ ignored: true, reason: 'stale preapproval superseded by a newer subscription' })
      return
    }

    await supabaseAdmin.from('subscriptions').upsert(
      {
        user_id: userId,
        preapproval_id: resource.id,
        status: resource.status,
        next_payment_date: resource.next_payment_date || null,
        raw: resource,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('mercadopago-webhook processing error:', {
      dataId,
      error: JSON.stringify(error, Object.getOwnPropertyNames(error as object)),
    })
    res.status(500).json({ error: 'Failed to process webhook' })
  }
}
