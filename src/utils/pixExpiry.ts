import { Subscription } from '../types'

/** A partir de quantos dias antes do fim o app começa a avisar (decisão P0.4). */
export const PIX_WARNING_DAYS = 7
/** Abaixo disto o aviso muda de tom, para pegar quem viu e adiou. */
export const PIX_URGENT_DAYS = 1

const MS_PER_DAY = 24 * 60 * 60 * 1000

export interface PixExpiryWarning {
  /** Dias inteiros até o fim do acesso. Zero ou negativo = já venceu. */
  daysLeft: number
  urgent: boolean
  expiresAt: Date
}

/**
 * Só vale para acesso comprado via Pix: assinatura no cartão renova sozinha e
 * avisar sobre "vencimento" ali seria ruído.
 *
 * Devolve null quando não há o que avisar — o componente que chama não precisa
 * saber de nenhuma dessas regras.
 */
export function getPixExpiryWarning(
  subscription: Subscription | null,
  now: Date = new Date()
): PixExpiryWarning | null {
  if (!subscription) return null
  if (subscription.source !== 'pix') return null
  if (subscription.status !== 'authorized') return null
  if (!subscription.next_payment_date) return null

  const expiresAt = new Date(subscription.next_payment_date)
  if (Number.isNaN(expiresAt.getTime())) return null

  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / MS_PER_DAY)
  if (daysLeft > PIX_WARNING_DAYS) return null

  return { daysLeft, urgent: daysLeft <= PIX_URGENT_DAYS, expiresAt }
}

export function formatExpiryMessage(warning: PixExpiryWarning): string {
  const date = warning.expiresAt.toLocaleDateString('pt-BR')
  if (warning.daysLeft <= 0) return `Seu acesso venceu em ${date}. Renove para continuar treinando.`
  if (warning.daysLeft === 1) return `Seu acesso vence amanhã (${date}).`
  return `Seu acesso vence em ${warning.daysLeft} dias (${date}).`
}
