/**
 * Prazo da promoção de lançamento. O preço é decidido AQUI, pela data do
 * servidor: passado o prazo, as cobranças voltam ao valor cheio sozinhas, sem
 * depender de alguém lembrar de mexer -- a tela promete "válida até sábado" e
 * isso precisa ser verdade.
 *
 * src/utils/promo.ts repete o prazo para exibir a contagem; um teste falha se
 * os dois divergirem. Sáb 26/09/2026 23:59:59 em Brasília (UTC-3, sem horário
 * de verão desde 2019).
 */
export const PROMO_ENDS_AT = new Date('2026-09-26T23:59:59-03:00')

export const isPromoActive = (now: Date = new Date()): boolean => now.getTime() <= PROMO_ENDS_AT.getTime()

export const CARD_MONTHLY_PRICE = { promo: 49.9, regular: 59.9 }

export const cardMonthlyPrice = (now: Date = new Date()): number =>
  isPromoActive(now) ? CARD_MONTHLY_PRICE.promo : CARD_MONTHLY_PRICE.regular
