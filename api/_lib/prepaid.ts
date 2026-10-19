/**
 * Acesso pré-pago: período fechado, sem renovação automática. Vale para o Pix
 * e para a liberação manual feita pela admin (ex.: aluna que pagou em dinheiro).
 * As duas fontes seguem as mesmas regras — soma de período, aviso de
 * vencimento, preservação ao assinar no cartão.
 */
export const PREPAID_SOURCES = ['pix', 'manual'] as const

export const isPrepaidSource = (source: unknown): boolean =>
  typeof source === 'string' && (PREPAID_SOURCES as readonly string[]).includes(source)

/** Pacotes que a admin pode liberar de uma vez. */
export const GRANTABLE_MONTHS = [1, 3, 6, 12] as const

export const isGrantableMonths = (value: unknown): value is (typeof GRANTABLE_MONTHS)[number] =>
  typeof value === 'number' && (GRANTABLE_MONTHS as readonly number[]).includes(value)

export interface SubscriptionPeriod {
  status: string
  next_payment_date: string | null
}

const GRACE_MS = 3 * 24 * 60 * 60 * 1000

/** Mesma regra da função SQL has_active_subscription(): manter as duas iguais. */
export function grantsAccess(sub: SubscriptionPeriod | null, now: Date = new Date()): boolean {
  if (!sub) return false
  const end = sub.next_payment_date ? new Date(sub.next_payment_date).getTime() : null
  if (sub.status === 'authorized') return end === null || end > now.getTime() - GRACE_MS
  if (sub.status === 'cancelled') return end !== null && end > now.getTime()
  return false
}

/**
 * De onde contar os meses liberados: do fim do acesso pago que ainda está
 * valendo, ou de agora. Uma linha pending (nunca paga) não conta como base.
 */
export function manualGrantPeriodStart(sub: SubscriptionPeriod | null, now: Date = new Date()): Date {
  if (!sub || !grantsAccess(sub, now) || !sub.next_payment_date) return now
  const end = new Date(sub.next_payment_date)
  return end.getTime() > now.getTime() ? end : now
}
