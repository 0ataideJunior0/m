import type { createSupabaseAdmin } from './supabaseAdmin.js'
import { addMonths } from './pixPeriod.js'
import { isPrepaidSource } from './prepaid.js'

type AdminClient = Pick<ReturnType<typeof createSupabaseAdmin>, 'from'>

const UNIQUE_VIOLATION = '23505'

export interface PrepaidCredit {
  userId: string
  months: number
  paymentId: string
  amount: number
  source: 'pix' | 'card'
  raw: unknown
}

/**
 * Credita um período pré-pago (Pix ou cartão avulso) a partir de um pagamento
 * APROVADO. Devolve 'duplicate' quando esse pagamento já foi creditado antes.
 */
export async function creditPrepaidPeriod(admin: AdminClient, o: PrepaidCredit): Promise<'credited' | 'duplicate'> {
  // O livro-razão é o que torna isto idempotente: o UNIQUE em payment_id faz a
  // segunda entrega da mesma notificação falhar aqui, antes de creditar
  // período de novo. Sem isso, uma reentrega daria meses de graça.
  const { error: ledgerError } = await admin.from('pix_payments').insert({
    payment_id: o.paymentId,
    user_id: o.userId,
    months: o.months,
    amount: o.amount,
    status: 'approved',
    raw: o.raw,
  })

  if (ledgerError) {
    if ((ledgerError as { code?: string }).code === UNIQUE_VIOLATION) return 'duplicate'
    throw ledgerError
  }

  const { data: existing } = await admin
    .from('subscriptions')
    .select('source, status, next_payment_date, preapproval_id')
    .eq('user_id', o.userId)
    .maybeSingle()

  const now = new Date()

  // Renovação antecipada soma ao que ainda resta, em vez de descartar os dias
  // pagos (decisão P0.3). Só soma sobre acesso pré-pago — período de
  // assinatura recorrente é gerenciado pelo próprio MP.
  let base = now
  if (isPrepaidSource(existing?.source) && existing?.next_payment_date) {
    const currentEnd = new Date(existing.next_payment_date)
    if (currentEnd > now) base = currentEnd
  }
  const accessUntil = addMonths(base, o.months)

  // Anomalia: as rotas de cobrança bloqueiam compra avulsa para quem tem
  // assinatura recorrente ativa, então isto não deveria acontecer. Se
  // acontecer, a pessoa está sendo cobrada duas vezes e precisa de intervenção
  // humana — mas o acesso dela é creditado do mesmo jeito, e a preapproval é
  // preservada para o cancelamento continuar funcionando.
  if (existing?.source === 'preapproval' && existing.status === 'authorized') {
    console.error('mercadopago-webhook: pagamento avulso de usuária com assinatura ativa no cartão', {
      userId: o.userId,
      paymentId: o.paymentId,
      source: o.source,
      preapprovalId: existing.preapproval_id,
    })
    await admin
      .from('subscriptions')
      .update({ next_payment_date: accessUntil.toISOString(), updated_at: now.toISOString() })
      .eq('user_id', o.userId)
    return 'credited'
  }

  await admin.from('subscriptions').upsert(
    {
      user_id: o.userId,
      preapproval_id: null,
      source: o.source,
      payment_id: o.paymentId,
      status: 'authorized',
      next_payment_date: accessUntil.toISOString(),
      raw: o.raw,
      updated_at: now.toISOString(),
    },
    { onConflict: 'user_id' },
  )
  return 'credited'
}
