/**
 * Preço da assinatura mensal no cartão, só para exibição. Quem decide o
 * preço cobrado é o servidor (api/_lib/promo.ts); src/__tests__/promo.test.ts
 * falha se os dois divergirem.
 *
 * Era promocional até 26/09/2026; a partir daí virou o preço padrão
 * (decisão do usuário) — não há mais distinção entre "promo" e "regular".
 */
export const MONTHLY_PRICE = 49.9
