import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { Payment } from 'mercadopago'
import { createMercadoPagoConfig } from './_lib/mercadopagoConfig.js'
import { createSupabaseAdmin } from './_lib/supabaseAdmin.js'
import { PIX_PLANS, isPixPlanId } from './_lib/pixPlans.js'
import { buildPixExternalReference } from './_lib/pixPeriod.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = (req.headers.authorization as string) || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) {
    res.status(401).json({ error: 'Missing authorization token' })
    return
  }

  const planId = req.body?.plan
  if (!isPixPlanId(planId)) {
    res.status(400).json({ error: 'Invalid plan' })
    return
  }
  // O valor sai daqui, nunca do corpo da requisição.
  const plan = PIX_PLANS[planId]

  const supabaseAdmin = createSupabaseAdmin()
  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData.user) {
    res.status(401).json({ error: 'Invalid session' })
    return
  }
  const user = userData.user

  // Regra de conflito (decisão P0.3 do docs/PLANO-PIX.md): quem tem assinatura
  // recorrente viva no cartão não pode pagar Pix, senão seria cobrada duas
  // vezes. Assinatura no cartão já cancelada (mesmo que ainda dentro do
  // período pago) não bloqueia — não vai gerar cobrança nova. E Pix sobre Pix
  // é justamente a renovação, que soma período no webhook.
  const { data: existing } = await supabaseAdmin
    .from('subscriptions')
    .select('source, status')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing && existing.source === 'preapproval' && existing.status === 'authorized') {
    res.status(409).json({
      error: 'Você já tem uma assinatura ativa no cartão. Cancele antes de pagar via Pix.',
    })
    return
  }

  const host = (req.headers['x-forwarded-host'] as string) || (req.headers.host as string) || ''
  const protocol = host.includes('localhost') ? 'http' : 'https'

  try {
    const payment = new Payment(createMercadoPagoConfig())
    const result = await payment.create({
      body: {
        transaction_amount: plan.amount,
        description: `MusaFit - Acesso por ${plan.months} ${plan.months === 1 ? 'mês' : 'meses'}`,
        payment_method_id: 'pix',
        payer: { email: user.email || '' },
        // O webhook lê daqui de quem é o pagamento e quantos meses creditar.
        // Vai pelo Mercado Pago em vez de por uma linha nossa para não haver
        // corrida: a notificação pode chegar antes de um INSERT nosso commitar.
        external_reference: buildPixExternalReference(user.id, plan.months),
        notification_url: `${protocol}://${host}/api/mercadopago-webhook`,
      },
      requestOptions: { idempotencyKey: randomUUID() },
    })

    const tx = result.point_of_interaction?.transaction_data
    if (!tx?.qr_code) {
      console.error('create-pix-payment: resposta sem QR Code', { paymentId: result.id, status: result.status })
      res.status(502).json({ error: 'Não foi possível gerar o código Pix' })
      return
    }

    res.status(200).json({
      payment_id: String(result.id),
      qr_code: tx.qr_code,
      qr_code_base64: tx.qr_code_base64,
      ticket_url: tx.ticket_url,
      amount: plan.amount,
      months: plan.months,
    })
  } catch (error) {
    console.error(
      'create-pix-payment error:',
      JSON.stringify(error, Object.getOwnPropertyNames(error as object))
    )
    res.status(500).json({ error: 'Failed to create Pix payment' })
  }
}
