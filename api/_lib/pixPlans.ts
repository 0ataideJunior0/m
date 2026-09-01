/**
 * Fonte de verdade dos planos pagos via Pix.
 *
 * O valor cobrado NUNCA vem do cliente — o front manda só o id do plano e o
 * servidor resolve o preço aqui. Se o cliente pudesse mandar o valor, daria
 * para assinar por R$ 0,01.
 *
 * A vitrine em src/utils/pixPlans.ts repete esses números para renderizar a
 * tela; src/__tests__/pixPlans.test.ts falha se os dois divergirem.
 */
export type PixPlanId = 'mensal' | 'trimestral'

export interface PixPlan {
  id: PixPlanId
  months: number
  amount: number
}

export const PIX_PLANS: Record<PixPlanId, PixPlan> = {
  mensal: { id: 'mensal', months: 1, amount: 59.9 },
  trimestral: { id: 'trimestral', months: 3, amount: 149.9 },
}

export function isPixPlanId(value: unknown): value is PixPlanId {
  return value === 'mensal' || value === 'trimestral'
}
