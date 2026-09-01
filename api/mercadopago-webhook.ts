import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  Payment,
  PreApproval,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig.js'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { addMonths, parsePixExternalReference } from './_lib/pixPeriod.js'

const UNIQUE_VIOLATION = '23505'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // O Mercado Pago entrega o MESMO evento em dois formatos diferentes:
  //
  //   moderno (webhook v2, vem do notification_url do pagamento):
  //     query { 'data.id', type }        body { type, data: { id } }
  //   antigo (IPN, vem do topico "Pagamentos (legacy)" do painel):
  //     query { id, topic }              body { resource, topic }
  //
  // O id entra no manifesto que o MP assina, entao ler so o formato moderno
  // fazia as notificacoes antigas falharem com SignatureMismatch e dataId
  // vazio (observado em producao em 2026-09-01). Processar as duas e seguro:
  // o UNIQUE em pix_payments impede creditar periodo duas vezes.
  const rawResource = req.body?.resource
  const dataId =
    (req.query['data.id'] as string) ||
    (req.body?.data?.id ? String(req.body.data.id) : '') ||
    (req.query.id as string) ||
    // em alguns topicos o IPN manda uma URL completa em vez do id puro
    (rawResource ? String(rawResource).split('/').filter(Boolean).pop() || '' : '')
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
        // Payload inteiro de propósito: foi o que revelou o formato IPN antigo
        // em 2026-09-01, depois de dois palpites errados sobre a causa. Se o MP
        // introduzir um terceiro formato, este log responde na primeira falha
        // em vez de exigir outro ciclo de pagamento real. Notificação do MP não
        // carrega segredo (ids, tipo, timestamps); a x-signature fica fora.
        query: req.query,
        body: req.body,
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
  const isPaymentEvent = bodyType === 'payment' || bodyEntity === 'payment' || queryType === 'payment'

  if (!isPreapprovalEvent && !isPaymentEvent) {
    // Loga o que veio para descobrirmos formatos novos pelo comportamento real,
    // em vez de confiar no que a documentação do MP diz que chega.
    console.log('mercadopago-webhook evento ignorado:', { bodyType, bodyEntity, queryType, dataId })
    res.status(200).json({ ignored: true })
    return
  }

  try {
    const supabaseAdmin = createSupabaseAdmin()
    if (isPreapprovalEvent) {
      await handlePreapproval(dataId, supabaseAdmin, res)
    } else {
      await handlePixPayment(dataId, supabaseAdmin, res)
    }
  } catch (error) {
    console.error('mercadopago-webhook processing error:', {
      dataId,
      error: JSON.stringify(error, Object.getOwnPropertyNames(error as object)),
    })
    res.status(500).json({ error: 'Failed to process webhook' })
  }
}

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>

async function handlePreapproval(dataId: string, supabaseAdmin: SupabaseAdmin, res: VercelResponse) {
  const preApproval = new PreApproval(createMercadoPagoConfig())
  const resource = await preApproval.get({ id: dataId })

  const userId = resource.external_reference
  if (!userId) {
    res.status(200).json({ ignored: true, reason: 'missing external_reference' })
    return
  }

  // Notificação atrasada ou reentregue pode chegar depois que a usuária já
  // cancelou essa preapproval e assinou de novo (nova preapproval, mais
  // recente). Sem essa checagem, o upsert por user_id sobrescreveria a
  // linha atual com o estado velho da preapproval superada.
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('preapproval_id, created_at, source, next_payment_date')
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

  // Se a usuária tinha acesso comprado via Pix que vai além da data do cartão,
  // preservar a data maior. Sem isto, assinar no cartão ENCURTARIA o acesso já
  // pago — exatamente o que a decisão P0.3 do PLANO-PIX.md descartou.
  let nextPaymentDate = resource.next_payment_date || null
  if (existing?.source === 'pix' && existing.next_payment_date) {
    const pixUntil = new Date(existing.next_payment_date)
    if (!nextPaymentDate || pixUntil > new Date(nextPaymentDate)) {
      console.log('mercadopago-webhook: preservando acesso via Pix mais longo que a data do cartão', {
        userId,
        pixUntil: existing.next_payment_date,
        cardNext: resource.next_payment_date,
      })
      nextPaymentDate = existing.next_payment_date
    }
  }

  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      preapproval_id: resource.id,
      source: 'preapproval',
      payment_id: null,
      status: resource.status,
      next_payment_date: nextPaymentDate,
      raw: resource,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  res.status(200).json({ ok: true })
}

