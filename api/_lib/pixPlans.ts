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
export type PixPlanId = 'mensal' | 'trimestral' | 'teste'

export interface PixPlan {
  id: PixPlanId
  months: number
  amount: number
}

export const PIX_PLANS: Record<PixPlanId, PixPlan> = {
  mensal: { id: 'mensal', months: 1, amount: 59.9 },
  trimestral: { id: 'trimestral', months: 3, amount: 149.9 },
  // Plano de verificação, restrito a admin (checado no servidor, em
  // create-pix-payment.ts). Existe para validar a cobrança de ponta a ponta
  // por R$ 0,01 depois de mexer em domínio, credencial ou webhook -- o tipo de
  // troca cuja falha só apareceria quando a primeira cliente real pagasse.
  // R$ 0,01 é o mínimo que a API do MP aceita para Pix.
  teste: { id: 'teste', months: 1, amount: 0.01 },
}

export const ADMIN_ONLY_PLANS: PixPlanId[] = ['teste']

export function isPixPlanId(value: unknown): value is PixPlanId {
  return value === 'mensal' || value === 'trimestral' || value === 'teste'
}
