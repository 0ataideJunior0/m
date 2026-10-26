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

  // Livro-razão gravado sem a assinatura seria "pagou e ficou sem acesso" para
  // sempre: toda reentrega daria 'duplicate' e pularia o crédito. Então, se a
  // assinatura não for gravada, desfaz o livro-razão e lança — o webhook
  // responde 500 e o MP reenvia, creditando de novo.
  try {
    await grantPeriod(admin, o)
  } catch (error) {
    // O delete pode devolver erro ou lançar (rede): nos dois casos o log CRÍTICO
    // sai e o erro relançado é o ORIGINAL, que é o que explica a falha.
    let undoError: unknown
    try {
      const { error: deleteError } = await admin.from('pix_payments').delete().eq('payment_id', o.paymentId)
      undoError = deleteError
    } catch (deleteFailure) {
      undoError = deleteFailure
    }
    if (undoError) {
      console.error(
        'mercadopago-webhook: CRÍTICO — período não creditado e linha do livro-razão não desfeita; ' +
          'reentregas vão ser ignoradas. Apagar a linha de pix_payments à mão e reprocessar.',
        { paymentId: o.paymentId, userId: o.userId, undoError, error },
      )
    }
    throw error
  }
  return 'credited'
}

async function grantPeriod(admin: AdminClient, o: PrepaidCredit): Promise<void> {
  const { data: existing, error: selectError } = await admin
    .from('subscriptions')
    .select('source, status, next_payment_date, preapproval_id')
    .eq('user_id', o.userId)
    .maybeSingle()
  if (selectError) throw selectError

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
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({ next_payment_date: accessUntil.toISOString(), updated_at: now.toISOString() })
      .eq('user_id', o.userId)
    if (updateError) throw updateError
    return
  }

  const { error: upsertError } = await admin.from('subscriptions').upsert(
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
  if (upsertError) throw upsertError
}
