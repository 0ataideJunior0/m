import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  Payment,
  PreApproval,
  WebhookSignatureValidator,
  InvalidWebhookSignatureError,
} from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig.js'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { parsePixExternalReference } from './_lib/pixPeriod.js'
import { isPrepaidSource } from './_lib/prepaid.js'
import { parseIntentReference } from './_lib/checkoutRules.js'
import { findAuthUserIdByEmail } from './_lib/authUsers.js'
import { creditPrepaidPeriod } from './_lib/prepaidCredit.js'
import { sendAccessEmail } from './_lib/accessEmail.js'

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
      // O Mercado Pago entrega o mesmo evento por dois canais. O moderno
      // (query 'data.id' + type) valida e é o que credita o acesso — o painel
      // de Webhooks do MP registra só esse, e como 200. Em paralelo chega um
      // IPN antigo (query {id, topic} / body {resource, topic}) que carrega
      // x-signature mas não fecha com o manifesto documentado, mesmo usando o
      // id correto (testado em produção em 2026-09-01).
      //
      // Rejeitar é o certo: não dá para autenticar. E não se perde nada — é
      // duplicata do MESMO payment id que o canal moderno já processou. Só não
      // faz sentido registrar como erro algo esperado e inofensivo, senão o
      // log de erro vira ruído e esconde falha de verdade.
      const isLegacyIpnDuplicate = Boolean(req.body?.resource && req.body?.topic && !req.body?.data)
      const log = isLegacyIpnDuplicate ? console.log : console.error
      log(
        isLegacyIpnDuplicate
          ? 'mercadopago-webhook: IPN antigo ignorado (duplicata não autenticável)'
          : 'mercadopago-webhook signature mismatch:',
        {
          reason: error.reason,
          xSignaturePresent: Boolean(xSignature),
          xRequestIdPresent: Boolean(xRequestId),
          xRequestIdValue: xRequestId,
          dataId,
          query: req.query,
          body: req.body,
        }
      )
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
      await handlePayment(dataId, supabaseAdmin, res)
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
  if (isPrepaidSource(existing?.source) && existing?.next_payment_date) {
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

async function handlePayment(dataId: string, supabaseAdmin: SupabaseAdmin, res: VercelResponse) {
  const payment = new Payment(createMercadoPagoConfig())
  const resource = await payment.get({ id: dataId })

  const intentId = parseIntentReference(resource.external_reference)
  if (intentId) {
    await handleIntentPayment(intentId, resource, supabaseAdmin, res)
    return
  }

  if (resource.status !== 'approved') {
    res.status(200).json({ ignored: true, reason: `payment status ${resource.status}` })
    return
  }

  const parsed = parsePixExternalReference(resource.external_reference)
  if (!parsed) {
    // Pagamento aprovado que não é dos nossos planos avulsos (ou a primeira
    // parcela de uma assinatura no cartão, que chega como payment e é tratada
    // pelo fluxo de preapproval).
    res.status(200).json({ ignored: true, reason: 'not a pix plan payment' })
    return
  }

  // Compra de quem está logada (Pix ou cartão avulso): a usuária já é a do
  // external_reference, não há conta a criar nem e-mail a mandar.
  const result = await creditPrepaidPeriod(supabaseAdmin, {
    userId: parsed.userId,
    months: parsed.months,
    paymentId: String(resource.id),
    amount: resource.transaction_amount as number,
    source: parsed.method,
    raw: resource,
  })
  if (result === 'duplicate') {
    res.status(200).json({ ignored: true, reason: 'payment already processed' })
    return
  }
  res.status(200).json({ ok: true })
}

type PaymentResource = Awaited<ReturnType<Payment['get']>>

interface PurchaseIntentRow {
  id: string
  email: string
  months: number
  method: 'pix' | 'card'
  status: 'pending' | 'paid' | 'rejected'
  user_id: string | null
  access_email_sent_at: string | null
}

/**
 * Pagamento do checkout aberto (pagar primeiro, conta depois): o
 * external_reference aponta para a intenção de compra, não para uma usuária.
 *
 * Ordem ao aprovar, e por quê:
 *   1. resolver a usuária (intent.user_id → conta de auth com esse e-mail →
 *      criar). Vem ANTES do crédito porque o livro-razão e a assinatura
 *      precisam do user id. Só roda com pagamento aprovado, então nunca nasce
 *      conta de quem não pagou. Numa reentrega a conta já existe (foi criada
 *      antes do crédito) e é achada, não recriada.
 *   2. creditar o período. O UNIQUE de pix_payments é o portão: período só é
 *      creditado uma vez por pagamento.
 *   3. 'duplicate' com o intent já pago E o e-mail já resolvido = reentrega de
 *      algo concluído: para aqui, sem tocar em nada. Qualquer outro
 *      'duplicate' é uma entrega anterior que caiu no meio do caminho (creditou
 *      mas não marcou o intent ou não mandou o e-mail): segue para os passos
 *      que faltam, que são idempotentes por conta própria.
 *   4. marcar o intent pago — update condicional (status <> 'paid'), não
 *      reescreve paid_at de um intent já pago.
 *   5. e-mail de acesso, só se a conta não tem e-mail provado e ainda não foi
 *      mandado (access_email_sent_at). Marca o envio depois de mandar: se o
 *      envio falha (ou falta PUBLIC_APP_URL), a notificação volta 500 e o MP
 *      reenvia.
 *
 * Fica de fora de propósito: duas entregas simultâneas do mesmo pagamento
 * podem as duas mandar o e-mail (link duplicado para a mesma pessoa,
 * inofensivo). A conta e o crédito continuam únicos.
 */
async function handleIntentPayment(
  intentId: string,
  resource: PaymentResource,
  supabaseAdmin: SupabaseAdmin,
  res: VercelResponse,
) {
  const paymentStatus = resource.status ?? ''

  if (paymentStatus !== 'approved') {
    // Nunca rebaixa um intent já pago (notificação atrasada de outra
    // tentativa, ou estorno, que é tratado à parte). Recusa/cancelamento vira
    // 'rejected'; qualquer outro status (ex.: nova tentativa em análise depois
    // de um cartão recusado) volta o intent para 'pending'.
    const { error } = await supabaseAdmin
      .from('purchase_intents')
      .update({
        last_payment_status: paymentStatus,
        status: paymentStatus === 'rejected' || paymentStatus === 'cancelled' ? 'rejected' : 'pending',
      })
      .eq('id', intentId)
      .neq('status', 'paid')
    if (error) throw error
    res.status(200).json({ ok: true })
    return
  }

  const { data: intent, error: intentError } = await supabaseAdmin
    .from('purchase_intents')
    .select('id, email, months, method, status, user_id, access_email_sent_at')
    .eq('id', intentId)
    .maybeSingle<PurchaseIntentRow>()
  if (intentError) throw intentError
  if (!intent) {
    // Pagamento aprovado apontando para intent que não existe: precisa de
    // gente olhando, mas reenviar não resolve.
    console.error('mercadopago-webhook: pagamento aprovado de intent inexistente', {
      intentId,
      paymentId: resource.id,
    })
    res.status(200).json({ ignored: true, reason: 'unknown purchase intent' })
    return
  }

  const paymentId = String(resource.id)
  const userId = intent.user_id ?? (await findOrCreateUser(supabaseAdmin, intent.email))

  const credit = await creditPrepaidPeriod(supabaseAdmin, {
    userId,
    months: intent.months,
    paymentId,
    amount: resource.transaction_amount as number,
    source: intent.method,
    raw: resource,
  })

  if (credit === 'duplicate' && intent.status === 'paid' && intent.access_email_sent_at) {
    res.status(200).json({ ignored: true, reason: 'payment already processed' })
    return
  }

  const now = new Date().toISOString()

  if (intent.status !== 'paid') {
    const { error } = await supabaseAdmin
      .from('purchase_intents')
      .update({
        status: 'paid',
        paid_at: now,
        payment_id: paymentId,
        user_id: userId,
        last_payment_status: 'approved',
      })
      .eq('id', intentId)
      .neq('status', 'paid')
    if (error) throw error
  }

  if (!intent.access_email_sent_at) {
    await sendAccessEmailIfUnproven(supabaseAdmin, intentId, userId, intent.email)
  }

  res.status(200).json({ ok: true })
}

/**
 * Conta existente é achada pelo e-mail de AUTENTICAÇÃO, nunca por
 * profiles.email (que a aluna podia editar). Sem conta, cria sem senha e já
 * confirmada — a senha é criada no primeiro acesso, pelo link do e-mail.
 */
async function findOrCreateUser(supabaseAdmin: SupabaseAdmin, email: string): Promise<string> {
  const existing = await findAuthUserIdByEmail(supabaseAdmin, email)
  if (existing) return existing

  const { data, error } = await supabaseAdmin.auth.admin.createUser({ email, email_confirm: true })
  if (!error && data.user) return data.user.id

  // Outra entrega do mesmo pagamento criou a conta entre a busca e o create.
  if (error && isAlreadyRegistered(error)) {
    const raced = await findAuthUserIdByEmail(supabaseAdmin, email)
    if (raced) return raced
  }
  throw error ?? new Error('createUser returned no user')
}

function isAlreadyRegistered(error: { code?: string; message?: string }): boolean {
  return error.code === 'email_exists' || /already (been )?registered/i.test(error.message ?? '')
}

async function sendAccessEmailIfUnproven(
  supabaseAdmin: SupabaseAdmin,
  intentId: string,
  userId: string,
  email: string,
) {
  // Conta com e-mail provado não recebe e-mail nosso (o MP já manda o
  // comprovante). Sem prova, o link de acesso é o que tira de cena quem tinha
  // criado a conta com um e-mail que não é dela.
  if (await isCurrentEmailProven(supabaseAdmin, userId)) return

  // A origem do link vem da configuração, nunca do host da notificação. Sem
  // ela, lança: o webhook responde 500 e o MP reenvia até a variável existir,
  // em vez de dar 200 e deixar quem pagou sem o link.
  const origin = (process.env.PUBLIC_APP_URL || '').replace(/\/+$/, '')
  if (!origin) {
    throw new Error(`PUBLIC_APP_URL não configurada; e-mail de acesso não enviado (intent ${intentId})`)
  }

  await sendAccessEmail(supabaseAdmin, email, origin)

  const { error } = await supabaseAdmin
    .from('purchase_intents')
    .update({ access_email_sent_at: new Date().toISOString() })
    .eq('id', intentId)
  if (error) throw error
}

/**
 * A prova vale para o e-mail que foi provado, não para a conta: só conta se o
 * e-mail de autenticação ATUAL da conta é o mesmo da prova. (A migração já
 * bloqueia troca de e-mail; isto é a segunda trava.)
 */
async function isCurrentEmailProven(supabaseAdmin: SupabaseAdmin, userId: string): Promise<boolean> {
  const { data: proof, error: proofError } = await supabaseAdmin
    .from('email_verifications')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle<{ email: string }>()
  if (proofError) throw proofError
  if (!proof) return false

  const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
  if (error) throw error
  const currentEmail = (data.user?.email ?? '').trim().toLowerCase()
  return currentEmail !== '' && proof.email === currentEmail
}
