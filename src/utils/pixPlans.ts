/**
 * Vitrine dos planos via Pix — só o que a tela precisa para renderizar.
 *
 * O preço que de fato é cobrado vem de api/_lib/pixPlans.ts, no servidor.
 * Estes números existem só para exibição; src/__tests__/pixPlans.test.ts
 * falha se divergirem da fonte de verdade.
 */
export type PixPlanId = 'mensal' | 'trimestral' | 'semestral' | 'anual' | 'teste'

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
    amount: 49.9,
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
    amount: 129.9,
    title: '3 meses',
    subtitle: 'Equivale a R$ 43,30 por mês',
    badge: 'Economize R$ 19,80',
  },
  {
    id: 'semestral',
    months: 6,
    amount: 233.4,
    title: '6 meses',
    subtitle: 'Equivale a R$ 38,90 por mês',
    badge: 'Economize R$ 66,00',
  },
  {
    id: 'anual',
    months: 12,
    amount: 358.8,
    title: '12 meses',
    subtitle: 'Equivale a R$ 29,90 por mês',
    badge: 'Economize R$ 240,00',
  },
]

export const getPixPlansDisplay = (): PixPlanDisplay[] => PIX_PLANS_DISPLAY

export const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
