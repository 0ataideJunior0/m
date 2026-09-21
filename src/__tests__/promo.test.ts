import { describe, it, expect } from 'vitest'
import {
  PROMO_ENDS_AT as SERVER_ENDS_AT,
  isPromoActive as serverActive,
  cardMonthlyPrice,
  CARD_MONTHLY_PRICE,
} from '../../api/_lib/promo'
import { PIX_PLANS, PIX_PLANS_REGULAR, getPixPlan } from '../../api/_lib/pixPlans'
import {
  PROMO_ENDS_AT,
  isPromoActive,
  promoCountdownLabel,
  REGULAR_MONTHLY_PRICE,
  PROMO_MONTHLY_PRICE,
} from '../utils/promo'
import { PIX_PLANS_DISPLAY, PIX_PLANS_DISPLAY_REGULAR, getPixPlansDisplay } from '../utils/pixPlans'

const DENTRO = new Date('2026-09-22T12:00:00-03:00')
const FORA = new Date('2026-09-27T00:00:01-03:00')

// A tela promete "válida até sábado 26/09". Só é verdade se o SERVIDOR trocar o
// preço sozinho nesse momento e a vitrine concordar com ele.
describe('promoção de lançamento: prazo e preços', () => {
  it('front e servidor usam exatamente o mesmo prazo', () => {
    expect(PROMO_ENDS_AT.getTime()).toBe(SERVER_ENDS_AT.getTime())
  })

  it('vale até o último segundo de sábado 26/09 em Brasília, e não um segundo além', () => {
    const ultimo = new Date('2026-09-26T23:59:59-03:00')
    const seguinte = new Date('2026-09-27T00:00:00-03:00')
    expect(serverActive(ultimo)).toBe(true)
    expect(serverActive(seguinte)).toBe(false)
    expect(isPromoActive(ultimo)).toBe(true)
    expect(isPromoActive(seguinte)).toBe(false)
  })

  it('o servidor cobra o preço promocional dentro do prazo e o cheio depois', () => {
    expect(cardMonthlyPrice(DENTRO)).toBe(49.9)
    expect(cardMonthlyPrice(FORA)).toBe(59.9)
    expect(getPixPlan('mensal', DENTRO).amount).toBe(49.9)
    expect(getPixPlan('mensal', FORA).amount).toBe(59.9)
    expect(getPixPlan('trimestral', DENTRO).amount).toBe(129.9)
    expect(getPixPlan('trimestral', FORA).amount).toBe(149.9)
  })

  it('o plano de verificação de R$ 0,01 não muda com a promoção', () => {
    expect(getPixPlan('teste', DENTRO).amount).toBe(0.01)
    expect(getPixPlan('teste', FORA).amount).toBe(0.01)
  })

  it('a vitrine anuncia o mesmo preço que o servidor cobra, nos dois períodos', () => {
    expect(PROMO_MONTHLY_PRICE).toBe(CARD_MONTHLY_PRICE.promo)
    expect(REGULAR_MONTHLY_PRICE).toBe(CARD_MONTHLY_PRICE.regular)
    for (const [display, table] of [
      [getPixPlansDisplay(DENTRO), PIX_PLANS],
      [getPixPlansDisplay(FORA), PIX_PLANS_REGULAR],
    ] as const) {
      for (const plan of display) {
        expect(plan.amount, `plano ${plan.id}`).toBe(table[plan.id].amount)
        expect(plan.months, `plano ${plan.id}`).toBe(table[plan.id].months)
      }
    }
    expect(getPixPlansDisplay(DENTRO)).toBe(PIX_PLANS_DISPLAY)
    expect(getPixPlansDisplay(FORA)).toBe(PIX_PLANS_DISPLAY_REGULAR)
  })

  it('o desconto do trimestral anunciado bate com a conta nos dois períodos', () => {
    for (const [table, esperado] of [
      [PIX_PLANS, 'R$ 19,80'],
      [PIX_PLANS_REGULAR, 'R$ 29,80'],
    ] as const) {
      const economia = table.mensal.amount * 3 - table.trimestral.amount
      expect(economia.toFixed(2)).toBe(esperado.replace('R$ ', '').replace(',', '.'))
    }
    expect(PIX_PLANS_DISPLAY.find((p) => p.id === 'trimestral')!.badge).toContain('R$ 19,80')
    expect(PIX_PLANS_DISPLAY_REGULAR.find((p) => p.id === 'trimestral')!.badge).toContain('R$ 29,80')
  })

  it('a contagem conta os dias de calendário, hoje incluído', () => {
    expect(promoCountdownLabel(new Date('2026-09-21T12:00:00-03:00'))).toBe('Faltam 6 dias')
    expect(promoCountdownLabel(new Date('2026-09-25T09:00:00-03:00'))).toBe('Faltam 2 dias')
    expect(promoCountdownLabel(new Date('2026-09-26T09:00:00-03:00'))).toBe('Último dia')
  })
})