async function handlePixPayment(dataId: string, supabaseAdmin: SupabaseAdmin, res: VercelResponse) {
  const payment = new Payment(createMercadoPagoConfig())
  const resource = await payment.get({ id: dataId })

  if (resource.status !== 'approved') {
    res.status(200).json({ ignored: true, reason: `payment status ${resource.status}` })
    return
  }

  const parsed = parsePixExternalReference(resource.external_reference)
  if (!parsed) {
    // Pagamento aprovado que não é dos nossos planos Pix (ou a primeira parcela
    // de uma assinatura no cartão, que chega como payment e é tratada pelo
    // fluxo de preapproval).
    res.status(200).json({ ignored: true, reason: 'not a pix plan payment' })
    return
  }
  const { userId, months } = parsed
  const paymentId = String(resource.id)

  // O livro-razão é o que torna isto idempotente: o UNIQUE em payment_id faz a
  // segunda entrega da mesma notificação falhar aqui, antes de creditar
  // período de novo. Sem isso, uma reentrega daria meses de graça.
  const { error: ledgerError } = await supabaseAdmin.from('pix_payments').insert({
    payment_id: paymentId,
    user_id: userId,
    months,
    amount: resource.transaction_amount,
    status: resource.status,
    raw: resource,
  })

  if (ledgerError) {
    if ((ledgerError as { code?: string }).code === UNIQUE_VIOLATION) {
      res.status(200).json({ ignored: true, reason: 'payment already processed' })
      return
    }
    throw ledgerError
  }

  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('source, status, next_payment_date, preapproval_id')
    .eq('user_id', userId)
    .maybeSingle()

  const now = new Date()

  // Renovação antecipada soma ao que ainda resta, em vez de descartar os dias
  // pagos (decisão P0.3). Só soma sobre acesso que veio de Pix — período de
  // cartão é gerenciado pelo próprio MP.
  let base = now
  if (existing?.source === 'pix' && existing.next_payment_date) {
    const currentEnd = new Date(existing.next_payment_date)
    if (currentEnd > now) base = currentEnd
  }
  const accessUntil = addMonths(base, months)

  // Anomalia: o endpoint bloqueia Pix para quem tem cartão ativo, então isto
  // não deveria acontecer. Se acontecer, a pessoa está sendo cobrada duas
  // vezes e precisa de intervenção humana — mas o acesso dela é creditado do
  // mesmo jeito, e a preapproval é preservada para o cancelamento continuar
  // funcionando.
  if (existing?.source === 'preapproval' && existing.status === 'authorized') {
    console.error('mercadopago-webhook: Pix pago por usuária com assinatura ativa no cartão', {
      userId,
      paymentId,
      preapprovalId: existing.preapproval_id,
    })
    await supabaseAdmin
      .from('subscriptions')
      .update({ next_payment_date: accessUntil.toISOString(), updated_at: now.toISOString() })
      .eq('user_id', userId)
    res.status(200).json({ ok: true, warning: 'user has an active card subscription' })
    return
  }

  await supabaseAdmin.from('subscriptions').upsert(
    {
      user_id: userId,
      preapproval_id: null,
      source: 'pix',
      payment_id: paymentId,
      status: 'authorized',
      next_payment_date: accessUntil.toISOString(),
      raw: resource,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id' }
  )

  res.status(200).json({ ok: true })
}
