/**
 * Vitrine dos planos via Pix — só o que a tela precisa para renderizar.
 *
 * O preço que de fato é cobrado vem de api/_lib/pixPlans.ts, no servidor.
 * Estes números existem só para exibição; src/__tests__/pixPlans.test.ts
 * falha se divergirem da fonte de verdade.
 */
export type PixPlanId = 'mensal' | 'trimestral' | 'teste'

export interface PixPlanDisplay {
  id: PixPlanId
  months: number
  amount: number
  title: string
  subtitle: string
  badge?: string
  /** Só aparece para admin. O servidor também recusa para os demais. */
  adminOnly?: boolean
}

export const PIX_PLANS_DISPLAY: PixPlanDisplay[] = [
  {
    id: 'mensal',
    months: 1,
    amount: 59.9,
    title: '1 mês',
    subtitle: 'Acesso por 30 dias',
  },
  {
    id: 'teste',
    months: 1,
    amount: 0.01,
    title: 'Verificação (admin)',
    subtitle: 'Valida a cobrança de ponta a ponta por um centavo',
    adminOnly: true,
  },
  {
    id: 'trimestral',
    months: 3,
    amount: 149.9,
    title: '3 meses',
    subtitle: 'Equivale a R$ 49,97 por mês',
    badge: 'Economize R$ 29,80',
  },
]

export const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
