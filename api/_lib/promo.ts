/**
 * Preço da assinatura mensal no cartão. Era promocional até 26/09/2026;
 * a partir daí virou o preço padrão (decisão do usuário) — não há mais
 * distinção entre "promo" e "regular".
 *
 * src/utils/promo.ts repete este valor para exibição; um teste falha se
 * divergirem.
 */
export const CARD_MONTHLY_PRICE = 49.9
