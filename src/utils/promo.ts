/**
 * Prazo da promoção de lançamento, só para exibição. Quem decide o preço
 * cobrado é o servidor (api/_lib/promo.ts); src/__tests__/promo.test.ts falha
 * se o prazo ou os preços divergirem.
 */
export const PROMO_ENDS_AT = new Date('2026-09-26T23:59:59-03:00')

export const REGULAR_MONTHLY_PRICE = 59.9
export const PROMO_MONTHLY_PRICE = 49.9

export const isPromoActive = (now: Date = new Date()): boolean => now.getTime() <= PROMO_ENDS_AT.getTime()

export const formatPromoEnd = (): string =>
  PROMO_ENDS_AT.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })

// Dias de calendário que ainda restam, contando hoje: na segunda com prazo no
// sábado são 6. No último dia vira "Último dia".
export const promoCountdownLabel = (now: Date = new Date()): string => {
  const days = Math.ceil((PROMO_ENDS_AT.getTime() - now.getTime()) / 86_400_000)
  return days <= 1 ? 'Último dia' : `Faltam ${days} dias`
}
